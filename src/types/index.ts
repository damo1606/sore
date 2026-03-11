export interface Levels {
  callWall: number;
  putWall: number;
  gammaFlip: number;
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

export interface AnalysisResult {
  ticker: string;
  spot: number;
  expiration: string;
  availableExpirations: string[];
  levels: Levels;
  gexProfile: GexPoint[];
  vannaProfile: VannaPoint[];
  dealerFlow: {
    prices: number[];
    flows: number[];
  };
  putCallRatio: number;
  institutionalPressure: number;
  netGex: number;
}
