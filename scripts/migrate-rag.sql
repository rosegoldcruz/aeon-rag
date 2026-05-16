CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  stored_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS stored_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'original_name'
  ) THEN
    EXECUTE 'ALTER TABLE documents ALTER COLUMN original_name DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'mime_type'
  ) THEN
    EXECUTE 'ALTER TABLE documents ALTER COLUMN mime_type DROP NOT NULL';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'original_name'
  ) THEN
    EXECUTE 'UPDATE documents SET name = COALESCE(name, original_name) WHERE name IS NULL';
    EXECUTE 'UPDATE documents SET original_name = COALESCE(original_name, name)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'mime_type'
  ) THEN
    EXECUTE 'UPDATE documents SET type = COALESCE(type, mime_type) WHERE type IS NULL';
    EXECUTE 'UPDATE documents SET mime_type = COALESCE(mime_type, type)';
  END IF;
END
$$;

UPDATE documents
SET stored_path = COALESCE(stored_path, stored_path)
WHERE stored_path IS NULL;

ALTER TABLE documents ALTER COLUMN name SET NOT NULL;
ALTER TABLE documents ALTER COLUMN type SET NOT NULL;
ALTER TABLE documents ALTER COLUMN size_bytes SET NOT NULL;
ALTER TABLE documents ALTER COLUMN stored_path SET NOT NULL;
ALTER TABLE documents ALTER COLUMN status SET NOT NULL;

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);