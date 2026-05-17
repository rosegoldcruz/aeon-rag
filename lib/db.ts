import { Pool } from "pg"

let pool: Pool | null = null

export function getPool() {
  if (pool) {
    return pool
  }

  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required")
  }

  pool = new Pool({ connectionString })
  return pool
}

const lazyPool = new Proxy({} as Pool, {
  get(_target, property: keyof Pool) {
    const value = getPool()[property]
    return typeof value === "function" ? value.bind(getPool()) : value
  },
})

export default lazyPool