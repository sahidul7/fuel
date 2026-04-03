import json, random, math
from datetime import datetime, timedelta

random.seed(42)

# 8 real Bangladesh districts with real upazilas
UPAZILAS = [
    {"id":"dhaka-01","name":"Mirpur","district":"Dhaka","lat":23.8103,"lng":90.3654,"pop_density":"very_high"},
    {"id":"dhaka-02","name":"Uttara","district":"Dhaka","lat":23.8759,"lng":90.3795,"pop_density":"very_high"},
    {"id":"dhaka-03","name":"Demra","district":"Dhaka","lat":23.7317,"lng":90.4576,"pop_density":"high"},
    {"id":"dhaka-04","name":"Keraniganj","district":"Dhaka","lat":23.7161,"lng":90.3009,"pop_density":"high"},
    {"id":"ctg-01","name":"Panchlaish","district":"Chattogram","lat":22.3569,"lng":91.8320,"pop_density":"very_high"},
    {"id":"ctg-02","name":"Hathazari","district":"Chattogram","lat":22.5082,"lng":91.8030,"pop_density":"medium"},
    {"id":"ctg-03","name":"Sitakunda","district":"Chattogram","lat":22.6234,"lng":91.6603,"pop_density":"medium"},
    {"id":"ctg-04","name":"Banshkhali","district":"Chattogram","lat":22.0135,"lng":92.0135,"pop_density":"low"},
    {"id":"sylhet-01","name":"Sylhet Sadar","district":"Sylhet","lat":24.8949,"lng":91.8687,"pop_density":"high"},
    {"id":"sylhet-02","name":"Bianibazar","district":"Sylhet","lat":24.9060,"lng":92.1137,"pop_density":"medium"},
    {"id":"rajshahi-01","name":"Rajshahi Sadar","district":"Rajshahi","lat":24.3745,"lng":88.6042,"pop_density":"high"},
    {"id":"rajshahi-02","name":"Paba","district":"Rajshahi","lat":24.3780,"lng":88.5640,"pop_density":"medium"},
    {"id":"khulna-01","name":"Khulna Sadar","district":"Khulna","lat":22.8456,"lng":89.5403,"pop_density":"high"},
    {"id":"khulna-02","name":"Dumuria","district":"Khulna","lat":22.8065,"lng":89.4499,"pop_density":"medium"},
    {"id":"barisal-01","name":"Barisal Sadar","district":"Barisal","lat":22.7010,"lng":90.3535,"pop_density":"medium"},
    {"id":"rangpur-01","name":"Rangpur Sadar","district":"Rangpur","lat":25.7439,"lng":89.2752,"pop_density":"medium"},
    {"id":"mymensingh-01","name":"Mymensingh Sadar","district":"Mymensingh","lat":24.7471,"lng":90.4203,"pop_density":"high"},
    {"id":"comilla-01","name":"Comilla Sadar","district":"Comilla","lat":23.4607,"lng":91.1809,"pop_density":"high"},
    {"id":"narayanganj-01","name":"Narayanganj Sadar","district":"Narayanganj","lat":23.6238,"lng":90.5000,"pop_density":"very_high"},
    {"id":"gazipur-01","name":"Gazipur Sadar","district":"Gazipur","lat":23.9999,"lng":90.4203,"pop_density":"very_high"},
]

POP_BASE = {"very_high": 2200, "high": 1400, "medium": 800, "low": 400}

STATIONS = []
sid = 1
for uz in UPAZILAS:
    base = POP_BASE[uz["pop_density"]]
    count = {"very_high":4,"high":3,"medium":2,"low":1}[uz["pop_density"]]
    for i in range(count):
        lat_offset = random.uniform(-0.03, 0.03)
        lng_offset = random.uniform(-0.03, 0.03)
        stock_petrol  = random.randint(5000, 40000)
        stock_octane  = random.randint(3000, 25000)
        stock_diesel  = random.randint(8000, 60000)
        STATIONS.append({
            "id": f"ST{sid:03d}",
            "name": f"{uz['name']} FS-{i+1}",
            "upazila_id": uz["id"],
            "upazila": uz["name"],
            "district": uz["district"],
            "lat": uz["lat"] + lat_offset,
            "lng": uz["lng"] + lng_offset,
            "current_stock": {
                "petrol": stock_petrol,
                "octane": stock_octane,
                "diesel": stock_diesel
            },
            "capacity": {
                "petrol": 50000,
                "octane": 30000,
                "diesel": 80000
            },
            "base_demand": base,
            "pop_density": uz["pop_density"]
        })
        sid += 1

def demand_factor(date, fuel_type, pop_density):
    """Realistic demand based on day, season, fuel type."""
    dow = date.weekday()  # 0=Mon,4=Fri,5=Sat,6=Sun
    month = date.month
    
    # Weekly pattern - Friday prayer day, Sat-Sun higher traffic in BD
    weekly = {0:1.0,1:1.05,2:1.0,3:0.95,4:0.85,5:1.15,6:1.10}[dow]
    
    # Seasonal - monsoon (Jun-Sep) reduces petrol/octane, diesel stable
    if fuel_type == "diesel":
        seasonal = {1:1.0,2:0.95,3:1.05,4:1.1,5:1.05,6:0.95,7:0.9,8:0.92,9:0.98,10:1.05,11:1.1,12:1.05}[month]
    else:
        seasonal = {1:1.0,2:1.05,3:1.1,4:1.05,5:0.95,6:0.85,7:0.80,8:0.82,9:0.90,10:1.0,11:1.05,12:1.02}[month]
    
    # Fuel type base ratios
    type_factor = {"petrol":0.55,"octane":0.25,"diesel":1.0}[fuel_type]
    
    noise = random.gauss(1.0, 0.06)
    return max(0.5, weekly * seasonal * type_factor * noise)

# Generate 365 days of transactions
end_date = datetime(2026, 3, 31)
start_date = end_date - timedelta(days=364)

TRANSACTIONS = []
txn_id = 1
for station in STATIONS:
    base = station["base_demand"]
    for delta in range(365):
        date = start_date + timedelta(days=delta)
        for fuel in ["petrol","octane","diesel"]:
            factor = demand_factor(date, fuel, station["pop_density"])
            litres = round(base * factor * random.uniform(0.9, 1.1))
            TRANSACTIONS.append({
                "id": txn_id,
                "station_id": station["id"],
                "date": date.strftime("%Y-%m-%d"),
                "fuel_type": fuel,
                "litres_sold": litres
            })
            txn_id += 1

data = {
    "upazilas": UPAZILAS,
    "stations": STATIONS,
    "transactions": TRANSACTIONS
}

with open("dataset.json","w") as f:
    json.dump(data, f)

print(f"Generated: {len(STATIONS)} stations, {len(TRANSACTIONS)} transaction records")
print(f"Date range: {start_date.date()} to {end_date.date()}")
