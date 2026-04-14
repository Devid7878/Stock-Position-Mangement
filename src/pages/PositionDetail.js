import React, { useState, useMemo } from 'react';
import { usePositions } from '../context/PositionsContext';
import CandlestickChart from '../components/CandlestickChart';
import { useCandleData, useLiveCandle } from '../hooks/useCandleData';
import {
  calcPnlPercent,
  calcPnlAmount,
  calcRMultipleAmount,
  calcDistanceToSL,
  calcEMA,
  formatCurrency,
  formatPercent,
  formatRMultiple,
  formatLargeNumber,
} from '../utils/calculations';
import { ArrowLeft, Plus, Shield, Lock, PieChart } from 'lucide-react';



export default function PositionDetail({ positionId, onBack }) {
  const { positions, getLivePrice, editPosition, sellPosition, loading } = usePositions();
  const position = positions.find((p) => p.id === positionId);

  const isClosed = position?.status === 'closed';

  const [chartInterval] = useState('1Y');
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [showBookProfit, setShowBookProfit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Edit fields
  const [slInput, setSlInput] = useState('');
  const [slQtyInput, setSlQtyInput] = useState('');
  const [pyramidPriceInput, setPyramidPriceInput] = useState('');
  const [pyramidQtyInput, setPyramidQtyInput] = useState('');
  const [bookQtyInput, setBookQtyInput] = useState('');
  const [bookPriceInput, setBookPriceInput] = useState('');
  
  const [showSlEdit, setShowSlEdit] = useState(false);
  const [showPyramidEdit, setShowPyramidEdit] = useState(false);

  const { candles, loading: candlesLoading } = useCandleData(position, chartInterval);

  // ── Calculation ──────────────────────────────────────────
  const initialShares = position?.shares || 0;
  const pyramidShares = position?.pyramid_shares || 0;
  const totalShares = initialShares + pyramidShares;
  const realizedPnl = parseFloat(position?.realized_pnl || 0);
  
  const initialCost = (position?.entry_price || 0) * initialShares;
  const pyramidCost = (position?.pyramid_entry || 0) * pyramidShares;
  const avgBuyPrice = totalShares > 0 ? (initialCost + pyramidCost) / totalShares : position?.entry_price;

  const cmp = position ? getLivePrice(position.symbol_token, isClosed ? position.exit_price : avgBuyPrice) : 0;
  const liveCandles = useLiveCandle(position, candles, cmp);

  const effectivePrice = isClosed ? position?.exit_price : cmp;
  
  // Running P&L + Realized P&L = Total Trade P&L
  const runningPnlAmount = useMemo(() => calcPnlAmount(avgBuyPrice, effectivePrice, totalShares), [avgBuyPrice, effectivePrice, totalShares]);
  const totalPnlAmount = runningPnlAmount + realizedPnl;
  const pnlPercent = useMemo(() => calcPnlPercent(avgBuyPrice, effectivePrice), [avgBuyPrice, effectivePrice]);

  // R Multiple based on Total P/L and Initial Risk Amount
  const initialSL = position?.original_sl || position?.stop_loss;
  const initialRiskAmount = position?.initial_risk_amount || (Math.abs((position?.entry_price || 0) - (initialSL || 0)) * (initialShares + pyramidShares));
  const rMultiple = useMemo(() => calcRMultipleAmount(totalPnlAmount, initialRiskAmount), [totalPnlAmount, initialRiskAmount]);
  const distanceToSL = useMemo(() => calcDistanceToSL(cmp, position?.stop_loss), [cmp, position]);

  const maValues = useMemo(() => {
    if (!liveCandles.length) return {};
    const ema5 = calcEMA(liveCandles, 5);
    const ema10 = calcEMA(liveCandles, 10);
    const sma20 = liveCandles.length >= 20
      ? liveCandles.slice(-20).reduce((s, c) => s + c.close, 0) / 20
      : null;
    return { ema5: ema5[ema5.length - 1]?.value, ema10: ema10[ema10.length - 1]?.value, sma20 };
  }, [liveCandles]);


  const handleSellAll = async () => {
    setShowSellConfirm(false);
    await sellPosition(position.id, cmp);
    onBack();
  };

  // ── Profit Booking (Partial Sell) ─────────────────────────
  const handleBookProfit = async () => {
    setSaveError('');
    const qty = parseInt(bookQtyInput);
    const price = parseFloat(bookPriceInput) || cmp;
    
    if (!qty || qty <= 0 || qty > totalShares) {
      setSaveError(`Invalid quantity. Max available: ${totalShares}`);
      return;
    }

    setSaving(true);
    try {
      // Calculate profit locked in from this portion
      const profitFromPortion = (price - avgBuyPrice) * qty;
      const newRealizedPnl = realizedPnl + profitFromPortion;
      
      // If we are selling the LAST of the shares, just close the position
      if (qty === totalShares) {
        await sellPosition(position.id, price);
        onBack();
      } else {
        // Otherwise, update shares and realized_pnl
        const updates = { realized_pnl: newRealizedPnl };
        if (qty <= pyramidShares) {
          updates.pyramid_shares = pyramidShares - qty;
        } else {
          // Reduction affects initial shares
          const remainingToReduce = qty - pyramidShares;
          updates.pyramid_shares = 0;
          updates.shares = initialShares - remainingToReduce;
        }
        await editPosition(position.id, updates);
        setShowBookProfit(false);
        setBookQtyInput('');
        setBookPriceInput('');
      }
    } catch (err) {
      setSaveError('Booking failed: ' + err.message);
    } finally { setSaving(false); }
  };

  // ── Management Handlers ──────────────────────────────────
  const handleUpdateSL = async (customPrice = null) => {
    setSaveError('');
    const newPrice = customPrice !== null ? customPrice : parseFloat(slInput);
    if (isNaN(newPrice) || newPrice <= 0) return;
    
    setSaving(true);
    try {
      const updates = { stop_loss: newPrice };
      if (slQtyInput) updates.revised_sl_shares = parseInt(slQtyInput);
      if (!position.original_sl) updates.original_sl = position.stop_loss;
      
      await editPosition(position.id, updates);
      setShowSlEdit(false);
      setSlInput('');
      setSlQtyInput('');
    } catch (err) {
      setSaveError('SL update failed: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleAddPyramid = async (customPrice = null) => {
    setSaveError('');
    const price = customPrice !== null ? customPrice : parseFloat(pyramidPriceInput);
    const qty = customPrice !== null ? (position.pyramid_shares || 0) : parseInt(pyramidQtyInput);
    
    if (isNaN(price) || price <= 0) return;
    setSaving(true);
    try {
      await editPosition(position.id, { 
        pyramid_entry: price,
        pyramid_shares: (position.pyramid_shares || 0) + (qty > 0 ? qty : 0)
      });
      setShowPyramidEdit(false);
      setPyramidPriceInput('');
      setPyramidQtyInput('');
    } catch (err) {
      setSaveError('Pyramid save failed: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleChartDrag = async (type, newPrice) => {
    if (type === 'sl') await handleUpdateSL(newPrice);
    if (type === 'pyramid') await handleAddPyramid(newPrice);
    if (type === 'entry') {
      setSaving(true);
      try { await editPosition(position.id, { entry_price: newPrice }); } 
      finally { setSaving(false); }
    }
  };

  if (loading) return <div className="detail-empty"><div className="app-loading" style={{ height: 'auto', background: 'transparent' }}><div className="spinner large" /><span style={{ marginTop: 16 }}>Loading Trade Matrix...</span></div></div>;
  if (!position) return <div className="detail-empty"><button className="back-btn" onClick={onBack}><ArrowLeft size={16}/> Back</button><p>Position not found.</p></div>;

  const isSafe = cmp > (position.stop_loss || 0);
  const isRiskFree = position.stop_loss >= avgBuyPrice;

  return (
    <div className="position-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-left">
          <button className="back-btn icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
          <div className="detail-title-block">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="detail-symbol">{position.symbol}</span>
                <span className="detail-exchange">{position.exchange}</span>
                {isClosed ? (
                  <span className="safe-badge danger"><Lock size={11} style={{ marginRight: 4 }} /> CLOSED</span>
                ) : isRiskFree ? (
                  <span className="safe-badge safe"><Shield size={11} style={{ marginRight: 4 }} /> Risk Free</span>
                ) : (
                  <span className={`safe-badge ${isSafe ? 'safe' : 'danger'}`}>{isSafe ? position.strategy : 'Below SL'}</span>
                )}
              </div>
              <div className="detail-entry-info">
                Avg Buy <strong>{formatCurrency(avgBuyPrice)}</strong> · {totalShares} shares · {formatLargeNumber(avgBuyPrice * totalShares)} pos
              </div>
            </div>
          </div>
        </div>
        {!isClosed && (
          <div className="detail-header-actions">
             <button className="btn-secondary" onClick={() => setShowBookProfit(!showBookProfit)} style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}>
              <PieChart size={16} /> Book Profit
            </button>
            <button className="btn-primary" onClick={() => setShowSellConfirm(true)} style={{ background: 'var(--red)' }}>Sell All</button>
          </div>
        )}
      </div>

      {saveError && <div className="save-error-banner">⚠ {saveError}</div>}
      
      {/* Partial Profit Booking Form */}
      {showBookProfit && !isClosed && (
        <div className="book-profit-panel">
          <div className="sub-label">Partial Profit Booking / Scale Out</div>
          <div className="edit-form-row">
            <input type="number" value={bookQtyInput} onChange={(e) => setBookQtyInput(e.target.value)} placeholder={`Qty to sell (max ${totalShares})`} className="sl-input" />
            <input type="number" step="0.05" value={bookPriceInput} onChange={(e) => setBookPriceInput(e.target.value)} placeholder={`At Price (default ${cmp})`} className="sl-input" />
            <button className="btn-primary btn-sm" style={{ background: 'var(--teal)' }} onClick={handleBookProfit} disabled={saving || !bookQtyInput}>
              {saving ? '...' : `Book ₹${((parseFloat(bookPriceInput || cmp) - avgBuyPrice) * parseInt(bookQtyInput || 0)).toFixed(0)}`}
            </button>
          </div>
        </div>
      )}

      <div className="detail-panels">
        {/* P&L Panel */}
        <div className="panel pnl-panel">
          <div className="panel-label">OVERALL TRADE PERFORMANCE</div>
          <div className={`panel-main-value ${totalPnlAmount >= 0 ? 'positive' : 'negative'}`}>
            {formatPercent((totalPnlAmount / (initialCost + pyramidCost)) * 100)}
          </div>
          <div className="panel-secondary">
            <span className={`r-badge ${rMultiple > 0 ? 'positive' : rMultiple < 0 ? 'negative' : 'neutral'}`}>
              {formatRMultiple(rMultiple)}
            </span>
            <span className={`amount-chip ${totalPnlAmount >= 0 ? 'positive' : 'negative'}`}>
              {totalPnlAmount >= 0 ? '+' : ''}{formatCurrency(totalPnlAmount, 0)}
            </span>
          </div>
          <div className="entry-breakdown">
             <span>Running: {formatCurrency(runningPnlAmount, 0)}</span>
             {realizedPnl !== 0 && <span style={{ color: 'var(--teal)' }}>Realized: {formatCurrency(realizedPnl, 0)} ✅</span>}
          </div>
        </div>

        {/* Management Panel */}
        {!isClosed && (
          <div className="panel sl-panel">
            <div className="panel-label">MANAGEMENT & TRAILING</div>
            <div className="sl-current">
              <div>
                <div className="sub-label">CURRENT SL</div>
                <div className="panel-main-value" style={{ fontSize: 28, marginBottom: 0 }}>{formatCurrency(position.stop_loss)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="sub-label">DISTANCE</div>
                <div className={`panel-main-value ${distanceToSL > 3 ? 'positive' : 'negative'}`} style={{ fontSize: 24, marginBottom: 0 }}>{formatPercent(distanceToSL)}</div>
              </div>
            </div>

            <div className="sl-actions">
              <button className="btn-secondary" onClick={() => handleUpdateSL(maValues.ema5)}>Trail to 5MA</button>
              <button className="btn-secondary" onClick={() => handleUpdateSL(avgBuyPrice)}>Risk Free</button>
              <button className={`btn-secondary ${showSlEdit ? 'active' : ''}`} onClick={() => setShowSlEdit(!showSlEdit)}>Custom SL</button>
            </div>

            {showSlEdit && (
              <div className="edit-form-row">
                <input type="number" step="0.05" value={slInput} onChange={(e) => setSlInput(e.target.value)} placeholder="New SL Price" className="sl-input" />
                <button className="btn-primary btn-sm" onClick={() => handleUpdateSL()}>Update</button>
              </div>
            )}

            <div className="pyramid-section">
              <div className="sub-label">PYRAMID QUANTITY POSITION</div>
              {pyramidShares > 0 ? (
                <div className="pyramid-info">
                  <div className="py-vals">
                    <span className="py-price">{formatCurrency(position.pyramid_entry)}</span>
                    <span className="py-qty">× {pyramidShares} shares</span>
                  </div>
                  <button className="btn-icon-sm" onClick={() => setShowPyramidEdit(true)}><Plus size={14}/></button>
                </div>
              ) : (
                <button className="btn-secondary" onClick={() => setShowPyramidEdit(!showPyramidEdit)}><Plus size={14}/> Add Pyramid</button>
              )}
              
              {showPyramidEdit && (
                <div className="edit-form-row">
                  <input type="number" step="0.05" value={pyramidPriceInput} onChange={(e) => setPyramidPriceInput(e.target.value)} placeholder="Avg Price" className="sl-input" />
                  <input type="number" value={pyramidQtyInput} onChange={(e) => setPyramidQtyInput(e.target.value)} placeholder="Shares" className="sl-input" style={{ maxWidth: 80 }} />
                  <button className="btn-primary btn-sm" onClick={() => handleAddPyramid()}>Save</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="detail-chart-section">
        <div className="chart-toolbar">
          <div className="chart-symbol-info">
            <span className="chart-symbol-name">{position.symbol}</span>
            <span className={`chart-pnl-badge ${pnlPercent >= 0 ? 'positive' : 'negative'}`}>{formatPercent(pnlPercent)}</span>
          </div>
          <div className="ma-legend"><span className="ma-pill m1">● 5 EMA</span><span className="ma-pill m3">● 20 SMA</span></div>
        </div>
        {candlesLoading ? <div className="chart-loading"><div className="spinner" /><span>Loading...</span></div> : (
          <CandlestickChart
            candles={liveCandles}
            entryPrice={avgBuyPrice}
            stopLoss={position.stop_loss}
            originalSL={initialSL}
            onDragEnd={handleChartDrag}
            height={460}
          />
        )}
      </div>

      {/* Sell Confirm */}
      {showSellConfirm && (
        <div className="modal-overlay" onClick={() => setShowSellConfirm(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Exit</h3>
            <p>Exit all <strong>{totalShares} shares</strong> of {position.symbol} at CMP <strong>{formatCurrency(cmp)}</strong>?</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setShowSellConfirm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSellAll} style={{ background: 'var(--red)' }}>Exit Position</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
