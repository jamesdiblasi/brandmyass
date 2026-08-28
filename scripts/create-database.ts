/**
 * Creates the `brandmyass` database on the existing Azure PostgreSQL Flexible
 * Server, then grants the application role access to it.
 *
 * This is the only script that needs admin credentials, which is why it is a
 * one-off you run by hand rather than something the app does at boot.
 *
 *   DATABASE_ADMIN_URL  admin connection, pointed at the `postgres` database
 *   BMA_DB_NAME         defaults to brandmyass
 *   BMA_DB_ROLE         optional; if set, gets CONNECT + schema privileges
 *
 * `CREATE DATABASE` cannot run inside a transaction, and Postgres has no
 * `CREATE DATABASE IF NOT EXISTS`, so existence is checked first and a
 * duplicate_database error is swallowed to keep the script re-runnable.
 */
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })
config()

const DB_NAME = process.env.BMA_DB_NAME || 'brandmyass'
const ROLE = process.env.BMA_DB_ROLE

function assertSafeIdentifier(name: string, label: string): void {
  // These get interpolated into DDL, which cannot be parameterised. Anything
  // outside this character set is refused rather than quoted and hoped for.
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`${label} "${name}" is not a safe SQL identifier (lowercase, digits, underscore).`)
  }
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_ADMIN_URL
  if (!adminUrl) {
    console.error('DATABASE_ADMIN_URL is not set. It must point at the `postgres` database with an admin role.')
    process.exit(1)
  }
  assertSafeIdentifier(DB_NAME, 'BMA_DB_NAME')
  if (ROLE) assertSafeIdentifier(ROLE, 'BMA_DB_ROLE')

  const client = new Client({ connectionString: adminUrl, ssl: { rejectUnauthorized: true } })
  await client.connect()

  try {
    const { rows } = await client.query('select 1 from pg_database where datname = $1', [DB_NAME])
    if (rows.length > 0) {
      console.log(`· database "${DB_NAME}" already exists — nothing to create`)
    } else {
      await client.query(`create database ${DB_NAME}`)
      console.log(`✓ created database "${DB_NAME}"`)
    }

    if (ROLE) {
      await client.query(`grant connect on database ${DB_NAME} to ${ROLE}`)
      console.log(`✓ granted CONNECT on "${DB_NAME}" to "${ROLE}"`)
    }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === '42P04') {
      console.log(`· database "${DB_NAME}" already exists — nothing to create`)
    } else {
      throw err
    }
  } finally {
    await client.end()
  }

  if (ROLE) {
    // Schema-level grants have to be issued while connected to the new database.
    const inner = new Client({
      connectionString: adminUrl.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`),
      ssl: { rejectUnauthorized: true },
    })
    await inner.connect()
    try {
      await inner.query(`grant usage, create on schema public to ${ROLE}`)
      await inner.query(
        `alter default privileges in schema public grant select, insert, update, delete on tables to ${ROLE}`,
      )
      await inner.query(`alter default privileges in schema public grant usage, select on sequences to ${ROLE}`)
      console.log(`✓ granted schema privileges to "${ROLE}"`)
    } finally {
      await inner.end()
    }
  }

  console.log(`\nNext: point DATABASE_URL at "${DB_NAME}" and run  npm run db:migrate`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
