-- 0001_init.sql — StreetMeet initial schema (PostgreSQL dialect)
--
-- Same logical model as db/migrations/sqlite/0001_init.sql, expressed with
-- native PostgreSQL types (BOOLEAN, TIMESTAMPTZ, JSONB). Keep the two files in
-- lock-step: same file name, same columns, same order.
--
--   birth_date is DATE; repositories read/write it as 'YYYY-MM-DD'.
--   interested_in is JSONB; repositories read/write it as a JS array.

-- ── Module 1: user accounts ────────────────────────────────────────────────

CREATE TABLE users (
  id              VARCHAR(36) PRIMARY KEY,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(320) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  phone_number    VARCHAR(32)  UNIQUE,
  gender          VARCHAR(16),
  birth_date      DATE,
  bio             VARCHAR(500),
  city            VARCHAR(80),
  country         VARCHAR(80),
  profile_image   VARCHAR(500),
  cover_image     VARCHAR(500),
  role            VARCHAR(16)  NOT NULL DEFAULT 'USER',
  verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  token_version   INTEGER      NOT NULL DEFAULT 0,
  deactivated_at  TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT users_gender_valid CHECK (gender IS NULL OR gender IN ('MAN', 'WOMAN', 'NON_BINARY', 'OTHER')),
  CONSTRAINT users_role_valid CHECK (role IN ('USER', 'MODERATOR', 'ADMIN')),
  CONSTRAINT users_adult CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE - INTERVAL '18 years')
);

CREATE INDEX idx_users_city_gender ON users (city, gender);
CREATE INDEX idx_users_created_at ON users (created_at);

CREATE TABLE user_interests (
  user_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  slug    VARCHAR(48) NOT NULL,
  PRIMARY KEY (user_id, slug)
);

CREATE INDEX idx_user_interests_slug ON user_interests (slug);

CREATE TABLE dating_preferences (
  user_id           VARCHAR(36) PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  interested_in     JSONB       NOT NULL DEFAULT '["MAN","WOMAN","NON_BINARY","OTHER"]'::jsonb,
  min_age           INTEGER     NOT NULL DEFAULT 18 CHECK (min_age >= 18),
  max_age           INTEGER     NOT NULL DEFAULT 45 CHECK (max_age <= 99),
  max_distance_km   INTEGER     CHECK (max_distance_km IS NULL OR max_distance_km > 0),
  relationship_goal VARCHAR(24) CHECK (relationship_goal IS NULL OR relationship_goal IN ('CASUAL', 'DATING', 'SERIOUS', 'MARRIAGE', 'FRIENDSHIP')),
  open_to_nearby    BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (max_age >= min_age)
);

CREATE TABLE account_settings (
  user_id               VARCHAR(36) PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  profile_visibility    VARCHAR(16)   NOT NULL DEFAULT 'PUBLIC'
                        CHECK (profile_visibility IN ('PUBLIC', 'MATCHES_ONLY', 'PRIVATE')),
  show_age              BOOLEAN       NOT NULL DEFAULT TRUE,
  show_location         BOOLEAN       NOT NULL DEFAULT TRUE,
  show_online_status    BOOLEAN       NOT NULL DEFAULT TRUE,
  discoverable          BOOLEAN       NOT NULL DEFAULT TRUE,
  allow_messages_from   VARCHAR(16)   NOT NULL DEFAULT 'MATCHES'
                        CHECK (allow_messages_from IN ('EVERYONE', 'MATCHES', 'NOBODY')),
  email_notifications   BOOLEAN       NOT NULL DEFAULT TRUE,
  push_notifications    BOOLEAN       NOT NULL DEFAULT TRUE,
  match_notifications   BOOLEAN       NOT NULL DEFAULT TRUE,
  message_notifications BOOLEAN       NOT NULL DEFAULT TRUE,
  product_updates       BOOLEAN       NOT NULL DEFAULT FALSE,
  two_factor_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Modules 2-6: carried over from the legacy schema (not yet used) ────────

CREATE TABLE likes (
  id          VARCHAR(36) PRIMARY KEY,
  sender_id   VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_likes_receiver ON likes (receiver_id, created_at);

CREATE TABLE matches (
  id          VARCHAR(36) PRIMARY KEY,
  user_one_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_two_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_one_id, user_two_id)
);

CREATE TABLE messages (
  id          VARCHAR(36) PRIMARY KEY,
  sender_id   VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  seen        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages (sender_id, receiver_id, created_at);

CREATE TABLE statuses (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text       VARCHAR(500),
  media_url  VARCHAR(500),
  media_type VARCHAR(32),
  views      INTEGER     NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_statuses_user ON statuses (user_id, created_at);

CREATE TABLE subscriptions (
  id                VARCHAR(36) PRIMARY KEY,
  user_id           VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan              VARCHAR(24) NOT NULL CHECK (plan IN ('DAILY', 'WEEKLY', 'MONTHLY', 'PREMIUM_PLUS')),
  amount            NUMERIC(10, 2) NOT NULL,
  payment_reference VARCHAR(120) UNIQUE,
  active            BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
  id               VARCHAR(36) PRIMARY KEY,
  reporter_id      VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reported_user_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason           VARCHAR(500) NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blocks (
  id              VARCHAR(36) PRIMARY KEY,
  blocker_id      VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_user_id VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_user_id)
);
