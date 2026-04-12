import React, { useMemo, useState, useEffect } from 'react';
import { usePositions } from '../context/PositionsContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Line, ComposedChart
} from 'recharts';
import { formatCurrency, calcCharges, getPnlColor } from '../utils/calculations';
import angelOneService from '../services/angelOne';
import { TrendingUp, Inbox, Calendar, PieChart, Activity, DollarSign, Percent, ShieldAlert } from 'lucide-react';

export default function AnalyticsPage() {
  const { positions } = usePositions();
  const [timeframe, setTimeframe] = useState('monthly'); // 'monthly', 'quarterly', 'yearly'
  
  const [benchmarkToken, setBenchmarkToken] = useState('');
  const [benchmarkCandles, setBenchmarkCandles] = useState([]);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  
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
      
      if (p.status === 'closed' && p.entry_price && p.exit_price && p.shares) {
        // Use the broker defined on the trade, fallback to upstox
        const preferredBroker = p.broker || 'upstox'; 
        chargesObj = calcCharges(p.shares, p.entry_price, p.exit_price, 'delivery', preferredBroker);
        if (chargesObj) {
          net = gross - chargesObj.totalCharges;
        }
      }
      return { ...p, gross, net, chargesObj };
    });
  }, [realizedTrades]);

  // Global Charges & Taxes 
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

  const stats = useMemo(() => {
    if (!hasData) return { winRate: 0, avgR: 0, streak: 0, totalTrades: 0, wins: 0, losses: 0 };
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
      totalTrades: processedTrades.length,
      wins, losses: processedTrades.length - wins
    };
  }, [processedTrades, hasData]);

  const equityData = useMemo(() => {
    let cumulative = 0;
    return processedTrades.map((p, i) => {
      cumulative += p.net;
      return { name: `T${i + 1}`, value: cumulative };
    });
  }, [processedTrades]);

  useEffect(() => {
    if (!benchmarkToken || !hasData) {
      setBenchmarkCandles([]);
      return;
    }
    const fetchBenchmark = async () => {
      setLoadingBenchmark(true);
      try {
        const fromDate = new Date(realizedTrades[0].updated_at).toISOString().split('T')[0] + ' 00:00';
        const toDate = new Date().toISOString().split('T')[0] + ' 15:30';
        
        const candles = await angelOneService.getCandleData({
          exchange: 'NSE',
          symbolToken: benchmarkToken,
          interval: 'ONE_DAY',
          fromDate,
          toDate
        });
        setBenchmarkCandles(candles || []);
      } catch (err) {
        console.error('Benchmark fetch err:', err);
      } finally {
        setLoadingBenchmark(false);
      }
    };
    fetchBenchmark();
  }, [benchmarkToken, hasData, realizedTrades]);

  const combinedCurve = useMemo(() => {
    if (!benchmarkToken || !benchmarkCandles.length) return equityData;

    let cumulative = 0;
    const dailyEquity = {};
    processedTrades.forEach(p => {
      cumulative += p.net;
      const dStr = new Date(p.updated_at).toISOString().split('T')[0];
      dailyEquity[dStr] = cumulative;
    });

    const result = [];
    let lastEq = 0;
    
    benchmarkCandles.forEach(c => {
      // AngelOne returns ISO string or timestamp
      const dateStr = new Date(c[0]).toISOString().split('T')[0];
      if (dailyEquity[dateStr] !== undefined) lastEq = dailyEquity[dateStr];
      result.push({
        name: dateStr.substring(5), // MM-DD
        value: lastEq,
        indexValue: c[4] // close price
      });
    });
    return result;
  }, [equityData, processedTrades, benchmarkToken, benchmarkCandles]);

  const rMultipleData = useMemo(() => {
    const map = { '< -1R': 0, '-1R to 0R': 0, '0R to 1R': 0, '1R to 2R': 0, '> 2R': 0 };
    processedTrades.forEach(p => {
      const risk = (p.initial_risk_amount && parseFloat(p.initial_risk_amount) !== 0)
        ? parseFloat(p.initial_risk_amount)
        : Math.abs((p.entry_price - (p.original_sl || p.stop_loss || 0))) * (p.shares || 1);
        
      const R = (risk > 1) ? p.net / risk : 0;
      if (R <= -1) map['< -1R']++;
      else if (R <= 0) map['-1R to 0R']++;
      else if (R <= 1) map['0R to 1R']++;
      else if (R <= 2) map['1R to 2R']++;
      else map['> 2R']++;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [processedTrades]);

  const strategyData = useMemo(() => {
    const map = {};
    processedTrades.forEach(p => {
      const s = p.strategy || 'Other';
      if (!map[s]) map[s] = { name: s, net: 0 };
      map[s].net += p.net;
    });
    return Object.values(map).sort((a,b) => b.net - a.net);
  }, [processedTrades]);

  const weekdayData = useMemo(() => {
    const map = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0 };
    processedTrades.forEach(p => {
       const w = new Date(p.updated_at).toLocaleDateString('en-US', { weekday: 'short' });
       if (map[w] !== undefined) {
         map[w] += p.net;
       }
    });
    return Object.entries(map).map(([name, net]) => ({ name, net }));
  }, [processedTrades]);

  if (!hasData) {
    return (
      <div className="analytics-page empty-dashboard">
        <div className="empty-state">
          <div className="empty-ring">
             <Activity size={48} className="empty-icon" />
          </div>
          <h3>Dashboard Locked</h3>
          <p>Book your first trade to unlock advanced tax breakdowns and performance analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title"><Activity className="title-icon" /> Intelligence Hub</h2>
          <p className="dashboard-subtitle">Institutional-grade analytics & strict taxation forecasting.</p>
        </div>
        <div className="trade-badge">
          <ShieldAlert size={16}/> {stats.totalTrades} Trades Realized
        </div>
      </div>

      <div className="top-hero-grid">
        <div className="hero-card gross-card">
          <div className="card-label">Realized Gross P&L</div>
          <div className="hero-value" style={{ color: getPnlColor(globalStats.totalGross) }}>
             {formatCurrency(globalStats.totalGross)}
          </div>
          <div className="card-subtext">Before any deductions</div>
        </div>
        
        <div className="hero-card tax-card">
          <div className="card-label">Total Brokerage & Taxes</div>
          <div className="hero-value text-red">
             -{formatCurrency(globalStats.totalCharges)}
          </div>
          <div className="card-subtext">Capital lost to the system</div>
        </div>

        <div className="hero-card net-card">
          <div className="card-label">True Net P&L</div>
          <div className="hero-value text-gradient-green">
             {formatCurrency(globalStats.totalNet)}
          </div>
          <div className="card-subtext">Actual money in your bank</div>
        </div>
      </div>

      <div className="main-analytics-grid">
        {/* Left Column */}
        <div className="left-col">
          <div className="glass-panel">
             <div className="panel-header">
                <h3><Percent size={18} /> Edge & Expectancy</h3>
             </div>
             <div className="stats-showcase">
                <div className="showcase-item">
                   <span className="sh-label">Win Rate</span>
                   <strong className="sh-value">{stats.winRate.toFixed(1)}%</strong>
                   <span className="sh-sub">{stats.wins} W / {stats.losses} L</span>
                </div>
                <div className="showcase-item">
                   <span className="sh-label">Net Avg R</span>
                   <strong className="sh-value" style={{ color: stats.avgR >= 0 ? 'var(--green)' : 'var(--red)' }}>
                     {stats.avgR.toFixed(2)}R
                   </strong>
                   <span className="sh-sub">Post-tax expectancy</span>
                </div>
                <div className="showcase-item">
                   <span className="sh-label">Streak</span>
                   <strong className="sh-value" style={{ color: stats.streakType === 'Winning' ? 'var(--green)' : 'var(--red)' }}>
                     {stats.streak} {stats.streakType.charAt(0)}
                   </strong>
                   <span className="sh-sub">Momentum</span>
                </div>
             </div>
          </div>

          <div className="glass-panel">
             <div className="panel-header">
                <h3><Calendar size={18} /> Period P&L Analysis</h3>
                <div className="timeframe-toggles">
                  {['monthly', 'quarterly', 'yearly'].map(tf => (
                    <button 
                      key={tf}
                      className={timeframe === tf ? 'active-tf' : ''}
                      onClick={() => setTimeframe(tf)}>
                      {tf.charAt(0).toUpperCase() + tf.slice(1)}
                    </button>
                  ))}
                </div>
             </div>
             <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                    <RechartsTooltip 
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)' }}
                      formatter={(value, name) => [formatCurrency(value), name === 'net' ? 'Net P&L' : name === 'gross' ? 'Gross P&L' : 'Charges']}
                    />
                    <Bar dataKey="gross" fill="var(--teal)" fillOpacity={0.4} radius={[4, 4, 0, 0]} name="Gross P&L" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net P&L">
                      {periodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          
          <div className="glass-panel">
             <div className="panel-header">
                <h3><Activity size={18} /> Strategy Net P&L</h3>
             </div>
             <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{fill: 'var(--border-strong)'}}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)' }}
                      formatter={(value) => [formatCurrency(value), 'Net Profit']}
                    />
                    <Bar dataKey="net" radius={[0, 4, 4, 0]}>
                      {strategyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? 'var(--blue)' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-col">
          <div className="glass-panel breakdown-panel">
            <div className="panel-header">
               <h3><PieChart size={18} /> Tax & Charges Decomposition</h3>
               <span className="tax-burn">-{formatCurrency(globalStats.totalCharges)}</span>
            </div>
            <div className="taxes-list">
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--blue)'}}></div> Brokerage</div>
                 <strong>{formatCurrency(globalStats.taxes.brokerage)}</strong>
               </div>
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--amber)'}}></div> STT / CTT</div>
                 <strong>{formatCurrency(globalStats.taxes.stt)}</strong>
               </div>
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--teal)'}}></div> Exchange Txn</div>
                 <strong>{formatCurrency(globalStats.taxes.txn)}</strong>
               </div>
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--orange)'}}></div> DP Charges</div>
                 <strong>{formatCurrency(globalStats.taxes.dp)}</strong>
               </div>
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--green)'}}></div> Stamp Duty</div>
                 <strong>{formatCurrency(globalStats.taxes.stamp)}</strong>
               </div>
               <div className="tax-row">
                 <div className="t-info"><div className="t-dot" style={{background: '#8b5cf6'}}></div> SEBI Fees</div>
                 <strong>{formatCurrency(globalStats.taxes.sebi)}</strong>
               </div>
               <div className="tax-divider"></div>
               <div className="tax-row gst-row">
                 <div className="t-info"><div className="t-dot" style={{background: 'var(--red)'}}></div> GST (18%)</div>
                 <strong>{formatCurrency(globalStats.taxes.gst)}</strong>
               </div>
            </div>
          </div>

          <div className="glass-panel chart-panel">
            <div className="panel-header" style={{ alignItems: 'center' }}>
               <h3><TrendingUp size={18}/> Net Equity vs Benchmark</h3>
               <select 
                 className="sl-input" 
                 style={{ width: 150, padding: '4px 8px', fontSize: 12 }}
                 value={benchmarkToken}
                 onChange={e => setBenchmarkToken(e.target.value)}
               >
                 <option value="">No Benchmark</option>
                 <option value="99926000">NIFTY 50</option>
                 <option value="99926009">NIFTY BANK</option>
                 <option value="99926017">NIFTY 500</option>
                 <option value="99926012">NIFTY SMALLCAP</option>
               </select>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNetPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--green)" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  
                  {benchmarkToken && (
                     <YAxis yAxisId="right" orientation="right" stroke="var(--blue)" fontSize={11} tickLine={false} axisLine={false} domain={['auto','auto']} />
                  )}
                  
                  <RechartsTooltip 
                    cursor={{stroke: 'var(--border-strong)', strokeWidth: 1}}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)' }}
                    formatter={(value, name) => [name === 'value' ? formatCurrency(value) : value, name === 'value' ? 'Net Equity' : 'Index Close']}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="value" stroke="var(--green)" strokeWidth={3} fillOpacity={1} fill="url(#colorNetPnl)" />
                  
                  {benchmarkToken && combinedCurve[0]?.indexValue && (
                     <Line yAxisId="right" type="monotone" dataKey="indexValue" stroke="var(--blue)" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              {loadingBenchmark && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)'}}>Loading Market Data...</div>}
            </div>
          </div>
          
          <div className="glass-panel">
             <div className="panel-header">
                <h3><Activity size={18} /> R-Multiple Distribution</h3>
             </div>
             <div className="chart-wrapper" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rMultipleData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{fill: 'var(--border-strong)'}}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)' }}
                      formatter={(value) => [value, 'Trades']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {rMultipleData.map((entry, index) => {
                        let cf = 'var(--text-muted)';
                        if (entry.name === '< -1R') cf = '#ef4444';
                        else if (entry.name === '-1R to 0R') cf = '#fca5a5';
                        else if (entry.name === '0R to 1R') cf = 'var(--blue)';
                        else if (entry.name === '1R to 2R') cf = '#34d399';
                        else if (entry.name === '> 2R') cf = '#10b981';
                        return <Cell key={`cell-${index}`} fill={cf} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          
          <div className="glass-panel">
             <div className="panel-header">
                <h3><Calendar size={18} /> Weekday Performance</h3>
             </div>
             <div className="chart-wrapper" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                    <RechartsTooltip 
                      cursor={{fill: 'var(--border-strong)'}}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)' }}
                      formatter={(value) => [formatCurrency(value), 'Net Profit']}
                    />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                      {weekdayData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? 'var(--blue)' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
