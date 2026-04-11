import React, { useState } from 'react';
import { Calculator, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

export default function PositionSizeCalc() {
  const [mode, setMode] = useState('percent'); // 'percent' | 'amount'
  const [totalCapital, setTotalCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [riskAmount, setRiskAmount] = useState(1000);
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  // Determine the effective risk amount based on mode
  const effectiveRisk = mode === 'percent'
    ? (parseFloat(totalCapital) * parseFloat(riskPercent)) / 100
    : parseFloat(riskAmount) || 0;

  const riskPerShare = entryPrice && stopLoss
    ? parseFloat(entryPrice) - parseFloat(stopLoss)
    : 0;

  const sharesToBuy = riskPerShare > 0 ? Math.floor(effectiveRisk / riskPerShare) : 0;
  const positionSize = sharesToBuy * (parseFloat(entryPrice) || 0);
  const capitalUsedPct = totalCapital > 0 && positionSize > 0
    ? ((positionSize / parseFloat(totalCapital)) * 100).toFixed(1)
    : 0;

  // R:R targets
  const targets = riskPerShare > 0 ? [1, 2, 3, 5].map(r => ({
    r,
    price: (parseFloat(entryPrice) + riskPerShare * r).toFixed(2),
    profit: (sharesToBuy * riskPerShare * r).toFixed(0),
  })) : [];

  return (
    <div className="calc-page">
      <div className="calc-header">
        <Calculator size={20} />
        <h2>Position Size Calculator</h2>
      </div>

      <div className="calc-layout">
        {/* Input Section */}
        <div className="calc-inputs">
          {/* Risk Mode Toggle */}
          <div className="calc-mode-toggle">
            <button
              className={`mode-btn ${mode === 'percent' ? 'active' : ''}`}
              onClick={() => setMode('percent')}
            >
              Risk by %
            </button>
            <button
              className={`mode-btn ${mode === 'amount' ? 'active' : ''}`}
              onClick={() => setMode('amount')}
            >
              Risk by ₹
            </button>
          </div>

          <div className="form-group">
            <label>Total Capital (₹)</label>
            <input
              type="number"
              value={totalCapital}
              onChange={(e) => setTotalCapital(e.target.value)}
              placeholder="100000"
            />
          </div>

          {mode === 'percent' ? (
            <div className="form-group">
              <label>Risk % of Capital</label>
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                placeholder="1"
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Risk Amount (₹)</label>
              <input
                type="number"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Entry Price (₹)</label>
              <input
                type="number"
                step="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Stop Loss (₹)</label>
              <input
                type="number"
                step="0.05"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {riskPerShare <= 0 && entryPrice && stopLoss && (
            <div className="calc-error">
              <AlertCircle size={14} /> Stop loss must be below entry price
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="calc-results">
          <div className="calc-result-card primary">
            <span className="cr-label">Shares to Buy</span>
            <span className="cr-value">{sharesToBuy}</span>
          </div>

          <div className="calc-result-grid">
            <div className="calc-result-card">
              <span className="cr-label">Position Size</span>
              <span className="cr-value">{formatCurrency(positionSize, 0)}</span>
            </div>
            <div className="calc-result-card">
              <span className="cr-label">Risk Amount</span>
              <span className="cr-value" style={{ color: 'var(--red)' }}>
                {formatCurrency(effectiveRisk, 0)}
              </span>
            </div>
            <div className="calc-result-card">
              <span className="cr-label">Risk/Share</span>
              <span className="cr-value">{formatCurrency(riskPerShare, 2)}</span>
            </div>
            <div className="calc-result-card">
              <span className="cr-label">Capital Used</span>
              <span className="cr-value">{capitalUsedPct}%</span>
            </div>
          </div>

          {/* R:R Targets */}
          {targets.length > 0 && (
            <div className="calc-targets">
              <h4>Reward Targets</h4>
              <div className="target-grid">
                {targets.map(t => (
                  <div key={t.r} className="target-item">
                    <span className="target-r">{t.r}R</span>
                    <span className="target-price">{formatCurrency(parseFloat(t.price))}</span>
                    <span className="target-profit positive">+{formatCurrency(parseFloat(t.profit), 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
