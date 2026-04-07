-- ============================================================
-- SORE — Schema inicial
-- Generado desde el código fuente (src/app/api/auth y analysis7)
-- ============================================================

-- ── Tabla: users ─────────────────────────────────────────────
-- Usada por el sistema de autenticación multi-usuario.
-- Passwords hasheadas con bcrypt (12 rounds).
create table if not exists public.users (
  id             bigserial primary key,
  username       text not null unique,
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

-- Solo el service role puede leer/escribir esta tabla
alter table public.users enable row level security;


-- ── Tabla: sr_snapshots ───────────────────────────────────────
-- Guarda un snapshot de todos los niveles S/R calculados por M7
-- en cada análisis. Sirve para calcular confirmación histórica
-- (cuántos de los últimos 7 días confirmaron un nivel, ±0.5%).
create table if not exists public.sr_snapshots (
  id                        bigserial primary key,
  created_at                timestamptz not null default now(),

  -- Contexto del análisis
  ticker                    text        not null,
  spot                      float8      not null,
  primary_exp_date          text        not null,

  -- M1 — GEX primario
  m1_support                float8,
  m1_resistance             float8,
  m1_call_wall              float8,
  m1_put_wall               float8,
  m1_gamma_flip             float8,
  m1_net_gex                float8,
  m1_put_call_ratio         float8,

  -- M2 — Volumen de OI
  m2_support                float8,
  m2_resistance             float8,

  -- M3 — Multi-expiración
  m3_support                float8,
  m3_resistance             float8,
  m3_support_confidence     float8,
  m3_resistance_confidence  float8,

  -- M5 — Composite score
  m5_support_strike         float8,
  m5_resistance_strike      float8,
  m5_support_confidence     float8,
  m5_resistance_confidence  float8,
  m5_score                  float8,
  m5_verdict                text,

  -- M7 — Veredicto final
  m7_final_score            float8,
  m7_final_verdict          text,
  m7_confidence             float8,
  m7_regime                 text,
  m7_regime_multiplier      float8,
  m7_sr_table               jsonb,
  m7_timing_matrix          jsonb
);

-- Índice para acelerar las queries históricas por ticker
create index if not exists sr_snapshots_ticker_created_at_idx
  on public.sr_snapshots (ticker, created_at desc);

-- Solo el service role puede escribir; lectura también restringida
alter table public.sr_snapshots enable row level security;
