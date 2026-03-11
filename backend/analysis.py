import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import norm
from datetime import datetime
from typing import Optional

RISK_FREE_RATE = 0.05
CONTRACT_SIZE = 100

def gamma_bs(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    return float(norm.pdf(d1) / (S * sigma * np.sqrt(T)))

def vanna_bs(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return float(-norm.pdf(d1) * d2 / sigma)

def charm_bs(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return float(-norm.pdf(d1) * (2 * r * T - d2 * sigma * np.sqrt(T)) / (2 * T * sigma * np.sqrt(T)))

def get_expirations(ticker: str):
    t = yf.Ticker(ticker)
    return {"expirations": list(t.options)}

def run_analysis(ticker: str, expiration: Optional[str] = None):
    t = yf.Ticker(ticker)
    hist = t.history(period="2d")
    if hist.empty:
        raise ValueError(f"No price data for {ticker}")
    spot = float(hist["Close"].iloc[-1])

    available = list(t.options)
    if not available:
        raise ValueError(f"No options data for {ticker}")
    if expiration is None:
        expiration = available[0]
    elif expiration not in available:
        raise ValueError(f"Expiration {expiration} not available")

    chain = t.option_chain(expiration)
    calls = chain.calls.copy()
    puts = chain.puts.copy()

    calls["type"] = "call"
    puts["type"] = "put"
    df = pd.concat([calls, puts], ignore_index=True)
    df = df[df["impliedVolatility"] > 0]
    df = df[df["openInterest"] > 100]

    today = datetime.now()
    exp_date = datetime.strptime(expiration, "%Y-%m-%d")
    T = max((exp_date - today).days / 365, 0.001)

    gex_list, vanna_list, charm_list = [], [], []

    for _, row in df.iterrows():
        K = row["strike"]
        iv = row["impliedVolatility"]
        oi = row["openInterest"]

        g = gamma_bs(spot, K, T, RISK_FREE_RATE, iv)
        v = vanna_bs(spot, K, T, RISK_FREE_RATE, iv)
        c = charm_bs(spot, K, T, RISK_FREE_RATE, iv)

        gex = g * oi * CONTRACT_SIZE * spot ** 2
        v_ex = v * oi * CONTRACT_SIZE
        c_ex = c * oi * CONTRACT_SIZE

        if row["type"] == "put":
            gex, v_ex, c_ex = -gex, -v_ex, -c_ex

        gex_list.append(gex)
        vanna_list.append(v_ex)
        charm_list.append(c_ex)

    df["GEX"] = gex_list
    df["Vanna"] = vanna_list
    df["Charm"] = charm_list

    gex_by_strike = df.groupby("strike")["GEX"].sum().reset_index()
    vanna_by_strike = df.groupby("strike")["Vanna"].sum().reset_index()

    calls_df = df[df["type"] == "call"]
    puts_df = df[df["type"] == "put"]

    call_wall = float(calls_df.loc[calls_df["openInterest"].idxmax(), "strike"])
    put_wall = float(puts_df.loc[puts_df["openInterest"].idxmax(), "strike"])

    gex_by_strike["cum_gex"] = gex_by_strike["GEX"].cumsum()
    gamma_flip_idx = int((gex_by_strike["cum_gex"].abs()).argsort().iloc[0])
    gamma_flip = float(gex_by_strike.iloc[gamma_flip_idx]["strike"])

    support = float(gex_by_strike.loc[gex_by_strike["GEX"].idxmax(), "strike"])
    resistance = float(gex_by_strike.loc[gex_by_strike["GEX"].idxmin(), "strike"])

    price_range = np.linspace(spot * 0.85, spot * 1.15, 60).tolist()
    dealer_flows = []

    for price in price_range:
        total = 0.0
        for _, row in df.iterrows():
            K = row["strike"]
            iv = row["impliedVolatility"]
            oi = row["openInterest"]
            g = gamma_bs(price, K, T, RISK_FREE_RATE, iv)
            gex = g * oi * CONTRACT_SIZE * price ** 2
            if row["type"] == "put":
                gex = -gex
            total += gex
        dealer_flows.append(total)

    return {
        "ticker": ticker,
        "spot": spot,
        "expiration": expiration,
        "available_expirations": available[:12],
        "levels": {
            "call_wall": call_wall,
            "put_wall": put_wall,
            "gamma_flip": gamma_flip,
            "support": support,
            "resistance": resistance,
        },
        "gex_profile": gex_by_strike.rename(columns={"GEX": "gex"}).to_dict(orient="records"),
        "vanna_profile": vanna_by_strike.rename(columns={"Vanna": "vanna"}).to_dict(orient="records"),
        "dealer_flow": {
            "prices": price_range,
            "flows": dealer_flows,
        },
    }
