import { config as loadDotenv } from "dotenv"

import { retrieveContext } from "@/lib/retrieve"

type ParsedArgs = {
  query: string
  topK: number
}

function parseArgs(argv: string[]): ParsedArgs {
  const explicitQuery = argv.find((arg) => arg.startsWith("--query="))
  const queryIndex = argv.findIndex((arg) => arg === "--query")

  let query = ""
  if (explicitQuery) {
    query = (explicitQuery.split("=")[1] || "").trim()
  } else if (queryIndex >= 0 && argv[queryIndex + 1]) {
    query = argv[queryIndex + 1].trim()
  }

  const explicitTopK = argv.find((arg) => arg.startsWith("--topK="))
  const topKIndex = argv.findIndex((arg) => arg === "--topK")

  let topKRaw = "5"
  if (explicitTopK) {
    topKRaw = explicitTopK.split("=")[1] || "5"
  } else if (topKIndex >= 0 && argv[topKIndex + 1]) {
    topKRaw = argv[topKIndex + 1]
  }

  const parsedTopK = Number.parseInt(topKRaw, 10)
  const topK = Number.isFinite(parsedTopK) && parsedTopK > 0 ? Math.min(parsedTopK, 20) : 5

  return { query, topK }
}

function redactSnippet(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  if (normalized.length <= 180) {
    return normalized
  }

  return `${normalized.slice(0, 180)}...`
}

async function main() {
  loadDotenv({ path: ".env.local" })

  const { query, topK } = parseArgs(process.argv.slice(2))

  if (!query) {
    throw new Error("Usage: pnpm run rag:test:retrieve -- --query \"your search text\"")
  }

  const result = await retrieveContext(query, topK)

  console.log(`Query: ${query}`)
  console.log(`Requested topK: ${topK}`)
  console.log(`Retrieval mode: ${result.retrievalMode}`)
  console.log(`Chunks returned: ${result.sources.length}`)

  if (result.sources.length === 0) {
    console.log("No sources returned.")
    return
  }

  for (let i = 0; i < result.sources.length; i += 1) {
    const source = result.sources[i]
    const safeName = source.documentName || "unknown"
    const originalName = source.originalName || safeName
    const chunkIndex = Number.isFinite(source.chunkIndex) ? source.chunkIndex : -1
    const mode = source.mode || result.retrievalMode
    const scoreText = typeof source.score === "number" ? source.score.toFixed(4) : "n/a"
    const snippet = redactSnippet(source.content)
    console.log(
      `${i + 1}. mode=${mode} source=${safeName} original_name=${originalName} chunk_index=${chunkIndex} score=${scoreText} snippet=${snippet}`,
    )
  }
}

main().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : "Unknown retrieval smoke test failure"
  console.error(safeMessage)
  process.exit(1)
})
