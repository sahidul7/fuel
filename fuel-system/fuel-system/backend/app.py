from flask import Flask, jsonify, request
from flask_cors import CORS
import json, math
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

app = Flask(__name__)
CORS(app)

# ── Load dataset ──────────────────────────────────────────────
with open("dataset.json") as f:
    DB = json.load(f)

UPAZILAS   = {u["id"]: u for u in DB["upazilas"]}
STATIONS   = {s["id"]: s for s in DB["stations"]}
TXNS       = DB["transactions"]

# Pre-index transactions: station_id → fuel_type → list of (date_str, litres)
def _build_index():
    idx = defaultdict(lambda: defaultdict(list))
    for t in TXNS:
        idx[t["station_id"]][t["fuel_type"]].append((t["date"], t["litres_sold"]))
    # sort by date
    for sid in idx:
        for ft in idx[sid]:
            idx[sid][ft].sort(key=lambda x: x[0])
    return idx

TXN_IDX = _build_index()

TODAY = "2026-03-31"
TODAY_DT = datetime.strptime(TODAY, "%Y-%m-%d")

# ── Helper: get last N days of sales ──────────────────────────
def last_n_days(station_id, fuel_type, n=7):
    cutoff = (TODAY_DT - timedelta(days=n)).strftime("%Y-%m-%d")
    rows = TXN_IDX[station_id][fuel_type]
    return [(d, l) for d, l in rows if d > cutoff]

def avg_daily(station_id, fuel_type, n=7):
    rows = last_n_days(station_id, fuel_type, n)
    if not rows:
        return 0
    return sum(l for _, l in rows) / n

# ── Simple linear-trend forecast (no external deps needed) ─────
def forecast_7days(station_id, fuel_type):
    """
    Uses last 60 days. Fits linear trend + 7-day weekly seasonality.
    Returns 7 future day predictions with confidence interval.
    """
    # grab last 60 days
    cutoff = (TODAY_DT - timedelta(days=60)).strftime("%Y-%m-%d")
    rows = [(d, l) for d, l in TXN_IDX[station_id][fuel_type] if d >= cutoff]
    if len(rows) < 14:
        return []

    rows.sort(key=lambda x: x[0])
    n = len(rows)
    xs = list(range(n))
    ys = [r[1] for r in rows]

    # Linear regression
    xbar = sum(xs) / n
    ybar = sum(ys) / n
    ss_xy = sum((xs[i] - xbar) * (ys[i] - ybar) for i in range(n))
    ss_xx = sum((xs[i] - xbar) ** 2 for i in range(n))
    slope = ss_xy / ss_xx if ss_xx else 0
    intercept = ybar - slope * xbar

    # Weekly seasonality index (dow 0=Mon)
    dow_totals = defaultdict(list)
    for i, (d, l) in enumerate(rows):
        dow = datetime.strptime(d, "%Y-%m-%d").weekday()
        trend_val = slope * i + intercept
        if trend_val > 0:
            dow_totals[dow].append(l / trend_val)
    dow_idx = {}
    for dow, vals in dow_totals.items():
        dow_idx[dow] = sum(vals) / len(vals) if vals else 1.0

    # Residuals for confidence interval
    residuals = []
    for i, (d, l) in enumerate(rows):
        pred = (slope * i + intercept) * dow_idx.get(datetime.strptime(d, "%Y-%m-%d").weekday(), 1.0)
        residuals.append(abs(l - pred))
    std = statistics.stdev(residuals) if len(residuals) > 1 else ybar * 0.08
    margin = 1.65 * std  # 90% CI

    results = []
    for k in range(1, 8):
        future_dt = TODAY_DT + timedelta(days=k)
        x_future = n - 1 + k
        trend = slope * x_future + intercept
        dow = future_dt.weekday()
        seasonal = dow_idx.get(dow, 1.0)
        yhat = max(0, trend * seasonal)
        results.append({
            "date": future_dt.strftime("%Y-%m-%d"),
            "day": future_dt.strftime("%a"),
            "predicted": round(yhat),
            "lower": round(max(0, yhat - margin)),
            "upper": round(yhat + margin)
        })
    return results

