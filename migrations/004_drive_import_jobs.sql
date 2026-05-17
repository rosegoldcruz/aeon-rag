-- Drive import jobs and document-source metadata (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS drive_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'google_drive',
  remote text NOT NULL,
  limit_requested integer NOT NULL,
  status text NOT NULL DEFAULT 'running',
  scanned_count integer NOT NULL DEFAULT 0,
  attempted_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_file_id text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS drive_path text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS imported_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_ingested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_documents_source ON documents (source);
CREATE INDEX IF NOT EXISTS idx_documents_drive_path ON documents (drive_path);
CREATE INDEX IF NOT EXISTS idx_documents_drive_path_hash ON documents (drive_path, content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_drive_path_hash_unique
  ON documents (drive_path, content_hash)
  WHERE drive_path IS NOT NULL AND content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drive_import_jobs_started_at ON drive_import_jobs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_import_jobs_status ON drive_import_jobs (status);
