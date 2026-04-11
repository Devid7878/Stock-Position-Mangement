-- Add quantity-based pyramid and revised SL tracking
ALTER TABLE positions 
  ADD COLUMN IF NOT EXISTS pyramid_shares INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revised_sl_shares INTEGER DEFAULT 0;

-- Comments for clarity:
-- pyramid_shares: number of additional shares bought at pyramid_entry price
-- revised_sl_shares: number of shares assigned to the revised_sl price level
