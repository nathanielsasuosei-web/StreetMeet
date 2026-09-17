-- 0002_dating.sql — Module 2 (dating features): discover, swipe, match,
-- message, moderate, notify.
--
-- The legacy tables carried over from 0001 (likes, matches, messages,
-- reports, blocks) are extended rather than replaced:
--   * likes.decision   -> a swipe is a LIKE or a PASS; passes must persist so
--                         the discover deck never re-shows a skipped profile.
--   * messages.match_id -> a thread belongs to its match, so "can we talk?"
--                         is one indexed lookup and unmatching/delete stays
--                         cascaded. receiver_id/seen keep the unread maths.
--   * reports.details  -> free text next to the reason enum.
--
-- Portable on purpose: ADD COLUMN with a constant default and with a foreign
-- key are supported by both SQLite and PostgreSQL, so both dialect files are
-- byte-identical.
--
-- matches rows are always stored ordered (lexicographically smaller user id
-- in user_one_id) - the service layer guarantees it, which keeps the
-- UNIQUE (user_one_id, user_two_id) constraint a true "one match per pair".

ALTER TABLE likes ADD COLUMN decision TEXT NOT NULL DEFAULT 'LIKE';

ALTER TABLE messages ADD COLUMN match_id TEXT REFERENCES matches (id) ON DELETE CASCADE;

ALTER TABLE reports ADD COLUMN details TEXT;

CREATE INDEX idx_likes_decision ON likes (receiver_id, decision, created_at);
CREATE INDEX idx_messages_match ON messages (match_id, created_at);
CREATE INDEX idx_matches_one ON matches (user_one_id, created_at);
CREATE INDEX idx_matches_two ON matches (user_two_id, created_at);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_user_id, created_at);

-- In-app notification centre: a like, a match or a message addressed to
-- user_id, optionally pointing at the actor and the match it belongs to.
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL,              -- LIKE | MATCH | MESSAGE
  actor_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  match_id   TEXT REFERENCES matches (id) ON DELETE CASCADE,
  payload    TEXT,                       -- JSON fragment (e.g. message preview)
  read_at    TEXT,
  created_at TEXT NOT NULL,
  CHECK (type IN ('LIKE', 'MATCH', 'MESSAGE'))
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at);
CREATE INDEX idx_notifications_unread ON notifications (user_id, read_at);
