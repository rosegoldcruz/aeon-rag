import { embed, embedMany } from "ai"

export const EMBEDDING_MODEL_ID = "text-embedding-004"
export const EXPECTED_EMBEDDING_DIMENSION = 768
export const VERTEX_EMBED_BATCH_SIZE = 20

async function getEmbeddingModel() {
  const { vertex } = await import("@ai-sdk/google-vertex")
  return vertex.textEmbeddingModel(EMBEDDING_MODEL_ID)
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: await getEmbeddingModel(),
    value: text,
  })

  return embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const model = await getEmbeddingModel()
  const embeddings: number[][] = []

  for (let start = 0; start < texts.length; start += VERTEX_EMBED_BATCH_SIZE) {
    const batchIndex = Math.floor(start / VERTEX_EMBED_BATCH_SIZE)
    const values = texts.slice(start, start + VERTEX_EMBED_BATCH_SIZE)

    try {
      const result = await embedMany({
        model,
        values,
      })

      if (result.embeddings.length !== values.length) {
        throw new Error(`Embedding batch ${batchIndex} returned ${result.embeddings.length} embeddings for ${values.length} inputs.`)
      }

      embeddings.push(...result.embeddings)
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown embedding batch failure"
      throw new Error(`Embedding batch ${batchIndex} failed for inputs ${start}-${start + values.length - 1}: ${safeMessage}`)
    }
  }

  return embeddings
}

export async function verifyEmbeddingDimension() {
  const embedding = await embedText("dimension test")
  return embedding.length
}