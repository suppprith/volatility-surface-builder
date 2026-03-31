import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq


def bs_price(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> float:
    """Compute Black-Scholes option price."""
    if T <= 0 or sigma <= 0:
        return max(0.0, (S - K) if option_type == "call" else (K - S))

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option_type == "call":
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str = "call",
) -> float | None:
    """
    Solve for implied volatility using Brent's method.

    Returns None if root-finding fails (deep ITM/OTM, bad data, etc.).
    """
    if market_price <= 0 or T <= 0 or S <= 0 or K <= 0:
        return None

    # Intrinsic value check
    intrinsic = max(0.0, (S - K) if option_type == "call" else (K - S))
    if market_price < intrinsic * np.exp(-r * T) * 0.95:
        return None

    def objective(sigma: float) -> float:
        return bs_price(S, K, T, r, sigma, option_type) - market_price

    try:
        iv = brentq(objective, 1e-4, 5.0, xtol=1e-6, maxiter=200)
        return round(float(iv), 6)
    except (ValueError, RuntimeError):
        return None
