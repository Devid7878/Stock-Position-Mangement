-- Add pyramid and SL trail tracking columns to positions table
-- Run this in your Supabase SQL Editor

ALTER TABLE positions 
  ADD COLUMN IF NOT EXISTS pyramid_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS original_sl NUMERIC,
  ADD COLUMN IF NOT EXISTS revised_sl NUMERIC;

-- pyramid_entry: price at which a pyramid (additional) buy was made
-- original_sl: the initial stop loss before any trailing
-- revised_sl: the latest revised/trailed stop loss value
