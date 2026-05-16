import { extname, resolve } from "node:path"
import pool from "@/lib/db"
import { chunkText } from "@/lib/chunk"
import { embedBatch, EXPECTED_EMBEDDING_DIMENSION } from "@/lib/embed"
import { extractTextFromFile } from "@/lib/extract-text"

const UPLOAD_ROOT = "/home/aeon-rag/storage/uploads"

type IngestInput = {
  storedPath: string
  name: string
  type: string
  sizeBytes: number
}

export async function ingestStoredFile(input: IngestInput): Promise<{ documentId: string; chunkCount: number }> {
  const absolutePath = resolve("/home/aeon-rag", input.storedPath)
  const uploadRoot = resolve(UPLOAD_ROOT)

  if (!absolutePath.startsWith(uploadRoot)) {
    throw new Error("Stored file path is outside uploads directory.")
  }

  const client = await pool.connect()
  let documentId = ""

  try {
    await client.query("BEGIN")

    const insertDocument = await client.query<{ id: string }>(
      `
      INSERT INTO documents (name, type, size_bytes, stored_path, status)
      VALUES ($1, $2, $3, $4, 'uploaded')
      RETURNING id
      `,
      [input.name, input.type, input.sizeBytes, input.storedPath],
    )

    documentId = insertDocument.rows[0].id

    const text = await extractTextFromFile(absolutePath, input.type)
    const chunks = chunkText(text)

    if (chunks.length === 0) {
      await client.query(
        "UPDATE documents SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1",
        [documentId, "No extractable chunks from file."],
      )
      await client.query("COMMIT")
      throw new Error("No chunks were produced from extracted text.")
    }

    const embeddings = await embedBatch(chunks)

    for (let i = 0; i < chunks.length; i += 1) {
      const embedding = embeddings[i]
      if (!embedding || embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding dimension mismatch at chunk ${i}: got ${embedding?.length ?? 0}, expected ${EXPECTED_EMBEDDING_DIMENSION}.`,
        )
      }

      const vectorLiteral = `[${embedding.join(",")}]`
      await client.query(
        `
        INSERT INTO chunks (document_id, content, chunk_index, embedding)
        VALUES ($1, $2, $3, $4::vector)
        `,
        [documentId, chunks[i], i, vectorLiteral],
      )
    }

    await client.query("UPDATE documents SET status = 'indexed', error = NULL, updated_at = NOW() WHERE id = $1", [documentId])
    await client.query("COMMIT")

    return {
      documentId,
      chunkCount: chunks.length,
    }
  } catch (error) {
    await client.query("ROLLBACK")

    if (documentId) {
      try {
        await pool.query("UPDATE documents SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1", [
          documentId,
          error instanceof Error ? error.message : "Unknown ingestion failure",
        ])
      } catch {
        // Keep original ingestion error as the surfaced one.
      }
    }

    const safeMessage = error instanceof Error ? error.message : "Unknown ingestion failure"
    console.error("[ingest] ingestion failed", { message: safeMessage, extension: extname(input.name).toLowerCase() })
    throw new Error(safeMessage)
  } finally {
    client.release()
  }
}