// ── P&L Calculations ──────────────────────────────────────────────────────────

export function calcPnlPercent(entryPrice, cmp) {
  if (!entryPrice || !cmp) return 0;
  return ((cmp - entryPrice) / entryPrice) * 100;
}

export function calcPnlAmount(entryPrice, cmp, shares) {
  if (!entryPrice || !cmp || !shares) return 0;
  return (cmp - entryPrice) * shares;
}

export function calcRMultiple(entryPrice, cmp, stopLoss) {
  if (!entryPrice || !cmp || !stopLoss) return 0;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  const gain = cmp - entryPrice;
  return gain / risk;
}

export function calcRMultipleAmount(pnlAmount, initialRiskAmount) {
  if (!initialRiskAmount || initialRiskAmount === 0) return 0;
  return pnlAmount / initialRiskAmount;
}

export function calcPositionSize(entryPrice, shares) {
  return entryPrice * shares;
}

export function calcDistanceToSL(cmp, stopLoss) {
  if (!cmp || !stopLoss) return 0;
  return ((cmp - stopLoss) / cmp) * 100;
}

// ── Moving Averages ───────────────────────────────────────────────────────────

export function calcSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    return { time: data[i].time, value: avg };
  }).filter(Boolean);
}

export function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = null;

  data.forEach((d, i) => {
    if (i === 0) {
      ema = d.close;
    } else {
      ema = d.close * k + ema * (1 - k);
    }
    if (i >= period - 1) {
      result.push({ time: d.time, value: ema });
    }
  });

  return result;
}

// ── Stop Loss Calculations ────────────────────────────────────────────────────

export function calc5MAStopLoss(candles) {
  // 5MA Safe: SL = 5 EMA value
  if (!candles || candles.length < 5) return null;
  const last5 = candles.slice(-5);
  const sma5 = last5.reduce((sum, c) => sum + c.close, 0) / 5;
  return sma5;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount, decimals = 2) {
  if (amount === null || amount === undefined) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}%`;
}

export function formatRMultiple(value) {
  if (value === null || value === undefined) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)}R`;
}

export function formatLargeNumber(num) {
  if (!num) return '—';
  if (num >= 1e7) return `${(num / 1e7).toFixed(1)} Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(1)} L`;
  return num.toLocaleString('en-IN');
}

// ── Date Helpers ──────────────────────────────────────────────────────────────

export function getDateRange(days) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return { fromDate: fmt(fromDate), toDate: fmt(toDate) };
}

export function intervalToDays(interval) {
  const map = { ONE_DAY: 365, ONE_WEEK: 365, ONE_MONTH: 365 };
  return map[interval] || 365;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export function getPnlColor(value) {
  if (value > 0) return '#22c55e';
  if (value < 0) return '#ef4444';
  return '#94a3b8';
}

export function getStatusColor(status) {
  if (status === 'active') return '#22c55e';
  if (status === 'closed') return '#94a3b8';
  return '#f59e0b';
}
