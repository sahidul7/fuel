import React from 'react';

// ── KPI Card ──────────────────────────────────────────────────
export function KpiCard({ label, value, sub, accent = 'accent', icon }) {
  const colors = {
    accent: '#00d4a0', amber: '#f5a623', danger: '#ef4444', blue: '#60a5fa'
  };
  const c = colors[accent] || colors.accent;
  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:10, padding:'20px 22px', position:'relative', overflow:'hidden'
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c }} />
      <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)',
        letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>
        {label}
      </div>
      <div style={{ fontSize:30, fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:11, color:'var(--text2)', marginTop:4, fontFamily:'var(--mono)' }}>{sub}</div>}
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <span style={{ fontSize:10, fontWeight:700, color:'var(--text2)',
        fontFamily:'var(--mono)', letterSpacing:'0.12em', textTransform:'uppercase',
        whiteSpace:'nowrap' }}>
        {children}
      </span>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ level }) {
  const cfg = {
    critical: { bg:'rgba(239,68,68,.15)', color:'#ef4444', label:'CRITICAL' },
    warning:  { bg:'rgba(245,166,35,.15)', color:'#f5a623', label:'WARNING'  },
    ok:       { bg:'rgba(0,212,160,.12)', color:'#00d4a0', label:'OK'       },
  };
  const c = cfg[level] || cfg.ok;
  return (
    <span style={{
      background:c.bg, color:c.color, fontSize:9, fontWeight:700,
      fontFamily:'var(--mono)', letterSpacing:'0.08em',
      padding:'3px 7px', borderRadius:4
    }}>{c.label}</span>
  );
}

// ── FuelDot ───────────────────────────────────────────────────
export function FuelDot({ fuel }) {
  const colors = { petrol:'var(--petrol)', octane:'var(--octane)', diesel:'var(--diesel)' };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      fontSize:11, fontFamily:'var(--mono)', color: colors[fuel]
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:colors[fuel], display:'inline-block' }}/>
      {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
    </span>
  );
}

// ── Loading spinner ───────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <div style={{
        width:32, height:32, border:'2px solid var(--border2)',
        borderTopColor:'var(--accent)', borderRadius:'50%',
        animation:'spin 0.7s linear infinite'
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Panel card ────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:10, ...style
    }}>
      {children}
    </div>
  );
}

// ── StockBar ──────────────────────────────────────────────────
export function StockBar({ current, capacity, fuel }) {
  const pct = Math.min(100, (current / capacity) * 100);
  const colors = { petrol:'var(--petrol)', octane:'var(--octane)', diesel:'var(--diesel)' };
  const c = pct < 15 ? 'var(--danger)' : pct < 30 ? 'var(--amber)' : colors[fuel];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:3, transition:'width .4s' }}/>
      </div>
      <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text2)', width:32 }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function fmtNum(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}
