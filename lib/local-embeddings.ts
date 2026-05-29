import { createHash } from "node:crypto"

export const LOCAL_EMBEDDING_MODEL_ID = "aeon-local-hash-embedding-768"
export const LOCAL_EMBEDDING_DIMENSION = 768

const TOKEN_PATTERN = /[a-z0-9_'-]+/g

function addFeature(vector: number[], feature: string, weight: number) {
  const digest = createHash("sha256").update(feature).digest()

  for (let offset = 0; offset < digest.length; offset += 4) {
    const bucket = digest.readUInt16BE(offset) % vector.length
    const sign = digest[offset + 2] % 2 === 0 ? 1 : -1
    const magnitude = 0.5 + digest[offset + 3] / 255
    vector[bucket] += sign * weight * magnitude
  }
}

function featuresForText(text: string) {
  const normalized = text.toLowerCase()
  const tokens = normalized.match(TOKEN_PATTERN) ?? []
  const features: Array<{ value: string; weight: number }> = []

  for (const token of tokens) {
    features.push({ value: `token:${token}`, weight: 1 })

    if (token.length >= 4) {
      for (let index = 0; index <= token.length - 3; index += 1) {
        features.push({ value: `tri:${token.slice(index, index + 3)}`, weight: 0.35 })
      }
    }
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    features.push({ value: `pair:${tokens[index]} ${tokens[index + 1]}`, weight: 0.75 })
  }

  return features
}

export function embedTextLocally(text: string, dimensions = LOCAL_EMBEDDING_DIMENSION) {
  const vector = Array.from({ length: dimensions }, () => 0)
  const features = featuresForText(text)

  if (features.length === 0) {
    addFeature(vector, "empty", 1)
  } else {
    for (const feature of features) {
      addFeature(vector, feature.value, feature.weight)
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1

  return vector.map((value) => Number((value / norm).toFixed(8)))
}