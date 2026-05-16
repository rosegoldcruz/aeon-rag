import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { Pool } from "pg"

function loadEnvLocalIfNeeded() {
  if (process.env.POSTGRES_URL) {
    return
  }

  const envPath = join(process.cwd(), ".env.local")

  return readFile(envPath, "utf8")
    .then((raw) => {
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
          continue
        }

        const [key, ...rest] = trimmed.split("=")
        const value = rest.join("=").replace(/^['"]|['"]$/g, "")
        if (!(key in process.env)) {
          process.env[key] = value
        }
      }
    })
    .catch(() => {
      return
    })
}

async function run() {
  await loadEnvLocalIfNeeded()

  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is missing. Set it in environment or .env.local.")
  }

  const sqlPath = join(process.cwd(), "scripts", "migrate-rag.sql")
  const sql = await readFile(sqlPath, "utf8")

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL })
  const client = await pool.connect()

  try {
    await client.query(sql)
    console.log("RAG migration completed.")
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : "Unknown migration failure"
  console.error("RAG migration failed:", safeMessage)
  process.exit(1)
})