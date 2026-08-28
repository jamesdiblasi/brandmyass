/**
 * Applies migrations/*.sql in filename order, once each, inside a transaction.
 *
 * Deliberately simple: no down-migrations, no checksums beyond a filename
 * record. `npm run db:migrate -- --status` lists what has and has not run.
 */
import { config } from 'dotenv'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

config({ path: '.env.local' })
config()

const DIR = join(process.cwd(), 'migrations')

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const statusOnly = process.argv.includes('--status')
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } })
  await client.connect()

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename    text primary key,
        applied_at  timestamptz not null default now()
      )
    `)
    const { rows } = await client.query<{ filename: string }>('select filename from schema_migrations')
    const applied = new Set(rows.map((r) => r.filename))

    if (statusOnly) {
      for (const f of files) console.log(`${applied.has(f) ? '✓' : '·'} ${f}`)
      return
    }

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = readFileSync(join(DIR, file), 'utf8')
      process.stdout.write(`→ ${file} `)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (filename) values ($1)', [file])
        await client.query('COMMIT')
        console.log('✓')
        ran++
      } catch (err) {
        await client.query('ROLLBACK')
        console.log('✗')
        throw err
      }
    }
    console.log(ran === 0 ? '· already up to date' : `\n✓ applied ${ran} migration(s)`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
