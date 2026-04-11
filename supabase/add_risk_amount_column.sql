-- Add initial risk amount tracking for R-Multiple calculations
ALTER TABLE positions 
  ADD COLUMN IF NOT EXISTS initial_risk_amount NUMERIC;

-- initial_risk_amount: (Entry Price - Stop Loss) * Shares at time of opening
