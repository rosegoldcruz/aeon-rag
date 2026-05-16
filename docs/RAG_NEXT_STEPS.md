# AEON Ops RAG Next Steps

Current state:
- Knowledge upload enabled through [app/api/files/upload/route.ts](app/api/files/upload/route.ts).
- Uploaded files are stored in /home/aeon-rag/storage/uploads.
- Upload metadata can be sent to [app/api/chat/route.ts](app/api/chat/route.ts) as context.
- Retrieval and grounded answer generation are not implemented yet.

Retrieval status:
- Retrieval coming next.

Planned implementation sequence:
1. Parse uploaded docs by file type.
2. Chunk extracted text with stable chunk IDs.
3. Embed chunks with Vertex embeddings.
4. Store vectors and metadata in pgvector.
5. Retrieve top-k chunks for each request.
6. Inject retrieved context into chat prompts.
7. Return source citations in assistant answers.