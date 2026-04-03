# BPC Fuel Intelligence System
### Bangladesh Petroleum Corporation — Predictive Fuel Demand Management

---

## Features

| Module | Description |
|---|---|
| **Heatmap** | 30-day fuel consumption density by Upazila using Leaflet choropleth circles. Filter by Petrol / Octane / Diesel. Click any zone to see breakdown. |
| **Demand Forecast** | 7-day prediction per station per fuel using linear-trend + weekly seasonality model. Shows historical 30-day bars + forecast line with 90% confidence band. |
| **Shortage Alerts** | Real-time stock/velocity ratio. Critical (<3 days), Warning (<7 days). Interactive alert map + district risk chart + full sortable table. |

---

## Dataset

- **56 stations** across 20 Upazilas in 8 districts
- **61,320 transaction records** (365 days: Apr 2025 – Mar 2026)
- **Fuel types**: Petrol · Octane · Diesel
- Realistic demand patterns: weekly cycles, monsoon seasonality, population-density-based demand

---

## Tech Stack

### Backend (Python / Flask)
- `Flask` — REST API
- `flask-cors` — Cross-origin support
- Pure Python forecasting (linear regression + weekly seasonality index, no heavy ML deps needed)
- All endpoints return JSON

### Frontend (React / Vite)
- `React 18` — UI framework
- `Recharts` — Charts (AreaChart, BarChart, ComposedChart)
- `Leaflet / react-leaflet` — Interactive maps
- `Axios` — API calls
- `Syne` + `IBM Plex Mono` — Typography

---

## Project Structure

```
fuel-system/
├── backend/
│   ├── app.py              ← Flask API (all endpoints)
│   ├── generate_data.py    ← Dummy dataset generator
│   ├── dataset.json        ← Generated dataset (auto-created)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    ← Root: header, nav, KPI strip
│   │   ├── api.js                     ← Axios API helpers
│   │   ├── index.css                  ← Global dark theme
│   │   └── components/
│   │       ├── UI.jsx                 ← Shared: KpiCard, Badge, StockBar…
│   │       ├── HeatmapTab.jsx         ← Feature 1
│   │       ├── ForecastTab.jsx        ← Feature 2
│   │       └── AlertsTab.jsx          ← Feature 3
│   └── package.json
├── start_backend.sh
├── start_frontend.sh
└── README.md
```

---

## Quick Start

### 1. Install backend deps
```bash
cd backend
pip install -r requirements.txt
```

### 2. Generate dataset (already done — skip if dataset.json exists)
```bash
python3 generate_data.py
```

### 3. Start backend (Terminal 1)
```bash
bash start_backend.sh
# → API running at http://localhost:5000
```

### 4. Start frontend (Terminal 2)
```bash
bash start_frontend.sh
# → App running at http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/summary` | KPI totals: stations, alerts, 7-day sales |
| GET | `/api/heatmap?fuel=all` | 30-day upazila consumption (filter: petrol/octane/diesel/all) |
| GET | `/api/stations` | All stations with alert levels |
| GET | `/api/forecast/{station_id}` | 7-day forecast + 30-day history per station |
| GET | `/api/alerts` | Full critical + warning alert lists |
| GET | `/api/upazila/{upazila_id}` | 30-day daily breakdown for one upazila |

---

## Forecasting Algorithm

The forecast uses a **custom linear trend + weekly seasonality** model (no external ML library required):

1. Fetch last 60 days of sales for station + fuel
2. Fit ordinary least-squares linear regression on time index → trend
3. Compute day-of-week seasonality index from residual ratios
4. Project next 7 days: `ŷ = (slope × t + intercept) × seasonality_dow`
5. 90% confidence interval using residual standard deviation

---

## Districts Covered

Dhaka · Chattogram · Sylhet · Rajshahi · Khulna · Barisal · Rangpur · Mymensingh · Comilla · Narayanganj · Gazipur

---

## Shortage Alert Logic

```
velocity  = AVG(litres_sold, last 7 days)
days_left = current_stock_litres / velocity

CRITICAL  → days_left < 3   (immediate refill required)
WARNING   → days_left < 7   (plan refill this week)
OK        → days_left >= 7
```
