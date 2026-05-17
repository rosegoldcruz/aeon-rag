-- Per-file Drive import attempt tracking for auditability
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS drive_import_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES drive_import_jobs(id) ON DELETE CASCADE,
  drive_path text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'running',
  failure_stage text,
  error text,
  local_path text,
  content_hash text,
  chunk_count integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_import_job_items_job_id ON drive_import_job_items (job_id);
CREATE INDEX IF NOT EXISTS idx_drive_import_job_items_status ON drive_import_job_items (status);
CREATE INDEX IF NOT EXISTS idx_drive_import_job_items_stage ON drive_import_job_items (failure_stage);
CREATE INDEX IF NOT EXISTS idx_drive_import_job_items_path ON drive_import_job_items (drive_path);
