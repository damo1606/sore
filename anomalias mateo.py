import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import norm
from datetime import datetime
import matplotlib.pyplot as plt

# -----------------------------
# CONFIGURACION
# -----------------------------

UNDERLYING = "SPY"
TARGET_EXPIRATION = None
RISK_FREE_RATE = 0.05

# -----------------------------
# FUNCION GAMMA BLACK SCHOLES
# -----------------------------

def gamma_bs(S, K, T, r, sigma):
    
    if T <= 0 or sigma <= 0:
        return 0

    d1 = (np.log(S/K) + (r + sigma**2/2)*T) / (sigma*np.sqrt(T))
    
    gamma = norm.pdf(d1) / (S*sigma*np.sqrt(T))
    
    return gamma


# -----------------------------
# DESCARGAR DATOS
# -----------------------------

ticker = yf.Ticker(UNDERLYING)

spot = ticker.history(period="1d")["Close"].iloc[-1]

print("Spot:", spot)

if TARGET_EXPIRATION is None:
    TARGET_EXPIRATION = ticker.options[0]

opt = ticker.option_chain(TARGET_EXPIRATION)

calls = opt.calls
puts = opt.puts

calls["type"] = "call"
puts["type"] = "put"

df = pd.concat([calls, puts])

# -----------------------------
# TIEMPO A EXPIRACION
# -----------------------------

today = datetime.now()
exp = datetime.strptime(TARGET_EXPIRATION, "%Y-%m-%d")

T = (exp - today).days / 365

# -----------------------------
# CALCULO GEX
# -----------------------------

gammas = []

for i,row in df.iterrows():
    
    K = row["strike"]
    iv = row["impliedVolatility"]
    oi = row["openInterest"]

    g = gamma_bs(spot,K,T,RISK_FREE_RATE,iv)
    
    gex = g * oi * 100 * spot**2
    
    if row["type"] == "put":
        gex = -gex
        
    gammas.append(gex)

df["GEX"] = gammas

# -----------------------------
# AGRUPAR POR STRIKE
# -----------------------------

gex_by_strike = df.groupby("strike")["GEX"].sum().reset_index()

# -----------------------------
# CALL WALL / PUT WALL
# -----------------------------

call_wall = calls.loc[calls["openInterest"].idxmax()]

put_wall = puts.loc[puts["openInterest"].idxmax()]

print("\nCall Wall:", call_wall["strike"])
print("Put Wall:", put_wall["strike"])

# -----------------------------
# GAMMA FLIP
# -----------------------------

gex_by_strike["cum_gex"] = gex_by_strike["GEX"].cumsum()

gamma_flip = gex_by_strike.iloc[(gex_by_strike["cum_gex"].abs()).argsort()[:1]]

print("\nGamma Flip Level:")
print(gamma_flip)

# -----------------------------
# DEALER HEDGING FLOW MODEL
# -----------------------------

price_range = np.linspace(spot*0.8, spot*1.2, 50)

dealer_flows = []

for price in price_range:

    total_gex = 0

    for i,row in df.iterrows():

        K = row["strike"]
        iv = row["impliedVolatility"]
        oi = row["openInterest"]

        g = gamma_bs(price,K,T,RISK_FREE_RATE,iv)
        
        gex = g * oi * 100 * price**2
        
        if row["type"] == "put":
            gex = -gex
        
        total_gex += gex
        
    dealer_flows.append(total_gex)

# -----------------------------
# GRAFICOS
# -----------------------------

plt.figure(figsize=(12,6))

plt.bar(gex_by_strike["strike"], gex_by_strike["GEX"]/1e9)

plt.axvline(spot,color="black",label="Spot")

plt.title("Gamma Exposure Profile")
plt.xlabel("Strike")
plt.ylabel("GEX (Billions)")

plt.legend()

plt.show()


plt.figure(figsize=(12,6))

plt.plot(price_range,dealer_flows)

plt.axvline(spot,color="black")

plt.title("Dealer Hedging Flow Model")

plt.xlabel("Price")
plt.ylabel("Dealer Hedge Pressure")

plt.show()

# -----------------------------
# EXPORTAR
# -----------------------------

df.to_excel(f"GEX_{UNDERLYING}_{TARGET_EXPIRATION}.xlsx", index=False)