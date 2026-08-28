import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

/**
 * Direct TCP to Azure PostgreSQL Flexible Server, using the same pg driver and
 * the same type-parser corrections as the LeadNet dashboard on this server.
 *
 * The parser overrides are not optional decoration. node-postgres returns int8
 * and numeric as STRINGS to protect precision, and this app does arithmetic on
 * bid amounts. Left alone, `topBid + increment` silently becomes string
 * concatenation and "40000" + 1000 evaluates to "400001000" — a four-million
 * dollar minimum bid and no error anywhere. Money is stored as integer cents
 * precisely so this class of bug has nowhere to hide.
 */

// bigserial ids arrive as strings. Every id here is far below 2^53.
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10))

declare global {
  // eslint-disable-next-line no-var
  var __bmaPool: Pool | undefined
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and point it at the brandmyass database.',
    )
  }
  return new Pool({
    connectionString,
    // Azure Flexible Server requires TLS. The public chain validates, so this
    // is a plain verified connection rather than the rejectUnauthorized:false
    // that so many Azure guides reach for.
    ssl: { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

/**
 * The pool is created on first use, not at import.
 *
 * `next build` imports every route module to collect page data, and it does so
 * in an environment that has no database credentials. Constructing the pool at
 * module scope therefore failed the build outright. Deferring it also means a
 * missing DATABASE_URL surfaces as a handled request-time error — the homepage
 * falls back to its offline state — rather than taking the whole process down.
 *
 * The global cache exists because the Next dev server hot-reloads modules;
 * without it the pool leaks a fresh set of sockets on every edit until Azure
 * starts refusing connections.
 */
export function getPool(): Pool {
  if (!global.__bmaPool) global.__bmaPool = makePool()
  return global.__bmaPool
}

/** Closes the pool. Scripts need this to let the process exit. */
export async function closePool(): Promise<void> {
  if (global.__bmaPool) {
    await global.__bmaPool.end()
    global.__bmaPool = undefined
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[])
  return res.rows as T[]
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Runs `fn` inside a transaction, rolling back on any throw.
 *
 * Every bid mutation goes through here. The auction's correctness rests on
 * taking a row lock on the zone before reading the standing bid, and a row lock
 * is only meaningful inside a transaction.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
