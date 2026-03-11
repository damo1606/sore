export interface Levels {
  call_wall: number;
  put_wall: number;
  gamma_flip: number;
  support: number;
  resistance: number;
}

export interface GexPoint {
  strike: number;
  gex: number;
}

export interface VannaPoint {
  strike: number;
  vanna: number;
}

export interface DealerFlow {
  prices: number[];
  flows: number[];
}

export interface AnalysisData {
  ticker: string;
  spot: number;
  expiration: string;
  available_expirations: string[];
  levels: Levels;
  gex_profile: GexPoint[];
  vanna_profile: VannaPoint[];
  dealer_flow: DealerFlow;
}
