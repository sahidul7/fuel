import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { api } from '../api';
import { SectionTitle, Spinner, Card, Badge, StockBar, fmtNum } from './UI';

const FUEL_CFG = {
  petrol: { color:'#60a5fa', label:'Petrol' },
  octane: { color:'#fbbf24', label:'Octane' },
  diesel: { color:'#34d399', label:'Diesel' },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'#0d1628', border:'1px solid #1f3a5f', borderRadius:8,
      padding:'10px 14px', fontFamily:'var(--mono)', fontSize:12
    }}>
      <div style={{ color:'#7a9cc5', marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom:3 }}>
          {p.name}: <b>{fmtNum(Math.round(p.value))} L</b>
        </div>
      ))}
    </div>
  );
}

export default function ForecastTab() {
  const [stations,  setStations]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [forecast,  setForecast]  = useState(null);
  const [activeFuel, setActiveFuel] = useState('diesel');
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    api.stations().then(s => { setStations(s); setSelected(s[0]); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.forecast(selected.id).then(d => { setForecast(d); setLoading(false); }).catch(console.error);
  }, [selected]);

  const filtered = useMemo(() =>
    stations.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.district.toLowerCase().includes(search.toLowerCase()) ||
      s.upazila.toLowerCase().includes(search.toLowerCase())
    ), [stations, search]);

  // Build combined chart data: 30 hist + 7 forecast
  const chartData = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.forecasts[activeFuel].historical_30d.map(d => ({
      date: d.date, day: new Date(d.date).toLocaleDateString('en-BD',{month:'short',day:'numeric'}),
      actual: d.litres, type:'hist'
    }));
    const fcast = forecast.forecasts[activeFuel].forecast_7d.map(d => ({
      date: d.date, day: d.day,
      predicted: d.predicted, lower: d.lower, upper: d.upper, type:'forecast'
    }));
    return [...hist, ...fcast];
  }, [forecast, activeFuel]);

  const alertColor = { critical:'var(--danger)', warning:'var(--amber)', ok:'var(--accent)' };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
      {/* Station list */}
      <div>
        <SectionTitle>Stations</SectionTitle>
        <Card style={{ overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search station / district..."
              style={{
                width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
                borderRadius:6, padding:'7px 11px', color:'var(--text)',
                fontSize:12, fontFamily:'var(--mono)', outline:'none'
              }}
            />
          </div>
          <div style={{ maxHeight:'calc(100vh - 280px)', overflowY:'auto' }}>
            {filtered.map(s => {
              const isActive = selected?.id === s.id;
              const wc = alertColor[s.worst_alert];
              return (
                <div key={s.id} onClick={() => setSelected(s)} style={{
                  padding:'11px 14px', cursor:'pointer',
                  borderBottom:'1px solid rgba(26,46,74,.4)',
                  borderLeft:`3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'rgba(0,212,160,.07)' : 'transparent',
                  transition:'all .15s'
                }}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='var(--bg3)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=isActive?'rgba(0,212,160,.07)':'transparent'; }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{s.name}</div>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:wc, flexShrink:0, marginTop:3 }}/>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>
                    {s.upazila} · {s.district}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:6 }}>
                    {Object.entries(s.alert_levels).map(([f, al]) => (
                      <span key={f} style={{
                        fontSize:9, fontFamily:'var(--mono)', padding:'2px 5px',
                        borderRadius:3, background: alertColor[al.level]+'22',
                        color: alertColor[al.level]
                      }}>{f[0].toUpperCase()} {al.days_remaining}d</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Forecast panel */}
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {!selected ? (
          <div style={{ textAlign:'center', padding:80, color:'var(--text2)' }}>Select a station</div>
        ) : loading ? <Spinner/> : forecast ? (
          <>
            {/* Station header */}
            <Card style={{ padding:'18px 22px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800 }}>{forecast.station.name}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:3 }}>
                    {forecast.station.upazila} · {forecast.station.district} District
                    <span style={{ color:'var(--text3)', marginLeft:8 }}>
                      {forecast.station.lat.toFixed(4)}°N, {forecast.station.lng.toFixed(4)}°E
                    </span>
                  </div>
                </div>
                {/* Fuel toggle */}
                <div style={{ display:'flex', gap:8 }}>
                  {Object.entries(FUEL_CFG).map(([f, cfg]) => (
                    <button key={f} onClick={() => setActiveFuel(f)} style={{
                      padding:'6px 14px', borderRadius:20, border:'1px solid',
                      borderColor: activeFuel===f ? cfg.color : 'var(--border)',
                      background: activeFuel===f ? cfg.color+'22' : 'transparent',
                      color: activeFuel===f ? cfg.color : 'var(--text2)',
                      fontSize:12, cursor:'pointer', fontFamily:'var(--mono)'
                    }}>{cfg.label}</button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Stock status row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {Object.entries(forecast.forecasts).map(([f, fd]) => {
                const cfg = FUEL_CFG[f];
                const al  = fd.alert_level;
                const aColor = { critical:'var(--danger)', warning:'var(--amber)', ok:'var(--accent)' }[al];
                return (
                  <Card key={f} style={{ padding:'16px 18px', position:'relative', overflow:'hidden',
                    border: activeFuel===f ? `1px solid ${cfg.color}66` : '1px solid var(--border)' }}>
                    <div style={{ position:'absolute', top:0,left:0,right:0,height:2, background:cfg.color }}/>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
                      <Badge level={al}/>
                    </div>
                    <div style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>
                      {fmtNum(fd.current_stock)} <span style={{ fontSize:12, fontWeight:400, color:'var(--text2)' }}>L</span>
                    </div>
                    <StockBar
                      current={fd.current_stock}
                      capacity={forecast.station.capacity[f]}
                      fuel={f}
                    />
                    <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'var(--mono)' }}>
                      <span style={{ color:'var(--text2)' }}>Days left</span>
                      <span style={{ color:aColor, fontWeight:600 }}>
                        {fd.days_remaining >= 99 ? '>30' : fd.days_remaining}d
                      </span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'var(--mono)', marginTop:3 }}>
                      <span style={{ color:'var(--text2)' }}>Avg daily</span>
                      <span>{fmtNum(fd.avg_daily_velocity)} L/day</span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Main forecast chart */}
            <Card style={{ padding:'22px' }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:700 }}>
                  {FUEL_CFG[activeFuel].label} — Historical Sales + 7-Day Forecast
                </div>
                <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:3 }}>
                  Solid = actual sales · Dashed = forecast with 90% confidence band
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2e4a" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize:10, fontFamily:'var(--mono)', fill:'#7a9cc5' }}
                    tickLine={false} axisLine={{ stroke:'#1a2e4a' }}
                    interval={3}
                  />
                  <YAxis tick={{ fontSize:10, fontFamily:'var(--mono)', fill:'#7a9cc5' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => fmtNum(v)}
                  />
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine x={chartData[29]?.day} stroke="#1f3a5f" strokeDasharray="4 4"
                    label={{ value:'Today', position:'top', fontSize:10, fill:'#7a9cc5', fontFamily:'var(--mono)' }}/>
                  {/* Confidence band */}
                  <Area dataKey="upper" stroke="none" fill={FUEL_CFG[activeFuel].color} fillOpacity={0.08} name="Upper CI"/>
                  <Area dataKey="lower" stroke="none" fill={FUEL_CFG[activeFuel].color} fillOpacity={0} name="Lower CI"/>
                  {/* Actual bars */}
                  <Bar dataKey="actual" fill={FUEL_CFG[activeFuel].color} fillOpacity={0.7}
                    radius={[2,2,0,0]} name="Actual (L)" maxBarSize={14}/>
                  {/* Forecast line */}
                  <Line dataKey="predicted" stroke={FUEL_CFG[activeFuel].color} strokeWidth={2}
                    strokeDasharray="6 3" dot={{ r:3, fill:FUEL_CFG[activeFuel].color }}
                    name="Forecast (L)"/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            {/* 7-day table */}
            <Card style={{ padding:'20px 22px' }}>
              <SectionTitle>7-Day Forecast Detail — {FUEL_CFG[activeFuel].label}</SectionTitle>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>
                    {['Date','Day','Lower (L)','Predicted (L)','Upper (L)','vs Avg'].map(h => (
                      <th key={h} style={{
                        textAlign:'left', padding:'8px 12px', fontSize:10,
                        color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.06em',
                        borderBottom:'1px solid var(--border)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecasts[activeFuel].forecast_7d.map((row, i) => {
                    const avg = forecast.forecasts[activeFuel].avg_daily_velocity;
                    const diff = row.predicted - avg;
                    const pct  = avg > 0 ? ((diff/avg)*100).toFixed(1) : '0.0';
                    const up   = diff >= 0;
                    return (
                      <tr key={row.date} style={{ borderBottom:'1px solid rgba(26,46,74,.4)' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'9px 12px', fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{row.date}</td>
                        <td style={{ padding:'9px 12px', fontWeight:600 }}>{row.day}</td>
                        <td style={{ padding:'9px 12px', fontFamily:'var(--mono)', color:'var(--text2)' }}>{fmtNum(row.lower)}</td>
                        <td style={{ padding:'9px 12px', fontFamily:'var(--mono)', fontWeight:700, color:FUEL_CFG[activeFuel].color }}>
                          {fmtNum(row.predicted)}
                        </td>
                        <td style={{ padding:'9px 12px', fontFamily:'var(--mono)', color:'var(--text2)' }}>{fmtNum(row.upper)}</td>
                        <td style={{ padding:'9px 12px', fontFamily:'var(--mono)', color: up?'#4ade80':'var(--danger)' }}>
                          {up?'+':''}{pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
