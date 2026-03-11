function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function gammaBS(
  S: number, K: number, T: number, r: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0 || K <= 0 || S <= 0) return 0;
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));
  return normalPDF(d1) / (S * sigma * Math.sqrt(T));
}

export function vannaBS(
  S: number, K: number, T: number, r: number, sigma: number
): number {
  if (T <= 0 || sigma <= 0 || K <= 0 || S <= 0) return 0;
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return (-normalPDF(d1) * d2) / sigma;
}
