from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from analysis import run_analysis, get_expirations
from typing import Optional

app = FastAPI(title="SORE Options API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/expirations/{ticker}")
def expirations(ticker: str):
    try:
        return get_expirations(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/analysis/{ticker}")
def analysis(ticker: str, expiration: Optional[str] = None):
    try:
        return run_analysis(ticker.upper(), expiration)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
