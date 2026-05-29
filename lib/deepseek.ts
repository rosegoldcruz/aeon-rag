import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"

export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "AEON Core" },
  { id: "deepseek-v4-pro", label: "AEON Deep Focus" },
] as const

export type DeepSeekModelId = (typeof DEEPSEEK_MODELS)[number]["id"]

export function getDeepSeekApiKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()

  if (!apiKey) {
    throw new Error("Missing required env var: DEEPSEEK_API_KEY")
  }

  return apiKey
}

export function getDefaultDeepSeekModel(): DeepSeekModelId {
  const configuredModel = process.env.DEEPSEEK_MODEL?.trim()
  const supportedModel = DEEPSEEK_MODELS.find((model) => model.id === configuredModel)

  return supportedModel?.id ?? "deepseek-v4-flash"
}

export function isDeepSeekModel(value: string): value is DeepSeekModelId {
  return DEEPSEEK_MODELS.some((model) => model.id === value)
}

export function createDeepSeekProvider() {
  return createOpenAICompatible<DeepSeekModelId, string, string, string>({
    name: "deepseek",
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: getDeepSeekApiKey(),
    includeUsage: true,
    supportsStructuredOutputs: true,
  })
}