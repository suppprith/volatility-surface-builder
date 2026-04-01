from datetime import datetime
import yfinance as yf
import numpy as np

from iv_engine import implied_volatility


def fetch_surface_data(
    ticker_symbol: str,
    risk_free_rate: float,
    option_type: str = "call",
) -> dict:
    """
    Fetch options chain data from yfinance, compute implied volatility for
    every strike/expiry pair, and return structured surface data.

    Returns:
        {
            "spot_price": float,
            "expirations": [str, ...],
            "surface_data": [{"strike": float, "dte": float, "expiration": str, "iv": float, "mid_price": float}, ...]
        }
    """
    ticker = yf.Ticker(ticker_symbol)

    # Get current spot price
    history = ticker.history(period="1d")
    if history.empty:
        raise ValueError(f"Could not fetch price data for '{ticker_symbol}'")
    spot_price = float(history["Close"].iloc[-1])

    expirations = ticker.options
    if not expirations:
        raise ValueError(f"No options data available for '{ticker_symbol}'")

    today = datetime.now()
    surface_data = []

    for exp_date_str in expirations:
        exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d")
        dte = (exp_date - today).days
        if dte <= 0:
            continue

        T = dte / 365.0

        try:
            chain = ticker.option_chain(exp_date_str)
        except Exception:
            continue

        if chain is None:
            continue
            
        opts = chain.calls if option_type == "call" else chain.puts
        
        if opts is None or opts.empty:
            continue

        for _, row in opts.iterrows():
            strike = float(row["strike"])
            bid = float(row.get("bid", 0) or 0)
            ask = float(row.get("ask", 0) or 0)
            last_price = float(row.get("lastPrice", 0) or 0)

            raw_vol = row.get("volume", 0)
            volume = int(raw_vol) if raw_vol is not None and not np.isnan(raw_vol) else 0
            raw_oi = row.get("openInterest", 0)
            open_interest = int(raw_oi) if raw_oi is not None and not np.isnan(raw_oi) else 0

            # Compute mid-price, fall back to lastPrice
            if bid > 0 and ask > 0:
                mid_price = (bid + ask) / 2.0
            elif last_price > 0:
                mid_price = last_price
            else:
                continue

            # Filter illiquid options – require meaningful activity
            if open_interest < 10 and volume < 5:
                continue

            # Skip wide bid-ask spreads (unreliable mid-price)
            if bid > 0 and ask > 0 and ask > 0:
                spread_pct = (ask - bid) / mid_price
                if spread_pct > 0.6:
                    continue

            # Filter strikes too far from spot
            moneyness = strike / spot_price
            if moneyness < 0.5 or moneyness > 2.0:
                continue

            iv = implied_volatility(
                market_price=mid_price,
                S=spot_price,
                K=strike,
                T=T,
                r=risk_free_rate,
                option_type=option_type,
            )

            if iv is not None and 0.01 <= iv <= 2.0:
                surface_data.append(
                    {
                        "strike": round(strike, 2),
                        "dte": dte,
                        "expiration": exp_date_str,
                        "iv": round(iv, 4),
                        "mid_price": round(mid_price, 2),
                    }
                )

    # ── IQR-based outlier removal ────────────────────────────────
    if surface_data:
        ivs = np.array([d["iv"] for d in surface_data])
        q1, q3 = np.percentile(ivs, 25), np.percentile(ivs, 75)
        iqr = q3 - q1
        lower, upper = q1 - 2.0 * iqr, q3 + 2.0 * iqr
        surface_data = [d for d in surface_data if lower <= d["iv"] <= upper]

    return {
        "spot_price": round(spot_price, 2),
        "expirations": list(expirations),
        "surface_data": surface_data,
    }
