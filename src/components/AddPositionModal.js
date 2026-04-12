import React, { useState, useCallback, useRef } from 'react';
import { usePositions } from '../context/PositionsContext';
import angelOneService from '../services/angelOne';
import { X, Search, TrendingUp } from 'lucide-react';

const STRATEGIES = ['5MA Safe', '10MA Trend', '20MA Swing', 'Custom'];
const EXCHANGES = ['NSE', 'BSE', 'NFO', 'MCX'];

export default function AddPositionModal({ onClose }) {
  const { addPosition } = usePositions();
  const [step, setStep] = useState(1); // 1=search, 2=details
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [formData, setFormData] = useState({
    entryPrice: '',
    shares: '',
    stopLoss: '',
    strategy: '5MA Safe',
    exchange: 'NSE',
    notes: '',
    broker: 'upstox',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef(null);

  const handleSearch = useCallback((value) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) { setSearchResults([]); return; }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await angelOneService.searchSymbol(value, formData.exchange);
        setSearchResults(results?.data || []);
      } catch (err) {
        setError('Symbol search failed. Check backend connection.');
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [formData.exchange]);

  const handleSelectSymbol = async (sym) => {
    setSelectedSymbol(sym);
    setStep(2);
    try {
      const ltp = await angelOneService.getLTP(formData.exchange, sym.symboltoken, sym.tradingsymbol);
      if (ltp) {
        setFormData(prev => ({ ...prev, entryPrice: ltp.toString() }));
      }
    } catch (err) {
      console.warn('Auto-CMP load failed');
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const positionSize = () => {
    const ep = parseFloat(formData.entryPrice);
    const sh = parseInt(formData.shares);
    if (!ep || !sh) return '—';
    return `₹${(ep * sh).toLocaleString('en-IN')}`;
  };

  const handleSave = async () => {
    if (!selectedSymbol) return;
    const ep = parseFloat(formData.entryPrice);
    const sh = parseInt(formData.shares);
    const sl = parseFloat(formData.stopLoss);
    if (!ep || !sh || !sl) { setError('Please fill all required fields'); return; }
    if (sl >= ep) { setError('Stop loss must be below entry price'); return; }

    setSaving(true);
    setError('');
    try {
      await addPosition({
        symbol: selectedSymbol.tradingsymbol || selectedSymbol.name,
        tradingSymbol: selectedSymbol.tradingsymbol,
        exchange: formData.exchange,
        symbolToken: selectedSymbol.symboltoken,
        entryPrice: ep,
        shares: sh,
        stopLoss: sl,
        originalSL: sl, // Permanent reference to initial risk
        initialRiskAmount: Math.abs(ep - sl) * sh,
        strategy: formData.strategy,
        notes: formData.notes,
        broker: formData.broker,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add position');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-block">
            <TrendingUp size={18} />
            <h3>{step === 1 ? 'Search Symbol' : `Add ${selectedSymbol?.tradingsymbol}`}</h3>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        {step === 1 && (
          <div className="modal-body">
            <div className="exchange-tabs">
              {EXCHANGES.map((ex) => (
                <button
                  key={ex}
                  className={`exchange-tab ${formData.exchange === ex ? 'active' : ''}`}
                  onClick={() => handleChange('exchange', ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type stock name or symbol..."
                autoFocus
              />
            </div>
            {searching && <div className="search-loading">Searching...</div>}
            <div className="search-results">
              {searchResults.map((sym) => (
                <button
                  key={sym.symboltoken}
                  className="search-result-item"
                  onClick={() => handleSelectSymbol(sym)}
                >
                  <span className="result-symbol">{sym.tradingsymbol}</span>
                  <span className="result-name">{sym.name}</span>
                  <span className="result-exchange">{sym.exch_seg}</span>
                </button>
              ))}
              {!searching && query && !searchResults.length && (
                <div className="no-results">No results for "{query}"</div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="modal-body">
            <button className="back-btn" onClick={() => setStep(1)}>← Back to search</button>

            <div className="selected-symbol-info">
              <span className="sel-symbol">{selectedSymbol?.tradingsymbol}</span>
              <span className="sel-exchange">{formData.exchange}</span>
              <span className="sel-name">{selectedSymbol?.name}</span>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ marginBottom: 8, display: 'block' }}>Broker Fees Model</label>
                <div className="exchange-tabs">
                  <button className={`exchange-tab ${formData.broker === 'upstox' ? 'active' : ''}`} onClick={() => handleChange('broker', 'upstox')}>Upstox</button>
                  <button className={`exchange-tab ${formData.broker === 'zerodha' ? 'active' : ''}`} onClick={() => handleChange('broker', 'zerodha')}>Zerodha</button>
                </div>
              </div>
              <div className="form-group">
                <label>Entry Price *</label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.entryPrice}
                  onChange={(e) => handleChange('entryPrice', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Shares *</label>
                <input
                  type="number"
                  value={formData.shares}
                  onChange={(e) => handleChange('shares', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Stop Loss *</label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.stopLoss}
                  onChange={(e) => handleChange('stopLoss', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Strategy</label>
                <select
                  value={formData.strategy}
                  onChange={(e) => handleChange('strategy', e.target.value)}
                >
                  {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="position-summary">
              <div className="sum-item">
                <span>Position Size</span>
                <strong>{positionSize()}</strong>
              </div>
              <div className="sum-item">
                <span>Risk Per Share</span>
                <strong>
                  {formData.entryPrice && formData.stopLoss
                    ? `₹${(parseFloat(formData.entryPrice) - parseFloat(formData.stopLoss)).toFixed(2)}`
                    : '—'}
                </strong>
              </div>
              <div className="sum-item">
                <span>Total Risk</span>
                <strong>
                  {formData.entryPrice && formData.stopLoss && formData.shares
                    ? `₹${((parseFloat(formData.entryPrice) - parseFloat(formData.stopLoss)) * parseInt(formData.shares)).toLocaleString('en-IN')}`
                    : '—'}
                </strong>
              </div>
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Trade rationale, setup notes..."
                rows={2}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Adding...' : 'Add Position'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
