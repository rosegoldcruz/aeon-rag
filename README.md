# AEON Ops

AEON stands for Advanced Efficient Optimized Network.

AEON Ops is a private agent workspace focused on execution-first workflows:
- authenticated access
- switchable DeepSeek and Mistral Codestral chat
- RAG retrieval for indexed documents
- operational controls for planning, brainstorming, and image-prompt generation

## Stack

- Next.js 16
- TypeScript
- NextAuth (ZITADEL)
- PostgreSQL
- DeepSeek API or Mistral Codestral API
- PM2

## Local Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Build and Validation

```bash
pnpm exec tsc --noEmit
pnpm build
```

## Deploy Script

Use the project deploy script:

```bash
./deploy.sh "your commit message"
```

The deploy script includes a private-artifact preflight guard and blocks deploys if private corpus artifacts are tracked.

## Private Data Rule

Do not commit runtime corpus artifacts. These stay on server storage only.

Blocked patterns include:
- storage/manifests/
- storage/imports/
- storage/uploads/
- *.jsonl
- *.tsv
- tsconfig.tsbuildinfo
