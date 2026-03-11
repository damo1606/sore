import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import norm
from datetime import datetime
import matplotlib.pyplot as plt

# =============================
# CONFIGURACION
# =============================

UNDERLYING = "SPY"
RISK_FREE_RATE = 0.05

# =============================
# FUNCIONES BLACK SCHOLES
# =============================

def calc_d1(S,K,T,r,vol):
    return (np.log(S/K)+(r+0.5*vol**2)*T)/(vol*np.sqrt(T))

def gamma(S,K,T,r,vol):
    d1 = calc_d1(S,K,T,r,vol)
    return norm.pdf(d1)/(S*vol*np.sqrt(T))

def vanna(S,K,T,r,vol):
    d1 = calc_d1(S,K,T,r,vol)
    d2 = d1-vol*np.sqrt(T)
    return -norm.pdf(d1)*d2/vol

def charm(S,K,T,r,vol):
    d1 = calc_d1(S,K,T,r,vol)
    d2 = d1-vol*np.sqrt(T)
    term1 = -norm.pdf(d1)*(2*r*T-d2*vol*np.sqrt(T))/(2*T*vol*np.sqrt(T))
    return term1

# =============================
# DESCARGAR DATOS
# =============================

ticker = yf.Ticker(UNDERLYING)

spot = ticker.history(period="1d")["Close"].iloc[-1]

print("Spot:",spot)

expirations = ticker.options

df_list = []

today = datetime.utcnow()

for exp in expirations[:5]:

    chain = ticker.option_chain(exp)

    calls = chain.calls
    puts = chain.puts

    calls["type"] = "call"
    puts["type"] = "put"

    data = pd.concat([calls,puts])

    expiration = datetime.strptime(exp,"%Y-%m-%d")

    T = (expiration-today).days/365

    data["T"] = T
    data["expiration"] = exp

    df_list.append(data)

df = pd.concat(df_list)

# =============================
# LIMPIEZA
# =============================

df = df[df["impliedVolatility"]>0]
df = df[df["openInterest"]>0]

# eliminar timezone
if "lastTradeDate" in df.columns:
    df["lastTradeDate"] = df["lastTradeDate"].dt.tz_localize(None)

# =============================
# CALCULOS PRINCIPALES
# =============================

gex_list = []
vanna_list = []
charm_list = []
inventory = []

for i,row in df.iterrows():

    S = spot
    K = row["strike"]
    vol = row["impliedVolatility"]
    T = row["T"]
    oi = row["openInterest"]

    g = gamma(S,K,T,RISK_FREE_RATE,vol)
    v = vanna(S,K,T,RISK_FREE_RATE,vol)
    c = charm(S,K,T,RISK_FREE_RATE,vol)

    gex = g*oi*100*S**2
    vanna_ex = v*oi*100
    charm_ex = c*oi*100

    if row["type"]=="put":
        gex=-gex
        vanna_ex=-vanna_ex
        charm_ex=-charm_ex

    gex_list.append(gex)
    vanna_list.append(vanna_ex)
    charm_list.append(charm_ex)

    inventory.append(oi*100)

df["GEX"] = gex_list
df["Vanna"] = vanna_list
df["Charm"] = charm_list
df["DealerInventory"] = inventory

# =============================
# AGREGACION POR STRIKE
# =============================

gex_strike = df.groupby("strike")["GEX"].sum().reset_index()
vanna_strike = df.groupby("strike")["Vanna"].sum().reset_index()
charm_strike = df.groupby("strike")["Charm"].sum().reset_index()

# =============================
# ZERO GAMMA
# =============================

gex_strike["cum"] = gex_strike["GEX"].cumsum()

zero_gamma = gex_strike.iloc[(gex_strike["cum"].abs()).argsort()[:1]]

print("\nZero Gamma Level:")
print(zero_gamma)

# =============================
# CALL WALL / PUT WALL
# =============================

calls = df[df["type"]=="call"]
puts = df[df["type"]=="put"]

call_wall = calls.loc[calls["openInterest"].idxmax()]
put_wall = puts.loc[puts["openInterest"].idxmax()]

print("\nCall Wall:",call_wall["strike"])
print("Put Wall:",put_wall["strike"])

# =============================
# 0DTE PRESSURE
# =============================

near_exp = df[df["T"]<1/365]

pressure = near_exp["GEX"].sum()

print("\n0DTE Dealer Pressure:",pressure)

# =============================
# DEALER HEDGING FLOW
# =============================

price_range = np.linspace(spot*0.8,spot*1.2,60)

flows=[]

for price in price_range:

    total=0

    for i,row in df.iterrows():

        K=row["strike"]
        vol=row["impliedVolatility"]
        T=row["T"]
        oi=row["openInterest"]

        g=gamma(price,K,T,RISK_FREE_RATE,vol)

        gex=g*oi*100*price**2

        if row["type"]=="put":
            gex=-gex

        total+=gex

    flows.append(total)

# =============================
# GRAFICOS
# =============================

plt.figure(figsize=(12,6))

plt.bar(gex_strike["strike"],gex_strike["GEX"]/1e9)

plt.axvline(spot,color="black",label="Spot")

plt.title("Gamma Exposure Profile")

plt.xlabel("Strike")
plt.ylabel("GEX (Billions)")

plt.legend()

plt.show()

plt.figure(figsize=(12,6))

plt.plot(price_range,flows)

plt.axvline(spot,color="black")

plt.title("Dealer Hedging Flow Model")

plt.xlabel("Price")

plt.ylabel("Dealer Hedging Pressure")

plt.show()

# =============================
# EXPORTAR
# =============================

df.to_excel(f"OPTIONS_FLOW_{UNDERLYING}.xlsx",index=False)