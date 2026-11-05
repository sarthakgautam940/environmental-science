"""Fetch the real datasets used for the site's charts.

Sources
- NOAA NCEI U.S. Climate Normals 1991-2020 (monthly + annual/seasonal) via the
  NCEI Access Data Service: https://www.ncei.noaa.gov/access/services/data/v1
- USGS NWIS Statistics Service (monthly mean discharge):
  https://waterservices.usgs.gov/nwis/stat/

Run:  python3 tools/fetch_data.py
Writes JSON to site/assets/data/.
"""
import csv
import io
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "assets", "data")
UA = "Group6EcosystemsSite/1.0 (educational static site build)"

NCEI = "https://www.ncei.noaa.gov/access/services/data/v1"

STATIONS = {
    "fairbanks": {
        "id": "USW00026411",
        "name": "Fairbanks International Airport, Alaska",
        "lat": 64.8039, "lon": -147.8761, "elev_m": 132,
    },
    "quillayute": {
        "id": "USW00094240",
        "name": "Quillayute Airport (Olympic Peninsula), Washington",
        "lat": 47.9375, "lon": -124.555, "elev_m": 55,
    },
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def num(s):
    s = (s or "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def fetch_station(key, meta):
    monthly_url = (
        f"{NCEI}?dataset=normals-monthly-1991-2020&stations={meta['id']}"
        "&dataTypes=MLY-TMAX-NORMAL,MLY-TMIN-NORMAL,MLY-TAVG-NORMAL,MLY-PRCP-NORMAL,MLY-SNOW-NORMAL"
        "&format=csv&units=standard"
    )
    annual_url = (
        f"{NCEI}?dataset=normals-annualseasonal-1991-2020&stations={meta['id']}"
        "&dataTypes=ANN-TAVG-NORMAL,ANN-TMAX-NORMAL,ANN-TMIN-NORMAL,ANN-PRCP-NORMAL,ANN-SNOW-NORMAL,"
        "ANN-TMIN-PRBGSL-T32FP50,ANN-TMIN-PRBLST-T32FP50,ANN-TMIN-PRBFST-T32FP50"
        "&format=csv&units=standard"
    )
    rows = list(csv.DictReader(io.StringIO(get(monthly_url))))
    months = []
    for r in rows:
        tmax_f = num(r["MLY-TMAX-NORMAL"])
        tmin_f = num(r["MLY-TMIN-NORMAL"])
        tavg_f = num(r["MLY-TAVG-NORMAL"])
        prcp_in = num(r["MLY-PRCP-NORMAL"])
        snow_in = num(r.get("MLY-SNOW-NORMAL"))
        f2c = lambda f: None if f is None else round((f - 32) * 5 / 9, 1)
        months.append({
            "month": int(r["DATE"]),
            "tavg_f": tavg_f, "tmax_f": tmax_f, "tmin_f": tmin_f,
            "tavg_c": f2c(tavg_f), "tmax_c": f2c(tmax_f), "tmin_c": f2c(tmin_f),
            "prcp_in": prcp_in, "prcp_mm": None if prcp_in is None else round(prcp_in * 25.4, 1),
            "snow_in": snow_in, "snow_cm": None if snow_in is None else round(snow_in * 2.54, 1),
        })
    months.sort(key=lambda m: m["month"])
    a = list(csv.DictReader(io.StringIO(get(annual_url))))[0]
    annual = {k: (a.get(k) or "").strip() for k in a if k not in ("STATION", "DATE")}
    data = {
        "station": meta,
        "dataset": "NOAA NCEI U.S. Climate Normals, 1991-2020 (monthly and annual/seasonal normals)",
        "source_url": "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
        "query_urls": [monthly_url, annual_url],
        "months": months,
        "annual_raw_standard_units": annual,
    }
    with open(os.path.join(OUT, f"{key}-1991-2020.json"), "w") as f:
        json.dump(data, f, indent=1)
    print(key, "ok", [m["tavg_c"] for m in months])


def fetch_flow():
    site = "01578310"
    url = (
        "https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=" + site +
        "&statReportType=monthly&statTypeCd=mean&parameterCd=00060"
    )
    txt = get(url)
    lines = [l for l in txt.splitlines() if l and not l.startswith("#")]
    header = lines[0].split("\t")
    recs = [dict(zip(header, l.split("\t"))) for l in lines[2:]]
    # monthly mean discharge for each year/month -> average across years for each month
    by_month = {m: [] for m in range(1, 13)}
    years = set()
    for r in recs:
        try:
            m = int(r["month_nu"]); y = int(r["year_nu"]); v = float(r["mean_va"])
        except (KeyError, ValueError):
            continue
        by_month[m].append(v)
        years.add(y)
    out = {
        "site": site,
        "name": "Susquehanna River at Conowingo, Maryland (USGS 01578310)",
        "parameter": "Discharge, cubic feet per second (monthly means)",
        "source_url": "https://waterdata.usgs.gov/monitoring-location/01578310/",
        "query_url": url,
        "years": [min(years), max(years)],
        "n_years": len(years),
        "months": [
            {
                "month": m,
                "mean_cfs": round(sum(v) / len(v)),
                "mean_m3s": round(sum(v) / len(v) * 0.0283168, 0),
                "n": len(v),
            }
            for m, v in by_month.items() if v
        ],
    }
    with open(os.path.join(OUT, "susquehanna-flow.json"), "w") as f:
        json.dump(out, f, indent=1)
    print("flow ok", out["years"], [x["mean_cfs"] for x in out["months"]])


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for k, meta in STATIONS.items():
        fetch_station(k, meta)
    fetch_flow()
