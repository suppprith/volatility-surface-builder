from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from curl_cffi import requests as cf_requests
from yfinance.data import YfData

from risk_free_rate import get_risk_free_rate
from options_data import fetch_surface_data

# curl_cffi (used by yfinance) cannot verify SSL on some systems (e.g. corporate proxies).
# Inject a session with verify=False so all yfinance calls succeed.
YfData(session=cf_requests.Session(impersonate="chrome", verify=False))

app = FastAPI(title="Volatility Surface Builder", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/surface")
def get_surface(
    ticker: str = Query(..., min_length=1, max_length=10, pattern=r"^[A-Za-z.]+$"),
    option_type: str = Query("call", pattern=r"^(call|put)$"),
):
    """
    Fetch options chain data and compute implied volatility surface.
    """
    risk_free_rate = get_risk_free_rate()

    try:
        data = fetch_surface_data(
            ticker_symbol=ticker.upper(),
            risk_free_rate=risk_free_rate,
            option_type=option_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

    if not data["surface_data"]:
        raise HTTPException(
            status_code=404,
            detail=f"No valid implied volatility data found for '{ticker.upper()}'",
        )

    return {
        "ticker": ticker.upper(),
        "option_type": option_type,
        "spot_price": data["spot_price"],
        "risk_free_rate": round(risk_free_rate, 4),
        "expirations": data["expirations"],
        "data_points": len(data["surface_data"]),
        "surface_data": data["surface_data"],
    }
