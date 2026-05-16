import { readFile } from "node:fs/promises"
import { Pool } from "pg"

export type DocumentStatus = "uploaded" | "indexed" | "failed"

export type StoredDocument = {
  id: string
  original_name: string
  stored_path: string
  mime_type: string | null
  size_bytes: number | null
  status: DocumentStatus
}

export type RetrievedChunk = {
  id: string
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
  similarity: number
}

const MIGRATION_FILE = "/home/aeon-rag/migrations/001_rag_phase1.sql"

let pool: Pool | null = null
let schemaPromise: Promise<void> | null = null

function getPool() {
  if (pool) {
    return pool
  }

  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error("POSTGRES_URL is missing.")
  }

  pool = new Pool({ connectionString })
  return pool
}

export async function ensureRagSchema() {
  if (schemaPromise) {
    return schemaPromise
  }

  schemaPromise = (async () => {
    const sql = await readFile(MIGRATION_FILE, "utf8")
    const client = await getPool().connect()
    try {
      await client.query(sql)
    } finally {
      client.release()
    }
  })()

  return schemaPromise
}

export async function createDocument(params: {
  originalName: string
  storedPath: string
  mimeType?: string
  sizeBytes?: number
  status?: DocumentStatus
}) {
  await ensureRagSchema()
  const client = await getPool().connect()

  try {
    const result = await client.query<StoredDocument>(
      `
      INSERT INTO documents (original_name, stored_path, mime_type, size_bytes, status)
      VALUES ($1, $2, $3, $4, COALESCE($5, 'uploaded'))
      RETURNING id, original_name, stored_path, mime_type, size_bytes, status
      `,
      [params.originalName, params.storedPath, params.mimeType ?? null, params.sizeBytes ?? null, params.status ?? "uploaded"],
    )

    return result.rows[0]
  } finally {
    client.release()
  }
}

export async function updateDocumentStatus(documentId: string, status: DocumentStatus) {
  await ensureRagSchema()
  await getPool().query("UPDATE documents SET status = $2 WHERE id = $1", [documentId, status])
}

export async function replaceDocumentChunks(documentId: string, chunks: Array<{ chunkIndex: number; content: string; embedding: number[] }>) {
  await ensureRagSchema()
  const client = await getPool().connect()

  try {
    await client.query("BEGIN")
    await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId])

    for (const chunk of chunks) {
      const embeddingLiteral = `[${chunk.embedding.join(",")}]`
      await client.query(
        `
        INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
        VALUES ($1, $2, $3, $4::vector)
        `,
        [documentId, chunk.chunkIndex, chunk.content, embeddingLiteral],
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function searchSimilarChunks(queryEmbedding: number[], limit = 5): Promise<RetrievedChunk[]> {
  await ensureRagSchema()
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`

  const result = await getPool().query<{
    id: string
    document_id: string
    original_name: string
    chunk_index: number
    content: string
    similarity: number
  }>(
    `
    SELECT
      c.id,
      c.document_id,
      d.original_name,
      c.chunk_index,
      c.content,
      1 - (c.embedding <=> $1::vector) AS similarity
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'indexed'
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
    `,
    [embeddingLiteral, limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentName: row.original_name,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: Number(row.similarity),
  }))
}

export async function getRagStats() {
  await ensureRagSchema()

  const [docCount, indexedDocCount, chunkCount] = await Promise.all([
    getPool().query<{ count: string }>("SELECT COUNT(*)::text AS count FROM documents"),
    getPool().query<{ count: string }>("SELECT COUNT(*)::text AS count FROM documents WHERE status = 'indexed'"),
    getPool().query<{ count: string }>("SELECT COUNT(*)::text AS count FROM document_chunks"),
  ])

  return {
    documents: Number(docCount.rows[0]?.count || "0"),
    indexedDocuments: Number(indexedDocCount.rows[0]?.count || "0"),
    chunks: Number(chunkCount.rows[0]?.count || "0"),
  }
}