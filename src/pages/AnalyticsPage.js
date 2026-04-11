import React, { useMemo } from 'react';
import { usePositions } from '../context/PositionsContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { formatCurrency } from '../utils/calculations';
import { TrendingUp, Inbox } from 'lucide-react';

export default function AnalyticsPage() {
  const { positions } = usePositions();
  
  // Only use Trades that are CLOSED or have REALIZED profit from partial booking
  const realizedTrades = useMemo(() => 
    positions.filter(p => p.status === 'closed' || (parseFloat(p.realized_pnl || 0) !== 0))
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)),
  [positions]);

  const hasData = realizedTrades.length > 0;

  // ── Calculation Logic ──────────
  const stats = useMemo(() => {
    if (!hasData) return { winRate: 0, avgR: 0, expectancy: 0, streak: 0, totalTrades: 0 };
    
    let wins = 0;
    let totalR = 0;
    let currentStreak = 0;
    let lastResult = null;

    realizedTrades.forEach(p => {
      // PNL is realized_pnl (for active) OR full exit PNL (for closed)
      const pnl = p.status === 'closed' 
        ? ((p.exit_price - p.entry_price) * p.shares) + parseFloat(p.realized_pnl || 0)
        : parseFloat(p.realized_pnl || 0);

      const risk = (p.initial_risk_amount && parseFloat(p.initial_risk_amount) !== 0)
        ? parseFloat(p.initial_risk_amount)
        : Math.abs((p.entry_price - (p.original_sl || p.stop_loss || 0))) * (p.shares || 1);
        
      const R = (risk > 1) ? pnl / risk : 0;
      
      totalR += R;
      if (pnl > 0) {
        wins++;
        if (lastResult === 'W') currentStreak++; else currentStreak = 1;
        lastResult = 'W';
      } else if (pnl < 0) {
        if (lastResult === 'L') currentStreak++; else currentStreak = 1;
        lastResult = 'L';
      }
    });

    return {
      winRate: (wins / realizedTrades.length) * 100,
      avgR: totalR / realizedTrades.length,
      expectancy: (wins / realizedTrades.length) * (totalR / realizedTrades.length),
      streak: currentStreak,
      streakType: lastResult === 'W' ? 'Winning' : 'Losing',
      totalTrades: realizedTrades.length
    };
  }, [realizedTrades, hasData]);

  const equityData = useMemo(() => {
    let cumulative = 0;
    return realizedTrades.map((p, i) => {
      const pnl = p.status === 'closed' 
        ? ((p.exit_price - p.entry_price) * p.shares) + parseFloat(p.realized_pnl || 0)
        : parseFloat(p.realized_pnl || 0);
      cumulative += pnl;
      return { name: `T${i + 1}`, value: cumulative };
    });
  }, [realizedTrades]);

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
          <TrendingUp className="positive" /> Performance Analytics
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tracking your trade expectancy and realized account growth.</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Expectancy & Win Rate</h3>
          <div className="stats-row">
            <div className="stat-box">
              <span className="h">Win Rate</span>
              <span className="v">{stats.winRate.toFixed(1)}%</span>
            </div>
            <div className="stat-box">
              <span className="h">Avg R</span>
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

      <div className="analytics-card">
        <h3>Equity Curve (Realized Cumulative P&L)</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(value) => formatCurrency(value)}
              />
              <Area type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorPnl)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analytics-grid" style={{ marginTop: 12 }}>
        <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
          <h3>R-Multiple Distribution</h3>
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const map = { '-1R': 0, '0R': 0, '1R': 0, '2R': 0, '3R+': 0 };
                realizedTrades.forEach(p => {
                  const pnl = p.status === 'closed' ? ((p.exit_price - p.entry_price) * p.shares) + parseFloat(p.realized_pnl || 0) : parseFloat(p.realized_pnl || 0);
                  const risk = (p.initial_risk_amount && parseFloat(p.initial_risk_amount) !== 0) ? parseFloat(p.initial_risk_amount) : Math.abs(p.entry_price - (p.original_sl || p.stop_loss)) * p.shares;
                  const R = risk > 0 ? pnl / risk : 0;
                  if (R < -0.5) map['-1R']++;
                  else if (R < 0.5) map['0R']++;
                  else if (R < 1.5) map['1R']++;
                  else if (R < 2.5) map['2R']++;
                  else map['3R+']++;
                });
                return Object.entries(map).map(([name, count]) => ({ name, count }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  { [{c: 'var(--red)'}, {c: '#94a3b8'}, {c: '#3b82f6'}, {c: '#6366f1'}, {c: 'var(--teal)'}].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
