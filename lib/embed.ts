import { embed, embedMany } from "ai"
import { vertex } from "@ai-sdk/google-vertex"

export const EMBEDDING_MODEL_ID = "text-embedding-004"
export const EXPECTED_EMBEDDING_DIMENSION = 768

const embeddingModel = vertex.textEmbeddingModel(EMBEDDING_MODEL_ID)

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  })

  return embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  })

  return embeddings
}

export async function verifyEmbeddingDimension() {
  const embedding = await embedText("dimension test")
  return embedding.length
}