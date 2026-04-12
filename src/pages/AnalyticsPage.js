import React, { useMemo, useState } from 'react';
import { usePositions } from '../context/PositionsContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { formatCurrency, calcCharges, getPnlColor } from '../utils/calculations';
import { TrendingUp, Inbox, Calendar, PieChart, Activity, IndianRupee } from 'lucide-react';

export default function AnalyticsPage() {
  const { positions } = usePositions();
  const [timeframe, setTimeframe] = useState('monthly'); // 'monthly', 'quarterly', 'yearly'
  
  // Filter for realized trades
  const realizedTrades = useMemo(() => 
    positions.filter(p => p.status === 'closed' || (parseFloat(p.realized_pnl || 0) !== 0))
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)),
  [positions]);

  const hasData = realizedTrades.length > 0;

  // Process trades & exact charges
  const processedTrades = useMemo(() => {
    return realizedTrades.map(p => {
      let gross = p.status === 'closed' 
        ? ((p.exit_price - p.entry_price) * p.shares) + parseFloat(p.realized_pnl || 0)
        : parseFloat(p.realized_pnl || 0);
      
      let chargesObj = null;
      let net = gross;
      
      // Compute charges only if trade has standard entry/exit
      if (p.status === 'closed' && p.entry_price && p.exit_price && p.shares) {
        // Assume delivery by default for charges calculation based on upstox/zerodha structure
        chargesObj = calcCharges(p.shares, p.entry_price, p.exit_price, 'delivery');
        if (chargesObj) {
          net = gross - chargesObj.totalCharges;
        }
      }
      return { ...p, gross, net, chargesObj };
    });
  }, [realizedTrades]);

  // Global Charges & Taxes (Zerodha console style)
  const globalStats = useMemo(() => {
    let totalGross = 0;
    let totalCharges = 0;
    let totalNet = 0;
    let taxes = { brokerage: 0, stt: 0, txn: 0, gst: 0, dp: 0, stamp: 0, sebi: 0 };

    processedTrades.forEach(t => {
      totalGross += t.gross;
      totalNet += t.net;
      if (t.chargesObj) {
        totalCharges += t.chargesObj.totalCharges;
        taxes.brokerage += t.chargesObj.brokerage;
        taxes.stt += t.chargesObj.stt;
        taxes.txn += t.chargesObj.txn;
        taxes.gst += t.chargesObj.gst;
        taxes.dp += t.chargesObj.dp;
        taxes.stamp += t.chargesObj.stamp;
        taxes.sebi += t.chargesObj.sebi;
      }
    });

    return { totalGross, totalCharges, totalNet, taxes };
  }, [processedTrades]);

  // Period Analysis (Monthly / Quarterly / Yearly)
  const getPeriodKey = (dateStr, tf) => {
    const d = new Date(dateStr);
    if (tf === 'monthly') return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    if (tf === 'quarterly') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q} ${d.getFullYear()}`;
    }
    return `${d.getFullYear()}`;
  };

  const periodData = useMemo(() => {
    const map = {};
    processedTrades.forEach(t => {
      const pk = getPeriodKey(t.updated_at, timeframe);
      if (!map[pk]) map[pk] = { name: pk, gross: 0, net: 0, charges: 0, wins: 0, losses: 0 };
      
      map[pk].gross += t.gross;
      map[pk].net += t.net;
      if (t.chargesObj) map[pk].charges += t.chargesObj.totalCharges;
      
      if (t.net > 0) map[pk].wins++;
      else map[pk].losses++;
    });
    return Object.values(map);
  }, [processedTrades, timeframe]);

  // General R-Multiple & Win Rate Stats
  const stats = useMemo(() => {
    if (!hasData) return { winRate: 0, avgR: 0, streak: 0, totalTrades: 0 };
    let wins = 0, totalR = 0, currentStreak = 0, lastResult = null;
    
    processedTrades.forEach(p => {
      const risk = (p.initial_risk_amount && parseFloat(p.initial_risk_amount) !== 0)
        ? parseFloat(p.initial_risk_amount)
        : Math.abs((p.entry_price - (p.original_sl || p.stop_loss || 0))) * (p.shares || 1);
        
      const R = (risk > 1) ? p.net / risk : 0;
      totalR += R;
      
      if (p.net > 0) {
        wins++;
        if (lastResult === 'W') currentStreak++; else currentStreak = 1;
        lastResult = 'W';
      } else if (p.net < 0) {
        if (lastResult === 'L') currentStreak++; else currentStreak = 1;
        lastResult = 'L';
      }
    });

    return {
      winRate: (wins / processedTrades.length) * 100,
      avgR: totalR / processedTrades.length,
      streak: currentStreak,
      streakType: lastResult === 'W' ? 'Winning' : 'Losing',
      totalTrades: processedTrades.length
    };
  }, [processedTrades, hasData]);

  const equityData = useMemo(() => {
    let cumulative = 0;
    return processedTrades.map((p, i) => {
      cumulative += p.net;
      return { name: `T${i + 1}`, value: cumulative };
    });
  }, [processedTrades]);

  if (!hasData) {
    return (
      <div className="analytics-page" style={{ alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="empty-state" style={{ maxWidth: 400 }}>
          <Inbox size={64} style={{ color: 'var(--text-muted)', marginBottom: 20 }} />
          <h3>No Realized Trades Yet</h3>
          <p>You haven't closed any positions or booked profits yet. Analytics will appear here once you lock in some gains or losses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity className="positive" /> Performance & Tax Analytics
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Verify your true Net P&L after all Brokerage and Exchange charges are applied.</p>
      </div>

      {/* Global Net P&L and Tax summary */}
      <div className="analytics-grid">
        <div className="analytics-card" style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)' }}>Realized Gross P&L</h3>
            <div style={{ fontSize: 24, fontWeight: 700, color: getPnlColor(globalStats.totalGross) }}>
              {formatCurrency(globalStats.totalGross)}
            </div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>-</div>
          <div>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Charges & Taxes</h3>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>
              {formatCurrency(globalStats.totalCharges)}
            </div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>=</div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)' }}>True Net P&L</h3>
            <div style={{ fontSize: 28, fontWeight: 800, color: getPnlColor(globalStats.totalNet) }}>
              {formatCurrency(globalStats.totalNet)}
            </div>
          </div>
        </div>

        {/* Detailed Taxes Breakdown */}
        <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
          <h3>Charges Breakdown (Upstox/Zerodha Structure)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 15, marginTop: 15 }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>Brokerage</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.brokerage)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>STT/CTT</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.stt)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>Exchange Txn</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.txn)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>DP Charges</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.dp)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>Stamp Duty</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.stamp)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>SEBI Fees</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.sebi)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>GST (18%)</span>
              <strong style={{ fontSize: 14 }}>{formatCurrency(globalStats.taxes.gst)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-grid" style={{ marginTop: 12 }}>
        <div className="analytics-card">
          <h3>Expectancy & Win Rate</h3>
          <div className="stats-row">
            <div className="stat-box">
              <span className="h">Win Rate</span>
              <span className="v">{stats.winRate.toFixed(1)}%</span>
            </div>
            <div className="stat-box">
              <span className="h">Avg R (Net)</span>
              <span className="v" style={{ color: stats.avgR >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {stats.avgR.toFixed(2)}R
              </span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Streak & Frequency</h3>
          <div className="stats-row">
            <div className="stat-box">
              <span className="h">Current Streak</span>
              <span className="v" style={{ color: stats.streakType === 'Winning' ? 'var(--green)' : 'var(--red)' }}>
                {stats.streak} {stats.streakType}
              </span>
            </div>
            <div className="stat-box">
              <span className="h">Total Realized</span>
              <span className="v">{stats.totalTrades} trades</span>
            </div>
          </div>
        </div>
      </div>

      {/* Period Analysis Chart */}
      <div className="analytics-grid" style={{ marginTop: 12 }}>
        <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16}/> Period P&L Analysis</h3>
            <div style={{ display: 'flex', gap: 5, background: 'var(--bg-body)', padding: 4, borderRadius: 8 }}>
              {['monthly', 'quarterly', 'yearly'].map(tf => (
                <button 
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: 'none',
                    background: timeframe === tf ? 'var(--blue)' : 'transparent',
                    color: timeframe === tf ? '#fff' : 'var(--text-muted)'
                  }}>
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(value, name) => [formatCurrency(value), name === 'net' ? 'Net P&L' : name === 'gross' ? 'Gross P&L' : 'Charges']}
                />
                <Bar dataKey="gross" fill="var(--teal)" fillOpacity={0.3} radius={[4, 4, 0, 0]} name="Gross P&L" />
                <Bar dataKey="net" fill="var(--blue)" radius={[4, 4, 0, 0]} name="Net P&L">
                  {periodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#3b82f6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-card" style={{ marginTop: 12 }}>
        <h3>Net Equity Curve (Minus Charges)</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="colorNetPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
              <RechartsTooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(value) => [formatCurrency(value), 'Net Equity']}
              />
              <Area type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorNetPnl)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
