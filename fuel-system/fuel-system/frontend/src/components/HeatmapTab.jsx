import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { api } from '../api';
import { SectionTitle, Spinner, Card, fmtNum } from './UI';

const FUEL_COLORS = {
  all:    ['#0d2b4a','#0f3d6e','#1558a0','#1a7dd4','#00d4a0'],
  petrol: ['#0d2040','#0f3060','#1a55aa','#2d7fe0','#60a5fa'],
  octane: ['#2b1a00','#4a2d00','#8b5500','#d4860f','#fbbf24'],
  diesel: ['#001f14','#003d28','#006d45','#00a86b','#34d399'],
};

function getColor(intensity, fuel) {
  const palette = FUEL_COLORS[fuel] || FUEL_COLORS.all;
  const idx = Math.min(Math.floor(intensity * (palette.length - 1)), palette.length - 1);
  return palette[idx];
}

export default function HeatmapTab() {
  const mapRef    = useRef(null);
  const leafletRef= useRef(null);
  const circlesRef= useRef([]);
  const [data, setData]       = useState([]);
  const [fuel, setFuel]       = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [stations, setStations] = useState([]);

  // Init map once
  useEffect(() => {
    if (leafletRef.current) return;
    const map = L.map(mapRef.current, {
      center: [23.6850, 90.3563],
      zoom: 7,
      zoomControl: true,
      attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ''
    }).addTo(map);
    leafletRef.current = map;
    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // Load stations for marker overlay
  useEffect(() => {
    api.stations().then(setStations).catch(console.error);
  }, []);

  // Load heatmap data when fuel changes
  useEffect(() => {
    setLoading(true);
    api.heatmap(fuel).then(d => { setData(d); setLoading(false); }).catch(console.error);
  }, [fuel]);

  // Draw circles on map
  useEffect(() => {
    if (!leafletRef.current || !data.length) return;
    const map = leafletRef.current;

    // Remove old circles
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    data.forEach(uz => {
      if (!uz.lat || !uz.lng) return;
      const radius = 4000 + uz.intensity * 18000;
      const color  = getColor(uz.intensity, fuel);
      const circle = L.circle([uz.lat, uz.lng], {
        radius,
        fillColor: color,
        fillOpacity: 0.55,
        color: color,
        weight: 1,
        opacity: 0.8
      }).addTo(map);

      circle.bindTooltip(`
        <div style="font-family:monospace;font-size:12px;background:#0d1628;color:#e2ebf8;border:1px solid #1a2e4a;padding:8px 12px;border-radius:6px">
          <b>${uz.upazila}</b>, ${uz.district}<br/>
          Total 30d: <b>${fmtNum(uz.total_30d)} L</b><br/>
          Stations: ${uz.station_count}
        </div>
      `, { sticky: true, className: 'custom-tip', opacity: 1 });

      circle.on('click', () => setSelected(uz));
      circlesRef.current.push(circle);
    });
  }, [data, fuel]);

  // Station alert markers
  useEffect(() => {
    if (!leafletRef.current || !stations.length) return;
    const map = leafletRef.current;
    stations.forEach(s => {
      if (s.worst_alert === 'ok') return;
      const color = s.worst_alert === 'critical' ? '#ef4444' : '#f5a623';
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: 5, fillColor: color, color:'#fff',
        weight: 1.5, fillOpacity: 1
      }).addTo(map);
      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;background:#0d1628;color:#e2ebf8;border:1px solid #1a2e4a;padding:6px 10px;border-radius:5px">
          <b>${s.name}</b><br/>${s.worst_alert.toUpperCase()} alert
        </div>`,
        { sticky: true, opacity: 1 }
      );
    });
  }, [stations]);

  const fuelBtns = [
    { key:'all',    label:'All Fuels' },
    { key:'petrol', label:'Petrol'    },
    { key:'octane', label:'Octane'    },
    { key:'diesel', label:'Diesel'    },
  ];

  const fuelKey = fuel === 'all' ? 'total_30d' : `${fuel}_30d`;
  const sorted  = [...data].sort((a, b) => b[fuelKey] - a[fuelKey]);
  const maxVal  = sorted[0]?.[fuelKey] || 1;

  const fuelColors = { petrol:'var(--petrol)', octane:'var(--octane)', diesel:'var(--diesel)', all:'var(--accent)' };
  const barColor   = fuelColors[fuel];

  return (
    <div>
      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {['petrol','octane','diesel'].map(f => {
          const total = data.reduce((s,u) => s + (u[`${f}_30d`]||0), 0);
          const colors2 = { petrol:'var(--petrol)', octane:'var(--octane)', diesel:'var(--diesel)' };
          return (
            <Card key={f} style={{ padding:'16px 20px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0,left:0,right:0,height:2, background:colors2[f] }}/>
              <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                {f} — 30 day total
              </div>
              <div style={{ fontSize:26, fontWeight:800, color: colors2[f] }}>{fmtNum(total)} L</div>
              <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:4 }}>
                avg {fmtNum(Math.round(total/30))}/day
              </div>
            </Card>
          );
        })}
      </div>

      <SectionTitle>Consumption Density Map</SectionTitle>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* Map */}
        <div>
          {/* Fuel toggle */}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {fuelBtns.map(b => (
              <button key={b.key} onClick={() => setFuel(b.key)} style={{
                padding:'6px 14px', borderRadius:20, border:'1px solid',
                borderColor: fuel===b.key ? fuelColors[b.key] : 'var(--border)',
                background: fuel===b.key ? `${fuelColors[b.key]}18` : 'transparent',
                color: fuel===b.key ? fuelColors[b.key] : 'var(--text2)',
                fontSize:12, cursor:'pointer', fontFamily:'var(--mono)', transition:'all .2s'
              }}>{b.label}</button>
            ))}
          </div>
          <div ref={mapRef} style={{ height:500, borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}/>
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>
            <span>Low</span>
            {FUEL_COLORS[fuel].map((c,i) => (
              <div key={i} style={{ width:24, height:10, borderRadius:2, background:c }}/>
            ))}
            <span>High</span>
            <span style={{ marginLeft:'auto' }}>
              ● Red/amber dots = shortage alert stations
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Selected upazila detail */}
          {selected && (
            <Card style={{ padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{selected.upazila}</div>
                  <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{selected.district} District</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none',border:'none',color:'var(--text2)',cursor:'pointer',fontSize:16 }}>✕</button>
              </div>
              {['petrol','octane','diesel'].map(f => (
                <div key={f} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:fuelColors[f], fontFamily:'var(--mono)' }}>{f}</span>
                    <span style={{ color:'var(--text)', fontFamily:'var(--mono)' }}>{fmtNum(selected[`${f}_30d`])} L</span>
                  </div>
                  <div style={{ height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ width:`${(selected[`${f}_30d`]/(selected.total_30d||1))*100}%`, height:'100%', background:fuelColors[f], borderRadius:3 }}/>
                  </div>
                </div>
              ))}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span style={{ color:'var(--text2)', fontFamily:'var(--mono)' }}>Total 30d</span>
                  <span style={{ fontWeight:700 }}>{fmtNum(selected.total_30d)} L</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:6 }}>
                  <span style={{ color:'var(--text2)', fontFamily:'var(--mono)' }}>Stations</span>
                  <span style={{ fontWeight:700 }}>{selected.station_count}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Ranking */}
          <Card style={{ padding:0, flex:1, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                Top Upazilas by Consumption
              </div>
            </div>
            <div style={{ overflowY:'auto', maxHeight:370 }}>
              {loading ? <Spinner/> : sorted.slice(0,20).map((uz, i) => {
                const val = uz[fuelKey];
                const pct = (val / maxVal) * 100;
                return (
                  <div key={uz.upazila_id} onClick={() => setSelected(uz)}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'9px 16px', borderBottom:'1px solid rgba(26,46,74,.5)',
                      cursor:'pointer', transition:'background .15s',
                      background: selected?.upazila_id === uz.upazila_id ? 'var(--accent-dim)' : 'transparent'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background= selected?.upazila_id===uz.upazila_id?'var(--accent-dim)':'transparent'}
                  >
                    <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', width:16 }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {uz.upazila}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'var(--mono)' }}>{uz.district}</div>
                    </div>
                    <div style={{ width:70 }}>
                      <div style={{ height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:2 }}/>
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text2)', width:50, textAlign:'right' }}>
                      {fmtNum(val)}L
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
