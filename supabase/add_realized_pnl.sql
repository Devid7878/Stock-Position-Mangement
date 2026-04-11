-- Add realized_pnl to positions to track partial profit booking
ALTER TABLE positions 
  ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC DEFAULT 0;

-- Comments:
-- realized_pnl: Profit/Loss locked in from partial sells or scaling out.
