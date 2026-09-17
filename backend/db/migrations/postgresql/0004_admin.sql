-- 0004_admin.sql (PostgreSQL)
-- Module 4: the admin control panel. Mirrors the SQLite migration exactly.

ALTER TABLE users ADD COLUMN account_status  TEXT NOT NULL DEFAULT 'OK'; -- OK | SUSPENDED | BANNED
ALTER TABLE users ADD COLUMN moderation_note TEXT;
ALTER TABLE users ADD COLUMN moderated_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN featured_at     TIMESTAMPTZ;

ALTER TABLE reports ADD COLUMN resolution      TEXT;   -- DISMISSED | WARNED | SUSPENDED | BANNED
ALTER TABLE reports ADD COLUMN resolution_note TEXT;
ALTER TABLE reports ADD COLUMN resolved_by     TEXT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN resolved_at     TIMESTAMPTZ;

CREATE TABLE interests (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '•',
  category   TEXT NOT NULL DEFAULT 'Other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('LIKE', 'MATCH', 'MESSAGE', 'ANNOUNCEMENT'));

CREATE INDEX idx_users_account_status ON users (account_status);
