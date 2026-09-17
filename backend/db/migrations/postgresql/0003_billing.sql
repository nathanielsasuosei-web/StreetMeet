-- 0003_billing.sql — Module 3 (subscriptions & Paystack billing).
--
-- The legacy `subscriptions` table from 0001 gets a real lifecycle:
--   PENDING   checkout initialised at Paystack, money not confirmed yet
--   ACTIVE    payment verified - the plan is live until expires_at
--   EXPIRED   the period ended (sweeper + read-time checks)
--   CANCELLED / FAILED  terminal states kept for honesty
-- `active` (legacy boolean) is kept as a mirror of "ACTIVE and not expired"
-- so old queries keep working; amounts are stored in pesewas (Paystack's
-- subunit) next to the display amount in GHS.
--
-- Byte-identical across dialects: ADD COLUMN with constant defaults and a
-- CHECK constraint behave the same in SQLite and PostgreSQL.

ALTER TABLE subscriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE subscriptions ADD COLUMN channel TEXT;
ALTER TABLE subscriptions ADD COLUMN currency TEXT NOT NULL DEFAULT 'GHS';
ALTER TABLE subscriptions ADD COLUMN amount_pesewas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN started_at TEXT;
ALTER TABLE subscriptions ADD COLUMN updated_at TEXT;
ALTER TABLE subscriptions ADD COLUMN provider_payload TEXT;   -- JSON: verify/webhook evidence

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, status, expires_at);
CREATE INDEX idx_subscriptions_reference ON subscriptions (payment_reference);
