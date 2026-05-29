import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export type AiProviderId = "deepseek" | "mistral_codestral"

export type AiModelOption = {
  id: string
  label: string
  provider: AiProviderId
}

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"
const MISTRAL_CODESTRAL_BASE_URL =
  process.env.MISTRAL_CODESTRAL_BASE_URL?.trim() ||
  process.env.CODESTRAL_BASE_URL?.trim() ||
  process.env.MISTRAL_BASE_URL?.trim() ||
  "https://codestral.mistral.ai/v1"

const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "AEON Core", provider: "deepseek" },
  { id: "deepseek-v4-pro", label: "AEON Deep Focus", provider: "deepseek" },
] as const satisfies readonly AiModelOption[]

const MISTRAL_CODESTRAL_MODEL =
  process.env.MISTRAL_CODESTRAL_MODEL?.trim() ||
  process.env.CODESTRAL_MODEL?.trim() ||
  process.env.MISTRAL_MODEL?.trim() ||
  "codestral-latest"

const MISTRAL_CODESTRAL_MODELS = [
  { id: MISTRAL_CODESTRAL_MODEL, label: "AEON Codestral", provider: "mistral_codestral" },
] as const satisfies readonly AiModelOption[]

export const AI_MODELS: AiModelOption[] = [...MISTRAL_CODESTRAL_MODELS, ...DEEPSEEK_MODELS]

export function getMistralCodestralApiKey() {
  return (
    process.env.MISTRAL_CODESTRAL_API_KEY?.trim() ||
    process.env.CODESTRAL_API_KEY?.trim() ||
    process.env.MISTRAL_VIBE_API_KEY?.trim() ||
    process.env.VIBE_API_KEY?.trim() ||
    process.env.MISTRAL_API_KEY?.trim() ||
    ""
  )
}

export function getDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY?.trim() || ""
}

export function getConfiguredAiProvider(): AiProviderId {
  const configured = (process.env.AEON_PROVIDER || process.env.AI_PROVIDER || "").trim().toLowerCase()

  if (configured === "mistral" || configured === "codestral" || configured === "mistral_codestral") {
    return "mistral_codestral"
  }

  if (configured === "deepseek") {
    return "deepseek"
  }

  return getMistralCodestralApiKey() ? "mistral_codestral" : "deepseek"
}

export function getAvailableAiModels() {
  return AI_MODELS.filter((model) => isProviderConfigured(model.provider))
}

export function getDefaultAiModel() {
  const configuredProvider = getConfiguredAiProvider()
  const configuredModel =
    configuredProvider === "mistral_codestral"
      ? MISTRAL_CODESTRAL_MODEL
      : process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash"
  const availableModels = getAvailableAiModels()
  const configured = availableModels.find((model) => model.id === configuredModel)

  return configured?.id || availableModels[0]?.id || configuredModel
}

export function getAiModelOption(modelId: string) {
  return AI_MODELS.find((model) => model.id === modelId)
}

export function getAiProviderBaseURL(provider: AiProviderId) {
  return provider === "mistral_codestral" ? MISTRAL_CODESTRAL_BASE_URL : DEEPSEEK_BASE_URL
}

export function getAiProviderLabel(provider: AiProviderId) {
  return provider === "mistral_codestral" ? "Mistral Codestral" : "DeepSeek"
}

export function isProviderConfigured(provider: AiProviderId) {
  return provider === "mistral_codestral" ? Boolean(getMistralCodestralApiKey()) : Boolean(getDeepSeekApiKey())
}

export function getConfiguredAiProviders() {
  const providers: AiProviderId[] = []

  if (getMistralCodestralApiKey()) providers.push("mistral_codestral")
  if (getDeepSeekApiKey()) providers.push("deepseek")

  return providers
}

export function createAiProvider(provider: AiProviderId) {
  const apiKey = provider === "mistral_codestral" ? getMistralCodestralApiKey() : getDeepSeekApiKey()

  if (!apiKey) {
    throw new Error(
      provider === "mistral_codestral"
        ? "Missing required env var: MISTRAL_CODESTRAL_API_KEY, CODESTRAL_API_KEY, MISTRAL_VIBE_API_KEY, VIBE_API_KEY, or MISTRAL_API_KEY"
        : "Missing required env var: DEEPSEEK_API_KEY",
    )
  }

  return createOpenAICompatible<string, string, string, string>({
    name: provider,
    baseURL: getAiProviderBaseURL(provider),
    apiKey,
    includeUsage: true,
    supportsStructuredOutputs: true,
  })
}

export function resolveAiModel(requestedModel: string) {
  const defaultModel = getDefaultAiModel()
  const model = getAiModelOption(requestedModel) || getAiModelOption(defaultModel)

  if (!model) {
    const provider = getConfiguredAiProvider()
    return {
      id: defaultModel,
      provider,
      label: defaultModel,
    }
  }

  if (!isProviderConfigured(model.provider)) {
    const fallback = getAvailableAiModels()[0]
    if (fallback) return fallback
  }

  return model
}