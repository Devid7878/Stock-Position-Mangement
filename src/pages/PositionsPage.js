import React, { useState, useMemo, lazy, Suspense } from 'react';
import { usePositions } from '../context/PositionsContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PositionCard from '../components/PositionCard';
import AddPositionModal from '../components/AddPositionModal';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import { formatCurrency, formatPercent, formatRMultiple } from '../utils/calculations';
import {
  Plus, RefreshCw, LayoutGrid, List,
  LogOut, Sun, Moon, Calculator, Table,
  BarChart2, Wallet, ExternalLink, Star
} from 'lucide-react';

const WatchlistPage = lazy(() => import('./WatchlistPage'));
const PositionSizeCalc = lazy(() => import('../components/PositionSizeCalc'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));

export default function PositionsPage({ onSelectPosition }) {
  const {
    positions, filteredPositions,
    loadPositions,
    setFilter,
    getLivePrice,
  } = usePositions();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('active');

  const [capital, setCapital] = useState(() => parseFloat(localStorage.getItem('terminal_capital')) || 1000000);
  const [showCapitalEdit, setShowCapitalEdit] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'calculator' || tab === 'analytics') return;
    setFilter(tab === 'all' ? 'all' : tab === 'closed' ? 'closed' : 'active');
  };

  const handleCapitalUpdate = (val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) { setCapital(num); localStorage.setItem('terminal_capital', num.toString()); }
  };

  // ── Stats Calculation ───────────────────────────────────
  const stats = useMemo(() => {
    let totalPnl = 0, openRisk = 0, riskFreeCount = 0, atRiskCount = 0;
    
    positions.forEach((p) => {
      const cmp = getLivePrice(p.symbol_token, p.entry_price);
      const totalShares = (p.shares || 0) + (p.pyramid_shares || 0);
      const realized = parseFloat(p.realized_pnl || 0);

      if (p.status === 'active') {
        const cost = (p.entry_price * p.shares) + ((p.pyramid_entry || 0) * (p.pyramid_shares || 0));
        const value = cmp * totalShares;
        totalPnl += (value - cost) + realized;

        const avgPrice = totalShares > 0 ? cost / totalShares : p.entry_price;
        if (p.stop_loss >= avgPrice) riskFreeCount++; else {
          atRiskCount++;
          openRisk += Math.abs(cmp - p.stop_loss) * totalShares;
        }
      } else {
        totalPnl += ((p.exit_price - p.entry_price) * p.shares) + realized;
      }
    });

    return { totalPnl, openRisk, riskFreeCount, atRiskCount, accountIncrement: (totalPnl / capital) * 100 };
  }, [positions, getLivePrice, capital]);

  const closedPositions = useMemo(() => 
    positions.filter(p => p.status === 'closed').sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))
  , [positions]);

  return (
    <div className="positions-page">
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="logo-mark" style={{ width: 32, height: 32, marginRight: 10 }}>
            {user?.user_metadata?.company_logo ? (
              <img src={user.user_metadata.company_logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#6366f1" />
                <path d="M8 22L14 10L20 18L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div>
            <div className="brand-label" style={{ textTransform: 'uppercase' }}>
              {user?.user_metadata?.company_name || 'Trade Intelligence'}
            </div>
            <div className="brand-name">Trader Terminal</div>
          </div>
        </div>
        <div className="navbar-center">
          <button className={`nav-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => handleTabChange('active')}>Active</button>
          <button className={`nav-tab ${activeTab === 'closed' ? 'active' : ''}`} onClick={() => handleTabChange('closed')}><Table size={13} /> Trades</button>
          <button className={`nav-tab ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => handleTabChange('watchlist')}><Star size={13} /> Watchlist</button>
          <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => handleTabChange('analytics')}><BarChart2 size={13} /> Analytics</button>
          <button className={`nav-tab ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => handleTabChange('calculator')}><Calculator size={13} /> Calc</button>
        </div>
        <div className="navbar-right">
          <button className="btn-icon" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button className="btn-secondary btn-sm" onClick={() => loadPositions()}><RefreshCw size={14} /></button>
          <button className="btn-add" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add Trade</button>
          
          <div className="user-profile-nav" onClick={() => setShowProfileModal(true)}>
            <img 
              src={useMemo(() => (
                user?.user_metadata?.avatar_url || 
                `https://ui-avatars.com/api/?name=${user?.user_metadata?.full_name || 'U'}&background=6366f1&color=fff`
              ), [user])} 
              alt="Avatar" 
              className="nav-avatar" 
            />
            <span className="nav-username">{user?.user_metadata?.full_name?.split(' ')[0] || 'User'}</span>
          </div>

          <button className="btn-icon-sm" onClick={signOut}><LogOut size={14} /></button>
        </div>
      </nav>

      <main className="positions-main">
        {activeTab === 'calculator' && (
          <Suspense fallback={<div className="app-loading"><div className="spinner large" /><span>Loading Engine...</span></div>}>
            <PositionSizeCalc />
          </Suspense>
        )}
        {activeTab === 'analytics' && (
          <Suspense fallback={<div className="app-loading"><div className="spinner large" /><span>Analyzing Computations...</span></div>}>
            <AnalyticsPage />
          </Suspense>
        )}
        {activeTab === 'watchlist' && (
          <Suspense fallback={<div className="app-loading"><div className="spinner large" /><span>Loading Assets...</span></div>}>
            <WatchlistPage />
          </Suspense>
        )}

        {activeTab === 'active' && (
          <>
            <div className="portfolio-summary">
              <div className="summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="sc-label">Account Increment</span>
                  <button className="btn-icon-sm" onClick={() => setShowCapitalEdit(!showCapitalEdit)}><Wallet size={12} /></button>
                </div>
                <span className={`sc-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>{formatPercent(stats.accountIncrement)}</span>
                <span className="sc-sub">Gain/Loss: {formatCurrency(stats.totalPnl, 0)}</span>
                {showCapitalEdit && <input type="number" defaultValue={capital} onBlur={(e) => { handleCapitalUpdate(e.target.value); setShowCapitalEdit(false); }} autoFocus className="sl-input" style={{ marginTop: 8 }} />}
              </div>
              <div className="summary-card">
                <span className="sc-label">Risk Status</span>
                <span className="sc-value" style={{ color: stats.atRiskCount === 0 ? 'var(--green)' : 'var(--orange)' }}>{stats.atRiskCount === 0 ? 'RISK FREE' : `${stats.atRiskCount} At Risk`}</span>
                <span className="sc-sub">{stats.riskFreeCount} Protected</span>
              </div>
              <div className="summary-card">
                <span className="sc-label">Max Open Risk</span>
                <span className="sc-value" style={{ color: 'var(--red)' }}>{formatCurrency(stats.openRisk, 0)}</span>
                <span className="sc-sub">TOTAL POTENTIAL DRAWDOWN</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div className="view-toggle">
                <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><LayoutGrid size={13} /></button>
                <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={13} /></button>
              </div>
            </div>

            <div className={`positions-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
              {filteredPositions.map(p => <PositionCard key={p.id} position={p} onClick={() => onSelectPosition(p.id)} />)}
            </div>
          </>
        )}

        {activeTab === 'closed' && (
          <div className="trades-container">
            <h2 className="section-title">Trade History</h2>
            <div className="table-wrap">
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Strategy</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>P&L %</th>
                    <th>R-Mult</th>
                    <th>Realized P&L</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {closedPositions.map(p => {
                    const pnlAmt = ((p.exit_price - p.entry_price) * p.shares) + parseFloat(p.realized_pnl || 0);
                    const pnlPct = ((p.exit_price - p.entry_price) / p.entry_price) * 100;
                    const initialRisk = (p.initial_risk_amount && parseFloat(p.initial_risk_amount) !== 0) ? p.initial_risk_amount : Math.abs(p.entry_price - (p.original_sl || p.stop_loss)) * p.shares;
                    const rMult = initialRisk > 0 ? pnlAmt / initialRisk : 0;
                    return (
                      <tr key={p.id}>
                        <td className="bold">{p.symbol}</td>
                        <td><span className="strategy-badge">{p.strategy}</span></td>
                        <td>{formatCurrency(p.entry_price)}</td>
                        <td>{formatCurrency(p.exit_price)}</td>
                        <td className={pnlPct >= 0 ? 'positive' : 'negative'}>{formatPercent(pnlPct)}</td>
                        <td>{formatRMultiple(rMult)}</td>
                        <td className={pnlAmt >= 0 ? 'positive' : 'negative'}>{formatCurrency(pnlAmt, 0)}</td>
                        <td>
                          <button className="link-btn" onClick={() => onSelectPosition(p.id)}>
                            <ExternalLink size={14} /> View Chart
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!closedPositions.length && <div className="empty-table">No closed trades found.</div>}
            </div>
          </div>
        )}
      </main>

      {showAddModal && <AddPositionModal onClose={() => setShowAddModal(false)} />}
      {showProfileModal && <ProfileSettingsModal onClose={() => setShowProfileModal(false)} />}
    </div>
  );
}
