import React, { useState, useEffect, useMemo } from 'react';
import { usePositions } from '../context/PositionsContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PositionCard from '../components/PositionCard';
import AddPositionModal from '../components/AddPositionModal';
import PositionSizeCalc from '../components/PositionSizeCalc';
import AnalyticsPage from './AnalyticsPage';
import { formatCurrency, formatPercent } from '../utils/calculations';
import {
  Plus, RefreshCw, LayoutGrid, List, AlertCircle,
  LogOut, TrendingUp, Sun, Moon, Calculator, Table,
  BarChart2, Wallet
} from 'lucide-react';

export default function PositionsPage({ onSelectPosition }) {
  const {
    positions, filteredPositions,
    loading, error, loadPositions,
    setFilter,
    getLivePrice,
  } = usePositions();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  // Account Capital Persistence
  const [capital, setCapital] = useState(() => {
    return parseFloat(localStorage.getItem('terminal_capital')) || 1000000;
  });
  const [showCapitalEdit, setShowCapitalEdit] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'calculator' || tab === 'analytics') return;
    setFilter(tab === 'all' ? 'all' : tab === 'closed' ? 'closed' : 'active');
  };

  const handleCapitalUpdate = (val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setCapital(num);
      localStorage.setItem('terminal_capital', num.toString());
    }
  };

  // ── Active Portfolio Stats ────────────────────────────────
  const stats = useMemo(() => {
    let totalValue = 0, totalPnl = 0, openRisk = 0, riskFreeCount = 0, atRiskCount = 0;
    
    positions.forEach((p) => {
      const isClosed = p.status === 'closed';
      const cmp = getLivePrice(p.symbol_token, p.entry_price);
      const totalShares = (p.shares || 0) + (p.pyramid_shares || 0);
      const realized = parseFloat(p.realized_pnl || 0);

      if (p.status === 'active') {
        const cost = (p.entry_price * p.shares) + ((p.pyramid_entry || 0) * (p.pyramid_shares || 0));
        const value = cmp * totalShares;
        const runningPnl = value - cost;
        totalValue += value;
        totalPnl += runningPnl + realized;

        const avgPrice = totalShares > 0 ? cost / totalShares : p.entry_price;
        if (p.stop_loss >= avgPrice) riskFreeCount++; else {
          atRiskCount++;
          openRisk += Math.abs(cmp - p.stop_loss) * totalShares;
        }
      } else {
        // Closed trades contribute to total realized P/L
        const closedPnl = ((p.exit_price - p.entry_price) * p.shares) + realized;
        totalPnl += closedPnl;
      }
    });

    const accountIncrement = capital > 0 ? (totalPnl / capital) * 100 : 0;
    return { totalValue, totalPnl, openRisk, riskFreeCount, atRiskCount, accountIncrement };
  }, [positions, getLivePrice, capital]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await loadPositions();
    setRefreshing(false);
  };

  return (
    <div className="positions-page">
      <nav className="navbar">
        <div className="navbar-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#6366f1" />
            <path d="M8 22L14 10L20 18L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="brand-label">VALVO INTELLIGENCE</div>
            <div className="brand-name">Trader Terminal</div>
          </div>
        </div>

        <div className="navbar-center">
          <button className={`nav-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => handleTabChange('active')}>Active</button>
          <button className={`nav-tab ${activeTab === 'closed' ? 'active' : ''}`} onClick={() => handleTabChange('closed')}><Table size={13} /> Trades</button>
          <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => handleTabChange('analytics')}><BarChart2 size={13} /> Analytics</button>
          <button className={`nav-tab ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => handleTabChange('calculator')}><Calculator size={13} /> Calc</button>
        </div>

        <div className="navbar-right">
          <button className="btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Light' : 'Dark'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn-secondary btn-sm" onClick={handleRefreshAll} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
          </button>
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Trade
          </button>
          <button className="btn-icon-sm" onClick={signOut} title="Sign out"><LogOut size={14} /></button>
        </div>
      </nav>
      
      {activeTab === 'calculator' && <main className="positions-main"><PositionSizeCalc /></main>}
      {activeTab === 'analytics' && <AnalyticsPage />}

      {(activeTab === 'active' || activeTab === 'closed' || activeTab === 'all') && (
        <>
          {activeTab === 'active' && (
            <div className="portfolio-summary">
              <div className="summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="sc-label">Total Account Increment</span>
                  <button className="btn-icon-sm" onClick={() => setShowCapitalEdit(!showCapitalEdit)}><Wallet size={12} /></button>
                </div>
                <span className={`sc-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(stats.accountIncrement)}
                </span>
                <span className={`sc-sub ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                   Total Gain/Loss: {formatCurrency(stats.totalPnl, 0)}
                </span>
                {showCapitalEdit && (
                  <div className="capital-edit" style={{ marginTop: 10 }}>
                    <input 
                      type="number" 
                      defaultValue={capital} 
                      onBlur={(e) => { handleCapitalUpdate(e.target.value); setShowCapitalEdit(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleCapitalUpdate(e.target.value); setShowCapitalEdit(false); } }}
                      placeholder="Enter Capital"
                      autoFocus
                      className="sl-input"
                    />
                  </div>
                )}
              </div>

              <div className="summary-card">
                <span className="sc-label">Risk Status</span>
                <span className="sc-value" style={{ color: stats.atRiskCount === 0 ? 'var(--green)' : 'var(--orange)' }}>
                   {stats.atRiskCount === 0 ? 'RISK FREE ✅' : `${stats.atRiskCount} At Risk`}
                </span>
                <span className="sc-sub neutral">{stats.riskFreeCount} Protected · {stats.atRiskCount} Open</span>
              </div>

              <div className="summary-card">
                <span className="sc-label">Max Open Risk</span>
                <span className="sc-value" style={{ color: 'var(--red)' }}>{formatCurrency(stats.openRisk, 0)}</span>
                <span className="sc-sub neutral">ESTIMATED SL DRAWDOWN</span>
              </div>
            </div>
          )}

          <main className="positions-main">
             <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <div className="view-toggle">
                  <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><LayoutGrid size={14} /></button>
                  <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={14} /></button>
                </div>
             </div>

            {loading && !filteredPositions.length && <div className="loading-state"><div className="spinner large" /><span>Loading...</span></div>}

            <div className={`positions-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
              {filteredPositions.map((pos) => (
                <PositionCard key={pos.id} position={pos} onClick={() => onSelectPosition(pos.id)} />
              ))}
            </div>
          </main>
        </>
      )}

      {showAddModal && <AddPositionModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
