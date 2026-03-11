import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import norm
from datetime import datetime
import matplotlib.pyplot as plt

# ======================================================
# CONFIGURACIÓN
# ======================================================

UNDERLYING = "dia"
TARGET_EXPIRATION = "2026-04-17"   # ajusta si deseas
RISK_FREE_RATE = 0.041              # 5% aproximado
CONTRACT_SIZE = 100

# ======================================================
# FUNCIONES BLACK-SCHOLES
# ======================================================

def calculate_gamma(S, K, T, r, sigma):
    if sigma == 0 or T == 0:
        return 0
    
    d1 = (np.log(S/K) + (r + 0.41 * sigma**2) * T) / (sigma * np.sqrt(T))
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    return gamma

# ======================================================
# 1️⃣ OBTENER DATOS
# ======================================================

ticker = yf.Ticker(UNDERLYING)
spot = ticker.history(period="1d")["Close"].iloc[-1]

print("Spot:", spot)

# verificar vencimiento
if TARGET_EXPIRATION not in ticker.options:
    raise Exception("Vencimiento no disponible")

chain = ticker.option_chain(TARGET_EXPIRATION)

calls = chain.calls
puts = chain.puts

# ======================================================
# 2️⃣ CALCULAR TIEMPO A VENCIMIENTO
# ======================================================

today = datetime.now()
expiration_date = datetime.strptime(TARGET_EXPIRATION, "%Y-%m-%d")
T = (expiration_date - today).days / 365

# ======================================================
# 3️⃣ CALCULAR GEX
# ======================================================

gex_data = []

for idx, row in calls.iterrows():
    
    K = row["strike"]
    iv = row["impliedVolatility"]
    oi = row["openInterest"]
    
    gamma = calculate_gamma(spot, K, T, RISK_FREE_RATE, iv)
    gex_call = oi * gamma * spot**2 * CONTRACT_SIZE
    
    gex_data.append({
        "strike": K,
        "GEX_call": gex_call
    })

for idx, row in puts.iterrows():
    
    K = row["strike"]
    iv = row["impliedVolatility"]
    oi = row["openInterest"]
    
    gamma = calculate_gamma(spot, K, T, RISK_FREE_RATE, iv)
    gex_put = - oi * gamma * spot**2 * CONTRACT_SIZE
    
    gex_data.append({
        "strike": K,
        "GEX_put": gex_put
    })

df = pd.DataFrame(gex_data)

# agrupar por strike
df = df.groupby("strike").sum().reset_index()

df["Total_GEX"] = df.sum(axis=1)

# ======================================================
# 4️⃣ IDENTIFICAR BANDAS
# ======================================================

# soporte = máximo GEX positivo
support = df.loc[df["Total_GEX"].idxmax()]

# resistencia = mínimo GEX negativo
resistance = df.loc[df["Total_GEX"].idxmin()]

print("\nSoporte institucional (Gamma Wall positiva):")
print(support)

print("\nResistencia institucional (Gamma Wall negativa):")
print(resistance)

# ======================================================
# 5️⃣ EXPORTAR
# ======================================================

df.to_excel(f"GEX_{UNDERLYING}_{TARGET_EXPIRATION}.xlsx", index=False)

# ======================================================
# 6️⃣ GRÁFICO
# ======================================================

plt.figure(figsize=(12,6))
plt.bar(df["strike"], df["Total_GEX"])
plt.axhline(0)
plt.title(f"Gamma Exposure - {UNDERLYING}")
plt.xlabel("Strike")
plt.ylabel("Total GEX")
plt.show()