# ── ENDPOINT 1: KPI Summary ────────────────────────────────────
@app.route("/api/summary")
def summary():
    total_stations = len(STATIONS)
    
    # Total sales last 7 days across all stations/fuels
    total_7d = {"petrol": 0, "octane": 0, "diesel": 0}
    critical_count = 0
    warning_count  = 0

    for sid, station in STATIONS.items():
        for fuel in ["petrol", "octane", "diesel"]:
            velocity = avg_daily(sid, fuel, 7)
            total_7d[fuel] += velocity * 7
            stock = station["current_stock"][fuel]
            days_rem = stock / velocity if velocity > 0 else 999
            if days_rem < 3:
                critical_count += 1
            elif days_rem < 7:
                warning_count += 1

    return jsonify({
        "total_stations": total_stations,
        "critical_alerts": critical_count,
        "warning_alerts": warning_count,
        "total_7d_litres": {k: round(v) for k, v in total_7d.items()},
        "total_7d_combined": round(sum(total_7d.values()))
    })

# ── ENDPOINT 2: Heatmap data ───────────────────────────────────
@app.route("/api/heatmap")
def heatmap():
    fuel = request.args.get("fuel", "all")
    fuels = ["petrol", "octane", "diesel"] if fuel == "all" else [fuel]

    upazila_totals = defaultdict(lambda: {"petrol": 0, "octane": 0, "diesel": 0, "total": 0})

    for sid, station in STATIONS.items():
        uz_id = station["upazila_id"]
        for ft in fuels:
            rows = last_n_days(sid, ft, 30)
            total = sum(l for _, l in rows)
            upazila_totals[uz_id][ft] += total
            upazila_totals[uz_id]["total"] += total

    results = []
    all_totals = [v["total"] for v in upazila_totals.values() if v["total"] > 0]
    max_total  = max(all_totals) if all_totals else 1

    for uz_id, totals in upazila_totals.items():
        uz = UPAZILAS.get(uz_id, {})
        intensity = totals["total"] / max_total
        results.append({
            "upazila_id": uz_id,
            "upazila": uz.get("name", uz_id),
            "district": uz.get("district", ""),
            "lat": uz.get("lat", 0),
            "lng": uz.get("lng", 0),
            "petrol_30d":  round(totals["petrol"]),
            "octane_30d":  round(totals["octane"]),
            "diesel_30d":  round(totals["diesel"]),
            "total_30d":   round(totals["total"]),
            "intensity":   round(intensity, 4),
            "station_count": sum(1 for s in STATIONS.values() if s["upazila_id"] == uz_id)
        })

    results.sort(key=lambda x: x["total_30d"], reverse=True)
    return jsonify(results)

# ── ENDPOINT 3: All stations list ─────────────────────────────
@app.route("/api/stations")
def stations():
    out = []
    for sid, station in STATIONS.items():
        alert_levels = {}
        for fuel in ["petrol", "octane", "diesel"]:
            v = avg_daily(sid, fuel, 7)
            stock = station["current_stock"][fuel]
            days = round(stock / v, 1) if v > 0 else 999
            level = "critical" if days < 3 else ("warning" if days < 7 else "ok")
            alert_levels[fuel] = {"days_remaining": days, "level": level, "velocity": round(v)}

        worst = "ok"
        for al in alert_levels.values():
            if al["level"] == "critical": worst = "critical"; break
            if al["level"] == "warning": worst = "warning"

        out.append({
            "id": sid,
            "name": station["name"],
            "upazila": station["upazila"],
            "district": station["district"],
            "lat": station["lat"],
            "lng": station["lng"],
            "current_stock": station["current_stock"],
            "capacity": station["capacity"],
            "alert_levels": alert_levels,
            "worst_alert": worst
        })

    out.sort(key=lambda x: (0 if x["worst_alert"]=="critical" else 1 if x["worst_alert"]=="warning" else 2, x["name"]))
    return jsonify(out)

