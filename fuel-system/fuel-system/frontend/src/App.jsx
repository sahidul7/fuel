import React, { useEffect, useState } from 'react';
import './index.css';
import { api } from './api';
import { KpiCard } from './components/UI';
import HeatmapTab  from './components/HeatmapTab';
import ForecastTab from './components/ForecastTab';
import AlertsTab   from './components/AlertsTab';

const TABS = [
  { key: 'heatmap',  label: 'Heatmap',         sub: 'Consumption Density'   },
  { key: 'forecast', label: 'Demand Forecast',  sub: '7-Day Prediction'      },
  { key: 'alerts',   label: 'Shortage Alerts',  sub: 'Stock / Velocity Risk' },
];

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtNum(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

export default function App() {
  const [tab,     setTab]     = useState('heatmap');
  const [summary, setSummary] = useState(null);
  const now = useNow();

  useEffect(() => {
    api.summary().then(setSummary).catch(console.error);
    const iv = setInterval(() => api.summary().then(setSummary).catch(console.error), 60000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* HEADER */}
      <header style={{
        background:'var(--bg2)', borderBottom:'1px solid var(--border)',
        padding:'0 32px', display:'flex', alignItems:'center', gap:20,
        height:60, position:'sticky', top:0, zIndex:1000,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:34, height:34, border:'2px solid var(--accent)', borderRadius:7,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:15, fontWeight:800, color:'var(--accent)',
          }}>জ্ব</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, lineHeight:1.2 }}>BPC Fuel Intelligence</div>
            <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.08em' }}>
              BANGLADESH PETROLEUM CORPORATION
            </div>
          </div>
        </div>

        <div style={{ width:1, height:28, background:'var(--border)', marginLeft:8 }}/>

        {summary && (
          <div style={{ display:'flex', gap:12 }}>
            {summary.critical_alerts > 0 && (
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.25)',
                borderRadius:6, padding:'4px 10px',
              }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#ef4444',animation:'hpulse 1.4s infinite' }}/>
                <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'#ef4444', fontWeight:600 }}>
                  {summary.critical_alerts} CRITICAL
                </span>
              </div>
            )}
            {summary.warning_alerts > 0 && (
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                background:'rgba(245,166,35,.1)', border:'1px solid rgba(245,166,35,.2)',
                borderRadius:6, padding:'4px 10px',
              }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#f5a623' }}/>
                <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'#f5a623', fontWeight:600 }}>
                  {summary.warning_alerts} WARNING
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--accent)',animation:'hpulse 2s infinite' }}/>
            <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)' }}>LIVE</span>
          </div>
          <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>
            {now.toLocaleTimeString('en-BD',{hour12:false})} BDT
          </span>
          <span style={{
            fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:5, padding:'3px 8px',
          }}>Dataset: 31 Mar 2026</span>
        </div>
      </header>

      {/* TABS NAV */}
      <nav style={{
        background:'var(--bg2)', borderBottom:'1px solid var(--border)',
        padding:'0 32px', display:'flex', gap:2,
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'12px 22px', background:'none', border:'none',
            borderBottom:`2px solid ${tab===t.key ? 'var(--accent)' : 'transparent'}`,
            cursor:'pointer', color: tab===t.key ? 'var(--accent)' : 'var(--text2)',
            fontFamily:'var(--font)', fontSize:13,
            fontWeight: tab===t.key ? 700 : 400,
            transition:'all .2s', display:'flex', flexDirection:'column',
            alignItems:'flex-start', gap:2,
          }}>
            {t.label}
            <span style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
              {t.sub}
            </span>
          </button>
        ))}
      </nav>

      {/* KPI STRIP */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'16px 32px' }}>
        {!summary ? (
          <div style={{ display:'flex', gap:12 }}>
            {[1,2,3,4].map(i=>(
              <div key={i} style={{ flex:1, height:72, borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', animation:'shimmer 1.5s infinite' }}/>
            ))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            <KpiCard label="Active Stations"      value={summary.total_stations}                 sub="Across 8+ districts"  accent="accent" />
            <KpiCard label="7-Day Combined Sales"  value={fmtNum(summary.total_7d_combined)+' L'} sub={`P ${fmtNum(summary.total_7d_litres.petrol)} · O ${fmtNum(summary.total_7d_litres.octane)} · D ${fmtNum(summary.total_7d_litres.diesel)}`} accent="blue"/>
            <KpiCard label="Critical Alerts"      value={summary.critical_alerts}                sub="Stockout within 3 days" accent="danger"/>
            <KpiCard label="Warning Alerts"       value={summary.warning_alerts}                 sub="Stockout within 7 days" accent="amber"/>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <main style={{ flex:1, padding:'28px 32px', maxWidth:1600, width:'100%', margin:'0 auto' }}>
        {tab==='heatmap'  && <HeatmapTab  />}
        {tab==='forecast' && <ForecastTab />}
        {tab==='alerts'   && <AlertsTab   />}
      </main>

      {/* FOOTER */}
      <footer style={{
        background:'var(--bg2)', borderTop:'1px solid var(--border)',
        padding:'12px 32px', display:'flex', justifyContent:'space-between',
      }}>
        <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
          Bangladesh Petroleum Corporation · Predictive Fuel Intelligence System v1.0
        </span>
        <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
          Fuels: Petrol · Octane · Diesel
        </span>
      </footer>

      <style>{`
        @keyframes hpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:.8} }
      `}</style>
    </div>
  );
}
