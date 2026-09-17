-- 0004_admin.sql (SQLite)
-- Module 4: the admin control panel.
--   * users       -> moderation state (suspend/ban), featured placement
--   * reports     -> review outcome columns
--   * interests   -> editable dating-interest catalogue (was a static list)
--   * announcements + a widened notifications.type CHECK so admins can
--     broadcast to every member.

ALTER TABLE users ADD COLUMN account_status  TEXT NOT NULL DEFAULT 'OK'; -- OK | SUSPENDED | BANNED
ALTER TABLE users ADD COLUMN moderation_note TEXT;
ALTER TABLE users ADD COLUMN moderated_at    TEXT;
ALTER TABLE users ADD COLUMN featured_at     TEXT;

ALTER TABLE reports ADD COLUMN resolution      TEXT;   -- DISMISSED | WARNED | SUSPENDED | BANNED
ALTER TABLE reports ADD COLUMN resolution_note TEXT;
ALTER TABLE reports ADD COLUMN resolved_by     TEXT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN resolved_at     TEXT;

CREATE TABLE interests (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '•',
  category   TEXT NOT NULL DEFAULT 'Other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- SQLite cannot alter a CHECK constraint, so the table is rebuilt with the
-- wider type list (LIKE | MATCH | MESSAGE | ANNOUNCEMENT).
CREATE TABLE notifications_new (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  actor_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  match_id   TEXT REFERENCES matches (id) ON DELETE CASCADE,
  payload    TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL,
  CHECK (type IN ('LIKE', 'MATCH', 'MESSAGE', 'ANNOUNCEMENT'))
);

INSERT INTO notifications_new (id, user_id, type, actor_id, match_id, payload, read_at, created_at)
SELECT id, user_id, type, actor_id, match_id, payload, read_at, created_at FROM notifications;

DROP TABLE notifications;

ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at);

CREATE INDEX idx_users_account_status ON users (account_status);
