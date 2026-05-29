import { embedTextLocally, LOCAL_EMBEDDING_DIMENSION, LOCAL_EMBEDDING_MODEL_ID } from "@/lib/local-embeddings"

export const EMBEDDING_MODEL_ID = LOCAL_EMBEDDING_MODEL_ID
export const EXPECTED_EMBEDDING_DIMENSION = LOCAL_EMBEDDING_DIMENSION
export const EMBED_BATCH_SIZE = 200
export const EMBED_MAX_BATCH_CHARS = 40000
export const EMBED_MAX_ESTIMATED_TOKENS = 18000

export async function embedText(text: string): Promise<number[]> {
  return embedTextLocally(text)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

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

    if (charCount > EMBED_MAX_BATCH_CHARS || estimatedTokens > EMBED_MAX_ESTIMATED_TOKENS) {
      throw new Error(
        `Embedding input ${index} exceeds safe request budget: chars=${charCount}, estimatedTokens=${estimatedTokens}, maxBatchChars=${EMBED_MAX_BATCH_CHARS}, maxEstimatedTokens=${EMBED_MAX_ESTIMATED_TOKENS}. Split the chunk before embedding.`,
      )
    }

    const wouldExceedCount = currentValues.length >= EMBED_BATCH_SIZE
    const wouldExceedChars = currentChars + charCount > EMBED_MAX_BATCH_CHARS
    const wouldExceedEstimatedTokens = currentEstimatedTokens + estimatedTokens > EMBED_MAX_ESTIMATED_TOKENS

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
      const result = values.map((value) => embedTextLocally(value))

      if (result.length !== values.length) {
        throw new Error(`Embedding batch ${batchIndex} returned ${result.length} embeddings for ${values.length} inputs.`)
      }

      embeddings.push(...result)
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