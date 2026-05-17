import { embed, embedMany } from "ai"

export const EMBEDDING_MODEL_ID = "text-embedding-004"
export const EXPECTED_EMBEDDING_DIMENSION = 768
export const VERTEX_EMBED_BATCH_SIZE = 20
export const VERTEX_EMBED_MAX_BATCH_CHARS = 40000
export const VERTEX_EMBED_MAX_ESTIMATED_TOKENS = 18000

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
  const batches: { start: number; values: string[]; charCount: number; estimatedTokens: number }[] = []
  const estimateTokens = (text: string) => Math.max(1, text.length)
  let currentValues: string[] = []
  let currentStart = 0
  let currentChars = 0
  let currentEstimatedTokens = 0

  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index]
    const charCount = text.length
    const estimatedTokens = estimateTokens(text)

    if (charCount > VERTEX_EMBED_MAX_BATCH_CHARS || estimatedTokens > VERTEX_EMBED_MAX_ESTIMATED_TOKENS) {
      throw new Error(
        `Embedding input ${index} exceeds safe request budget: chars=${charCount}, estimatedTokens=${estimatedTokens}, maxBatchChars=${VERTEX_EMBED_MAX_BATCH_CHARS}, maxEstimatedTokens=${VERTEX_EMBED_MAX_ESTIMATED_TOKENS}. Split the chunk before embedding.`,
      )
    }

    const wouldExceedCount = currentValues.length >= VERTEX_EMBED_BATCH_SIZE
    const wouldExceedChars = currentChars + charCount > VERTEX_EMBED_MAX_BATCH_CHARS
    const wouldExceedEstimatedTokens = currentEstimatedTokens + estimatedTokens > VERTEX_EMBED_MAX_ESTIMATED_TOKENS

    if (currentValues.length > 0 && (wouldExceedCount || wouldExceedChars || wouldExceedEstimatedTokens)) {
      batches.push({
        start: currentStart,
        values: currentValues,
        charCount: currentChars,
        estimatedTokens: currentEstimatedTokens,
      })
      currentValues = []
      currentStart = index
      currentChars = 0
      currentEstimatedTokens = 0
    }

    if (currentValues.length === 0) {
      currentStart = index
    }

    currentValues.push(text)
    currentChars += charCount
    currentEstimatedTokens += estimatedTokens
  }

  if (currentValues.length > 0) {
    batches.push({
      start: currentStart,
      values: currentValues,
      charCount: currentChars,
      estimatedTokens: currentEstimatedTokens,
    })
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]
    const values = batch.values

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
      throw new Error(
        `Embedding batch ${batchIndex} failed for inputs ${batch.start}-${batch.start + values.length - 1} with chars=${batch.charCount}, estimatedTokens=${batch.estimatedTokens}: ${safeMessage}`,
      )
    }
  }

  return embeddings
}

export async function verifyEmbeddingDimension() {
  const embedding = await embedText("dimension test")
  return embedding.length
}