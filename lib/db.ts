import { Pool } from "pg"

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is required")
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

export default pool