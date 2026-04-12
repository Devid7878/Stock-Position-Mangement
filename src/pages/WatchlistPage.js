import React, { useState, useEffect, useMemo } from 'react';
import angelOneService from '../services/angelOne';
import { usePositions } from '../context/PositionsContext';
import { useAlerts } from '../context/AlertsContext';
import { Search, Plus, Bell, Star, ChevronDown, ChevronRight, X, Trash2, SmartphoneNfc } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

export default function WatchlistPage() {
  const { getLivePrice } = usePositions();
  const { alerts, addAlert, removeAlert, toggleAlert } = useAlerts();

  const [watchlists, setWatchlists] = useState(() => {
    try {
      const stored = localStorage.getItem('terminal_watchlists');
      return stored ? JSON.parse(stored) : [{ id: 1, name: 'Default Watchlist', symbols: [], expanded: true }];
    } catch {
      return [{ id: 1, name: 'Default Watchlist', symbols: [], expanded: true }];
    }
  });

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [activeWatchlistId, setActiveWatchlistId] = useState(1);
  const [showAlertModal, setShowAlertModal] = useState(null); // holds symbol obj

  useEffect(() => {
    localStorage.setItem('terminal_watchlists', JSON.stringify(watchlists));
  }, [watchlists]);

  useEffect(() => {
    if (!query) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await angelOneService.searchSymbol(query, 'NSE');
        setSearchResults(res?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const createWatchlist = () => {
    const name = window.prompt("Enter Watchlist Name:");
    if (!name) return;
    setWatchlists(prev => [...prev, { id: Date.now(), name, symbols: [], expanded: true }]);
  };

  const deleteWatchlist = (id) => {
    if (watchlists.length === 1) return alert("Cannot delete the last watchlist");
    if (window.confirm("Delete this watchlist?")) {
      setWatchlists(prev => prev.filter(w => w.id !== id));
      if (activeWatchlistId === id) setActiveWatchlistId(watchlists[0].id);
    }
  };

  const toggleExpand = (id) => {
    setWatchlists(prev => prev.map(w => w.id === id ? { ...w, expanded: !w.expanded } : w));
  };

  const addSymbolToWatchlist = (symbol, wId) => {
    setWatchlists(prev => prev.map(w => {
      if (w.id === wId) {
        if (w.symbols.find(s => s.symboltoken === symbol.symboltoken)) return w;
        return { ...w, symbols: [...w.symbols, symbol], expanded: true };
      }
      return w;
    }));
    setQuery('');
  };

  const removeSymbol = (wId, symbolToken) => {
    setWatchlists(prev => prev.map(w => {
      if (w.id === wId) {
        return { ...w, symbols: w.symbols.filter(s => s.symboltoken !== symbolToken) };
      }
      return w;
    }));
  };

  const AlertModal = () => {
    const sym = showAlertModal;
    const ltp = getLivePrice(sym.symboltoken);
    const [price, setPrice] = useState(ltp || '');
    const [dir, setDir] = useState('above');
    
    if (!sym) return null;
    
    const save = () => {
      if (!price) return;
      addAlert(sym.symboltoken, sym.tradingsymbol, price, 'price', dir);
      setShowAlertModal(null);
    };

    return (
      <div className="modal-overlay" onClick={() => setShowAlertModal(null)}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth: 380}}>
          <div className="modal-header">
            <h3>Set Alert for {sym.tradingsymbol}</h3>
            <button className="modal-close" onClick={() => setShowAlertModal(null)}><X size={18}/></button>
          </div>
          <div className="modal-body">
            <div style={{ padding: 12, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 8, fontSize: 13, marginBottom: 10, display:'flex', gap: 10 }}>
               <SmartphoneNfc size={20} /> Browser bell & Push notifications will trigger when condition is met.
            </div>
            <div className="form-group">
              <label>Trigger Condition</label>
              <select value={dir} onChange={e => setDir(e.target.value)}>
                <option value="above">Price Rises Above (Buy/Target Trigger)</option>
                <option value="below">Price Drops Below (SL/Sell Trigger)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Target Price</label>
              <input type="number" step="0.05" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <p style={{fontSize: 12, color: 'var(--text-muted)'}}>Current LTP: {ltp ? formatCurrency(ltp) : 'Loading...'}</p>
            <div className="modal-actions" style={{marginTop: 10}}>
              <button className="btn-primary" onClick={save}>Set Alert</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="dashboard-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="dashboard-title"><Star className="title-icon" /> Watchlist & Alerts</h2>
          <p className="dashboard-subtitle">Track your favorite indices and set server-side push notifications.</p>
        </div>
        <button className="btn-secondary" onClick={createWatchlist}><Plus size={14}/> New List</button>
      </div>

      <div className="form-group" style={{ position: 'relative', marginBottom: 24, zIndex: 50 }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input 
            className="search-input" 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            placeholder="Search stocks to add to active watchlist..." 
            style={{ padding: '14px 14px 14px 40px', fontSize: 16 }}
          />
        </div>
        {query && (
          <div className="search-results" style={{ position: 'absolute', top: 52, width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
            {searching ? <div className="search-loading">Searching...</div> : 
             searchResults.map(s => (
               <div key={s.symboltoken} className="search-result-item" style={{display:'flex', justifyContent:'space-between'}}>
                 <div>
                   <span className="result-symbol">{s.tradingsymbol}</span>
                   <span className="result-name">{s.name}</span>
                 </div>
                 <select onChange={(e) => { 
                   if(e.target.value) { addSymbolToWatchlist(s, parseInt(e.target.value)); e.target.value="";} 
                 }} style={{ width: 120, fontSize: 12, padding: '4px 8px' }}>
                   <option value="">Add To...</option>
                   {watchlists.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                 </select>
               </div>
             ))
            }
          </div>
        )}
      </div>

      <div className="watchlist-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {watchlists.map(w => (
            <div key={w.id} className="glass-panel" style={{ padding: 16, gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(w.id)}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, margin: 0 }}>
                  {w.expanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                  {w.name}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({w.symbols.length})</span>
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                   <button className="btn-icon-sm" onClick={(e) => { e.stopPropagation(); deleteWatchlist(w.id); }}><Trash2 size={14}/></button>
                </div>
              </div>
              
              {w.expanded && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {w.symbols.length === 0 ? <p style={{fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 24}}>No symbols added.</p> : 
                    w.symbols.map(s => {
                      const ltp = getLivePrice(s.symboltoken);
                      return (
                        <div key={s.symboltoken} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.tradingsymbol}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.name}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className="hero-value" style={{ fontSize: 16 }}>{ltp ? formatCurrency(ltp) : '...'}</div>
                            <button className="btn-icon-sm" style={{color: 'var(--amber)'}} onClick={(e) => { e.stopPropagation(); setShowAlertModal(s); }} title="Set Alert"><Bell size={14}/></button>
                            <button className="btn-icon-sm" style={{color: 'var(--red)'}} onClick={(e) => { e.stopPropagation(); removeSymbol(w.id, s.symboltoken); }}><X size={14}/></button>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
           <h3 style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={16} color="var(--amber)"/> Active Phone/Push Alerts</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
             {alerts.length === 0 ? <p style={{fontSize: 13, color: 'var(--text-muted)'}}>No active alerts configured.</p> :
              alerts.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--bg-input)', borderRadius: 8, opacity: a.active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{a.tradingSymbol}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.direction === 'above' ? 'Rise above' : 'Drop below'} {formatCurrency(a.targetPrice)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                     <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                       <input type="checkbox" checked={a.active} onChange={() => toggleAlert(a.id)} />
                     </label>
                     <button className="btn-icon-sm" onClick={() => removeAlert(a.id)}><X size={12}/></button>
                  </div>
                </div>
              ))
             }
           </div>
        </div>
      </div>
      {showAlertModal && <AlertModal />}
    </div>
  );
}
