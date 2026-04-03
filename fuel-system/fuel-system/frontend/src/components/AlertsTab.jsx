import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import L from 'leaflet';
import { api } from '../api';
import { SectionTitle, Spinner, Card, fmtNum } from './UI';

const FUEL_CFG = {
  petrol: { color:'#60a5fa', label:'Petrol' },
  octane: { color:'#fbbf24', label:'Octane' },
  diesel: { color:'#34d399', label:'Diesel' },
};

function AlertRow({ rec, rank }) {
  const isCrit = rec.days_remaining < 3;
  const color  = isCrit ? '#ef4444' : '#f5a623';
  const bgc    = isCrit ? 'rgba(239,68,68,.06)' : 'rgba(245,166,35,.06)';
  const fc     = FUEL_CFG[rec.fuel_type];
  const pct    = Math.min(100, (rec.days_remaining / 7) * 100);

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'28px 1fr 90px 90px 90px 100px 120px',
      gap:12, alignItems:'center',
      padding:'11px 18px', background:bgc,
      borderBottom:'1px solid rgba(26,46,74,.4)',
      fontSize:12
    }}>
      <span style={{ fontFamily:'var(--mono)', color:'var(--text3)', fontSize:10 }}>{rank}</span>
      <div>
        <div style={{ fontWeight:600, color:'var(--text)', marginBottom:2 }}>{rec.station_name}</div>
        <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)' }}>{rec.upazila} · {rec.district}</div>
      </div>
      <span style={{ color:fc.color, fontFamily:'var(--mono)', fontSize:11 }}>
        <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:fc.color, marginRight:5 }}/>
        {fc.label}
      </span>
      <span style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{fmtNum(rec.current_stock)} L</span>
      <span style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{fmtNum(rec.daily_velocity)} L/d</span>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, fontFamily:'var(--mono)', marginBottom:3 }}>
          <span style={{ color:color, fontWeight:700 }}>{rec.days_remaining}d left</span>
        </div>
        <div style={{ height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3 }}/>
        </div>
      </div>
      <span style={{ fontFamily:'var(--mono)', fontSize:11,
        color: rec.estimated_stockout ? color : 'var(--text2)' }}>
        {rec.estimated_stockout || '—'}
      </span>
    </div>
  );
}

