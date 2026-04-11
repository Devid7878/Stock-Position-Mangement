-- ============================================================
-- VALVO POSITION MANAGER - Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── POSITIONS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stock Info
  symbol            TEXT NOT NULL,            -- e.g. "BSE", "MTAR"
  trading_symbol    TEXT NOT NULL,            -- e.g. "BSE-EQ"
  exchange          TEXT NOT NULL DEFAULT 'NSE', -- NSE, BSE, NFO, MCX
  symbol_token      TEXT NOT NULL,            -- Angel One symbol token

  -- Position Details
  entry_price       NUMERIC(12, 4) NOT NULL,
  shares            INTEGER NOT NULL,
  stop_loss         NUMERIC(12, 4),
  exit_price        NUMERIC(12, 4),
  exit_date         TIMESTAMPTZ,

  -- Strategy & Management
  strategy          TEXT NOT NULL DEFAULT '5MA Safe',
  trailing_percent  INTEGER NOT NULL DEFAULT 100,
  bucket_sold_percent INTEGER NOT NULL DEFAULT 0,

  -- Status
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes             TEXT DEFAULT '',

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS positions_user_id_idx ON positions(user_id);
CREATE INDEX IF NOT EXISTS positions_status_idx ON positions(status);
CREATE INDEX IF NOT EXISTS positions_symbol_token_idx ON positions(symbol_token);

-- ── POSITION SNAPSHOTS TABLE ─────────────────────────────────────────────────
-- Store daily/periodic P&L snapshots for historical tracking
CREATE TABLE IF NOT EXISTS position_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id   UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  cmp           NUMERIC(12, 4) NOT NULL,
  pnl_percent   NUMERIC(8, 4),
  r_multiple    NUMERIC(8, 4),
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapshots_position_id_idx ON position_snapshots(position_id);
CREATE INDEX IF NOT EXISTS snapshots_at_idx ON position_snapshots(snapshot_at);

-- ── USER PREFERENCES TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_strategy      TEXT DEFAULT '5MA Safe',
  default_exchange      TEXT DEFAULT 'NSE',
  default_trailing_pct  INTEGER DEFAULT 100,
  risk_per_trade_pct    NUMERIC(5, 2) DEFAULT 1.0, -- % of portfolio per trade
  theme                 TEXT DEFAULT 'dark',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Users can only see their own data

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Positions policies
CREATE POLICY "Users can view own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON positions FOR DELETE
  USING (auth.uid() = user_id);

-- Snapshots policies (tied to position ownership)
CREATE POLICY "Users can view own snapshots"
  ON position_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_snapshots.position_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own snapshots"
  ON position_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_snapshots.position_id
        AND p.user_id = auth.uid()
    )
  );

-- User preferences policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ── AUTO-UPDATE updated_at TRIGGER ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── REALTIME ─────────────────────────────────────────────────────────────────
-- Enable realtime updates for positions table
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
