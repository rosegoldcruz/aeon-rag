import { embed, embedMany } from "ai"

export const EMBEDDING_MODEL_ID = "text-embedding-004"
export const EXPECTED_EMBEDDING_DIMENSION = 768

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

  const { embeddings } = await embedMany({
    model: await getEmbeddingModel(),
    values: texts,
  })

  return embeddings
}

export async function verifyEmbeddingDimension() {
  const embedding = await embedText("dimension test")
  return embedding.length
}