# ── ENDPOINT 4: Forecast for one station ──────────────────────
@app.route("/api/forecast/<station_id>")
def forecast(station_id):
    if station_id not in STATIONS:
        return jsonify({"error": "Station not found"}), 404

    station = STATIONS[station_id]
    result = {"station": station, "forecasts": {}}

    for fuel in ["petrol", "octane", "diesel"]:
        days = forecast_7days(station_id, fuel)
        velocity = avg_daily(station_id, fuel, 7)
        stock = station["current_stock"][fuel]
        days_rem = round(stock / velocity, 1) if velocity > 0 else 999

        # Historical last 30 days
        hist_rows = [(d, l) for d, l in TXN_IDX[station_id][fuel]
                     if d >= (TODAY_DT - timedelta(days=30)).strftime("%Y-%m-%d")]
        hist_rows.sort(key=lambda x: x[0])

        result["forecasts"][fuel] = {
            "forecast_7d": days,
            "avg_daily_velocity": round(velocity),
            "current_stock": stock,
            "days_remaining": min(days_rem, 999),
            "alert_level": "critical" if days_rem < 3 else ("warning" if days_rem < 7 else "ok"),
            "historical_30d": [{"date": d, "litres": l} for d, l in hist_rows[-30:]]
        }

    return jsonify(result)

# ── ENDPOINT 5: Shortage alerts ───────────────────────────────
@app.route("/api/alerts")
def alerts():
    critical = []
    warning  = []

    for sid, station in STATIONS.items():
        for fuel in ["petrol", "octane", "diesel"]:
            velocity = avg_daily(sid, fuel, 7)
            stock = station["current_stock"][fuel]
            days_rem = stock / velocity if velocity > 0 else 999

            record = {
                "station_id": sid,
                "station_name": station["name"],
                "upazila": station["upazila"],
                "district": station["district"],
                "lat": station["lat"],
                "lng": station["lng"],
                "fuel_type": fuel,
                "current_stock": stock,
                "daily_velocity": round(velocity),
                "days_remaining": round(days_rem, 1),
                "estimated_stockout": (TODAY_DT + timedelta(days=days_rem)).strftime("%Y-%m-%d") if days_rem < 30 else None
            }

            if days_rem < 3:
                critical.append(record)
            elif days_rem < 7:
                warning.append(record)

    critical.sort(key=lambda x: x["days_remaining"])
    warning.sort(key=lambda x: x["days_remaining"])

    return jsonify({
        "as_of": TODAY,
        "critical": critical,
        "warning": warning,
        "summary": {
            "critical_count": len(critical),
            "warning_count": len(warning),
            "total_at_risk": len(critical) + len(warning)
        }
    })

# ── ENDPOINT 6: Upazila breakdown for one upazila ────────────
@app.route("/api/upazila/<upazila_id>")
def upazila_detail(upazila_id):
    uz = UPAZILAS.get(upazila_id)
    if not uz:
        return jsonify({"error": "Not found"}), 404

    stations_in = [s for s in STATIONS.values() if s["upazila_id"] == upazila_id]
    
    # 30-day daily totals for chart
    daily = defaultdict(lambda: {"petrol":0,"octane":0,"diesel":0})
    for station in stations_in:
        for fuel in ["petrol","octane","diesel"]:
            rows = [(d,l) for d,l in TXN_IDX[station["id"]][fuel]
                    if d >= (TODAY_DT - timedelta(days=29)).strftime("%Y-%m-%d")]
            for d, l in rows:
                daily[d][fuel] += l

    daily_list = sorted([{"date":d,"petrol":v["petrol"],"octane":v["octane"],"diesel":v["diesel"]} for d,v in daily.items()], key=lambda x: x["date"])

    return jsonify({
        "upazila": uz,
        "station_count": len(stations_in),
        "daily_30d": daily_list
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
