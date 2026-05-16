# AEON Ops RAG Next Steps

Current state:
- Knowledge upload enabled through [app/api/files/upload/route.ts](app/api/files/upload/route.ts).
- Uploaded files are stored in /home/aeon-rag/storage/uploads.
- Supported text formats (.txt/.md/.json/.csv) are parsed, chunked, embedded, and stored in pgvector.
- Retrieval search is available via [app/api/rag/search/route.ts](app/api/rag/search/route.ts).
- [app/api/chat/route.ts](app/api/chat/route.ts) can inject retrieved context and request source citations.

Retrieval status:
- Phase 1 retrieval enabled after files are indexed.

Planned implementation sequence:
1. Add PDF/DOCX parsing pipeline.
2. Add chunk attribution spans and richer citation rendering in UI.
3. Add background indexing queue and retry jobs.
4. Add hybrid lexical + vector retrieval.
5. Add source confidence and chunk deduplication.