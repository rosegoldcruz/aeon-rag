CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_settings (
  user_key text PRIMARY KEY,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  appearance jsonb NOT NULL DEFAULT '{}'::jsonb,
  workspace jsonb NOT NULL DEFAULT '{}'::jsonb,
  security jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_portal_sessions (
  session_token text PRIMARY KEY,
  user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_portal_sessions_user_key ON admin_portal_sessions (user_key);
CREATE INDEX IF NOT EXISTS idx_admin_portal_sessions_expires_at ON admin_portal_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_key text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_events_created_at ON admin_auth_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_auth_events_action ON admin_auth_events (action);
