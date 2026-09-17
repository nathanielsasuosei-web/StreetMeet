-- 0001_init.sql — StreetMeet initial schema (SQLite dialect)
--
-- Module 1 (User Accounts) tables are used by the API today. The remaining
-- tables are carried over from the legacy Prisma schema so modules 2-6
-- (matching, chat, status, payments, admin) can be migrated without another
-- destructive change.
--
-- Portability notes for SQLite:
--   * booleans are INTEGER 0/1        -> normalised by src/db/normalize.js
--   * timestamps are TEXT ISO-8601    -> same helper
--   * birth_date is TEXT 'YYYY-MM-DD' -> lexicographic order == chronological

-- ── Module 1: user accounts ────────────────────────────────────────────────

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  full_name       TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  phone_number    TEXT    UNIQUE,
  gender          TEXT,                       -- MAN | WOMAN | NON_BINARY | OTHER
  birth_date      TEXT,                       -- YYYY-MM-DD (age is derived, never stored)
  bio             TEXT,
  city            TEXT,
  country         TEXT,
  profile_image   TEXT,                       -- /uploads/profiles/<id>.jpg
  cover_image     TEXT,
  role            TEXT    NOT NULL DEFAULT 'USER',   -- USER | MODERATOR | ADMIN
  verified        INTEGER NOT NULL DEFAULT 0,
  token_version   INTEGER NOT NULL DEFAULT 0,        -- bump = invalidate all JWTs
  deactivated_at  TEXT,
  last_login_at   TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);

CREATE INDEX idx_users_city_gender ON users (city, gender);
CREATE INDEX idx_users_created_at ON users (created_at);

CREATE TABLE user_interests (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  slug    TEXT NOT NULL,
  PRIMARY KEY (user_id, slug)
);

CREATE INDEX idx_user_interests_slug ON user_interests (slug);

CREATE TABLE dating_preferences (
  user_id           TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  interested_in     TEXT    NOT NULL DEFAULT '["MAN","WOMAN","NON_BINARY","OTHER"]', -- JSON array of genders
  min_age           INTEGER NOT NULL DEFAULT 18 CHECK (min_age >= 18),
  max_age           INTEGER NOT NULL DEFAULT 45 CHECK (max_age <= 99),
  max_distance_km   INTEGER,                  -- NULL = "anywhere"
  relationship_goal TEXT,                     -- CASUAL | DATING | SERIOUS | MARRIAGE | FRIENDSHIP
  open_to_nearby    INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT    NOT NULL,
  CHECK (max_age >= min_age)
);

CREATE TABLE account_settings (
  user_id              TEXT    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  profile_visibility   TEXT    NOT NULL DEFAULT 'PUBLIC',  -- PUBLIC | MATCHES_ONLY | PRIVATE
  show_age             INTEGER NOT NULL DEFAULT 1,
  show_location        INTEGER NOT NULL DEFAULT 1,
  show_online_status   INTEGER NOT NULL DEFAULT 1,
  discoverable         INTEGER NOT NULL DEFAULT 1,
  allow_messages_from  TEXT    NOT NULL DEFAULT 'MATCHES', -- EVERYONE | MATCHES | NOBODY
  email_notifications  INTEGER NOT NULL DEFAULT 1,
  push_notifications   INTEGER NOT NULL DEFAULT 1,
  match_notifications  INTEGER NOT NULL DEFAULT 1,
  message_notifications INTEGER NOT NULL DEFAULT 1,
  product_updates      INTEGER NOT NULL DEFAULT 0,
  two_factor_enabled   INTEGER NOT NULL DEFAULT 0,
  updated_at           TEXT    NOT NULL,
  CHECK (profile_visibility IN ('PUBLIC', 'MATCHES_ONLY', 'PRIVATE')),
  CHECK (allow_messages_from IN ('EVERYONE', 'MATCHES', 'NOBODY'))
);

-- ── Modules 2-6: carried over from the legacy schema (not yet used) ────────

CREATE TABLE likes (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_likes_receiver ON likes (receiver_id, created_at);

CREATE TABLE matches (
  id          TEXT PRIMARY KEY,
  user_one_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_two_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  UNIQUE (user_one_id, user_two_id)
);

CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  seen        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_messages_thread ON messages (sender_id, receiver_id, created_at);

CREATE TABLE statuses (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text       TEXT,
  media_url  TEXT,
  media_type TEXT,
  views      INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_statuses_user ON statuses (user_id, created_at);

CREATE TABLE subscriptions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan              TEXT NOT NULL,            -- DAILY | WEEKLY | MONTHLY | PREMIUM_PLUS
  amount            REAL NOT NULL,
  payment_reference TEXT UNIQUE,
  active            INTEGER NOT NULL DEFAULT 0,
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  reporter_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reported_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'OPEN',
  created_at        TEXT NOT NULL
);

CREATE TABLE blocks (
  id               TEXT PRIMARY KEY,
  blocker_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL,
  UNIQUE (blocker_id, blocked_user_id)
);