export default function AlertsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');   // all, petrol, octane, diesel
  const mapRef    = React.useRef(null);
  const leafletRef= React.useRef(null);

  useEffect(() => {
    api.alerts().then(d => { setData(d); setLoading(false); }).catch(console.error);
  }, []);

  // Alert map
  useEffect(() => {
    if (!data || leafletRef.current) return;
    const map = L.map(mapRef.current, {
      center:[23.6850, 90.3563], zoom:7,
      zoomControl:true, attributionControl:false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    leafletRef.current = map;

    const all = [...data.critical, ...data.warning];
    all.forEach(rec => {
      const c   = rec.days_remaining < 3 ? '#ef4444' : '#f5a623';
      const r   = rec.days_remaining < 3 ? 12 : 9;
      L.circleMarker([rec.lat, rec.lng], {
        radius:r, fillColor:c, color:'#fff', weight:1.5, fillOpacity:0.9
      }).addTo(map).bindTooltip(
        `<div style="font-family:monospace;font-size:11px;background:#0d1628;color:#e2ebf8;border:1px solid #1a2e4a;padding:8px 12px;border-radius:6px;line-height:1.6">
          <b>${rec.station_name}</b><br/>
          Fuel: <b>${rec.fuel_type}</b><br/>
          Stock: <b>${fmtNum(rec.current_stock)} L</b><br/>
          Days left: <b style="color:${c}">${rec.days_remaining}d</b>
        </div>`, { opacity:1 }
      );
    });
  }, [data]);

  if (loading) return <Spinner/>;
  if (!data) return null;

  const fuels = ['petrol','octane','diesel'];
  const filterFn = rec => filter === 'all' || rec.fuel_type === filter;
  const critical = data.critical.filter(filterFn);
  const warning  = data.warning.filter(filterFn);

  // District risk chart
  const districtMap = {};
  [...data.critical, ...data.warning].forEach(r => {
    if (!districtMap[r.district]) districtMap[r.district] = { district:r.district, critical:0, warning:0 };
    if (r.days_remaining < 3) districtMap[r.district].critical++;
    else districtMap[r.district].warning++;
  });
  const districtData = Object.values(districtMap)
    .sort((a,b) => (b.critical+b.warning) - (a.critical+a.warning))
    .slice(0,10);

  // Fuel breakdown for summary
  const fuelBreakdown = fuels.map(f => ({
    fuel: f,
    critical: data.critical.filter(r=>r.fuel_type===f).length,
    warning:  data.warning.filter(r=>r.fuel_type===f).length,
  }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          { label:'Critical Alerts', val:data.summary.critical_count, accent:'#ef4444', sub:'Stockout < 3 days' },
          { label:'Warning Alerts',  val:data.summary.warning_count,  accent:'#f5a623', sub:'Stockout < 7 days' },
          { label:'Total At Risk',   val:data.summary.total_at_risk,  accent:'#f5a623', sub:'Stations needing action' },
          { label:'As of',           val:data.as_of, accent:'var(--accent)', sub:'Data snapshot date' },
        ].map(k => (
          <Card key={k.label} style={{ padding:'18px 20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:2, background:k.accent }}/>
            <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:k.label==='As of'?16:28, fontWeight:800, color:k.accent }}>{k.val}</div>
            <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:4 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Map + charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        <Card style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase', alignSelf:'center' }}>Alert Map</span>
            <span style={{ marginLeft:'auto', fontSize:10, fontFamily:'var(--mono)', color:'#ef4444' }}>● Critical</span>
            <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'#f5a623' }}>● Warning</span>
          </div>
          <div ref={mapRef} style={{ height:320 }}/>
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Fuel breakdown */}
          <Card style={{ padding:'18px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:14 }}>
              Alerts by fuel type
            </div>
            {fuelBreakdown.map(fb => (
              <div key={fb.fuel} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:FUEL_CFG[fb.fuel].color, fontFamily:'var(--mono)' }}>
                    <span style={{ display:'inline-block',width:7,height:7,borderRadius:'50%',background:FUEL_CFG[fb.fuel].color,marginRight:6 }}/>
                    {FUEL_CFG[fb.fuel].label}
                  </span>
                  <span style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>
                    <span style={{ color:'#ef4444' }}>{fb.critical} crit</span> · <span style={{ color:'#f5a623' }}>{fb.warning} warn</span>
                  </span>
                </div>
                <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', background:'var(--bg4)' }}>
                  <div style={{ width:`${(fb.critical/(fb.critical+fb.warning||1))*100}%`, background:'#ef4444' }}/>
                  <div style={{ flex:1, background:'#f5a623', opacity:0.7 }}/>
                </div>
              </div>
            ))}
          </Card>

          {/* District bar chart */}
          <Card style={{ padding:'18px', flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>
              Top risk districts
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={districtData} layout="vertical" margin={{ left:0, right:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2e4a" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize:9, fontFamily:'var(--mono)', fill:'#7a9cc5' }} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="district" tick={{ fontSize:10, fontFamily:'var(--mono)', fill:'#7a9cc5' }} tickLine={false} axisLine={false} width={80}/>
                <Tooltip contentStyle={{ background:'#0d1628', border:'1px solid #1f3a5f', borderRadius:6, fontFamily:'var(--mono)', fontSize:11 }}/>
                <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[0,3,3,0]} stackId="a"/>
                <Bar dataKey="warning"  name="Warning"  fill="#f5a623" radius={[0,3,3,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <SectionTitle>Alert Details</SectionTitle>
        <div style={{ display:'flex', gap:6, marginLeft:16, marginBottom:16 }}>
          {['all','petrol','octane','diesel'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'5px 12px', borderRadius:20, border:'1px solid',
              borderColor: filter===f ? (f==='all'?'var(--accent)':FUEL_CFG[f]?.color||'var(--accent)') : 'var(--border)',
              background: filter===f ? 'rgba(0,212,160,.12)' : 'transparent',
              color: filter===f ? 'var(--accent)' : 'var(--text2)',
              fontSize:11, cursor:'pointer', fontFamily:'var(--mono)'
            }}>{f === 'all' ? 'All Fuels' : FUEL_CFG[f].label}</button>
          ))}
        </div>
      </div>

      {/* Critical table */}
      {critical.length > 0 && (
        <Card style={{ overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', gap:10,
            background:'rgba(239,68,68,.05)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', animation:'pulse 1.5s infinite' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>Critical — Stockout in &lt; 3 Days</span>
            <span style={{ marginLeft:'auto', fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>
              {critical.length} alert{critical.length!==1?'s':''}
            </span>
          </div>
          <div style={{ padding:'8px 18px', borderBottom:'1px solid var(--border)',
            display:'grid', gridTemplateColumns:'28px 1fr 90px 90px 90px 100px 120px',
            gap:12, fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:'0.06em' }}>
            <span>#</span><span>STATION</span><span>FUEL</span><span>STOCK</span><span>VELOCITY</span><span>DAYS LEFT</span><span>STOCKOUT EST.</span>
          </div>
          {critical.map((r, i) => <AlertRow key={`${r.station_id}-${r.fuel_type}`} rec={r} rank={i+1}/>)}
        </Card>
      )}

      {/* Warning table */}
      {warning.length > 0 && (
        <Card style={{ overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', gap:10,
            background:'rgba(245,166,35,.05)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#f5a623' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#f5a623' }}>Warning — Stockout in &lt; 7 Days</span>
            <span style={{ marginLeft:'auto', fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>
              {warning.length} alert{warning.length!==1?'s':''}
            </span>
          </div>
          <div style={{ padding:'8px 18px', borderBottom:'1px solid var(--border)',
            display:'grid', gridTemplateColumns:'28px 1fr 90px 90px 90px 100px 120px',
            gap:12, fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:'0.06em' }}>
            <span>#</span><span>STATION</span><span>FUEL</span><span>STOCK</span><span>VELOCITY</span><span>DAYS LEFT</span><span>STOCKOUT EST.</span>
          </div>
          {warning.map((r, i) => <AlertRow key={`${r.station_id}-${r.fuel_type}`} rec={r} rank={i+1}/>)}
        </Card>
      )}

      {critical.length === 0 && warning.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--accent)', fontFamily:'var(--mono)' }}>
          ✓ No alerts for selected fuel type
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
