import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

_cached_rate: float | None = None
_cache_timestamp: float = 0.0
_CACHE_TTL = 86400  # 24 hours

FALLBACK_RATE = 0.0425


def get_risk_free_rate() -> float:
    """
    Fetch the 10-Year Treasury rate from FRED (DGS10).

    Returns cached value if fetched within the last 24 hours.
    Falls back to a hardcoded rate if the API call fails.
    """
    global _cached_rate, _cache_timestamp

    if _cached_rate is not None and (time.time() - _cache_timestamp) < _CACHE_TTL:
        return _cached_rate

    api_key = os.getenv("FRED_API_KEY")
    if not api_key or api_key == "your_fred_api_key_here":
        return FALLBACK_RATE

    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": "DGS10",
        "api_key": api_key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 5,
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        observations = resp.json().get("observations", [])

        for obs in observations:
            value = obs.get("value", ".")
            if value != ".":
                rate = float(value) / 100.0
                if 0.0 < rate < 0.20:
                    _cached_rate = rate
                    _cache_timestamp = time.time()
                    return rate

        return FALLBACK_RATE
    except Exception:
        return FALLBACK_RATE
