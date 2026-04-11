import React, { useMemo } from 'react';
import { usePositions } from '../context/PositionsContext';
import CandlestickChart from './CandlestickChart';
import { useCandleData } from '../hooks/useCandleData';
import {
  calcPnlPercent,
  calcPnlAmount,
  calcRMultiple,
  formatCurrency,
  formatPercent,
  formatRMultiple,
} from '../utils/calculations';

export default function PositionCard({ position, onClick }) {
  const { getLivePrice } = usePositions();
  const cmp = getLivePrice(position.symbol_token, position.entry_price);
  const { candles } = useCandleData(position);

  const pnlPercent = useMemo(
    () => calcPnlPercent(position.entry_price, cmp),
    [position.entry_price, cmp]
  );
  const pnlAmount = useMemo(
    () => calcPnlAmount(position.entry_price, cmp, position.shares),
    [position.entry_price, cmp, position.shares]
  );
  const rMultiple = useMemo(
    () => calcRMultiple(position.entry_price, cmp, position.original_sl || position.stop_loss),
    [position.entry_price, cmp, position.original_sl, position.stop_loss]
  );

  const isPositive = pnlPercent >= 0;
  const holdingDays = useMemo(() => {
    const diff = Date.now() - new Date(position.created_at).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [position.created_at]);

  return (
    <div className={`position-card ${isPositive ? 'positive' : 'negative'}`} onClick={onClick}>
      <div className="card-header">
        <div className="card-title-block">
          <h3 className="card-symbol">{position.symbol}</h3>
          <div className="card-meta">
            <span className="strategy-badge">{position.strategy}</span>
            <span className="holding-days">{holdingDays}d</span>
          </div>
        </div>
        <div className={`pnl-bubble ${isPositive ? 'positive' : 'negative'}`}>
          {formatPercent(pnlPercent)}
          {position.stop_loss >= position.entry_price && (
            <div className="risk-free-badge">RISK FREE</div>
          )}
        </div>
      </div>

      <div className="card-chart">
        <CandlestickChart
          candles={candles}
          entryPrice={position.entry_price}
          height={160}
          showMAs={false}
          compact
        />
      </div>

      <div className="card-stats">
        <div className="stat-item">
          <span className="stat-label">Entry</span>
          <span className="stat-value">{formatCurrency(position.entry_price)}</span>
        </div>
        <div className="stat-item" style={{ textAlign: 'right' }}>
          <span className="stat-label">
            CMP <span className={`r-badge ${rMultiple > 0 ? 'positive' : rMultiple < 0 ? 'negative' : 'neutral'}`}>{formatRMultiple(rMultiple)}</span>
          </span>
          <span className={`stat-value live ${isPositive ? 'positive' : 'negative'}`}>
            {formatCurrency(cmp)}
          </span>
        </div>
      </div>
    </div>
  );
}
