import { supabase } from './supabase';

// ── POSITIONS ──────────────────────────────────────────────────────────────────

export async function fetchPositions(userId) {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchPosition(positionId, userId) {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('id', positionId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createPosition(userId, positionData) {
  const { data, error } = await supabase
    .from('positions')
    .insert([
      {
        user_id: userId,
        symbol: positionData.symbol,
        trading_symbol: positionData.tradingSymbol,
        exchange: positionData.exchange,
        symbol_token: positionData.symbolToken,
        entry_price: positionData.entryPrice,
        shares: positionData.shares,
        strategy: positionData.strategy || '5MA Safe',
        stop_loss: positionData.stopLoss,
        original_sl: positionData.originalSL || positionData.stopLoss,
        initial_risk_amount: positionData.initialRiskAmount || 0,
        trailing_percent: positionData.trailingPercent || 100,
        bucket_sold_percent: positionData.bucketSoldPercent || 0,
        status: 'active',
        notes: positionData.notes || '',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePosition(positionId, userId, updates) {
  const { data, error } = await supabase
    .from('positions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', positionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function closePosition(positionId, userId, exitPrice) {
  const { data, error } = await supabase
    .from('positions')
    .update({
      status: 'closed',
      exit_price: exitPrice,
      exit_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', positionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePosition(positionId, userId) {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', positionId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ── POSITION SNAPSHOTS (for historical P&L tracking) ────────────────────────

export async function savePositionSnapshot(positionId, cmp, pnlPercent, rMultiple) {
  const { error } = await supabase.from('position_snapshots').insert([
    {
      position_id: positionId,
      cmp,
      pnl_percent: pnlPercent,
      r_multiple: rMultiple,
      snapshot_at: new Date().toISOString(),
    },
  ]);
  if (error) console.error('Snapshot save error:', error);
}

// ── USER PREFERENCES ─────────────────────────────────────────────────────────

export async function fetchUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertUserPreferences(userId, prefs) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
