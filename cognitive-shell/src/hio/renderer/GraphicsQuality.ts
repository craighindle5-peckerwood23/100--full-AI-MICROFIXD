// Canvas-resolution limits protect mobile GPUs while keeping desktop detail sharp.
export type GraphicsTier = 'cinematic' | 'balanced' | 'efficient';
export interface GraphicsQuality {
  tier: GraphicsTier;
  pixelRatio: number;
  particleCount: number;
  bloomScale: number;
  halo: boolean;
}
export function chooseGraphicsQuality(width: number, height: number, deviceDpr: number): GraphicsQuality {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const dpr = Number.isFinite(deviceDpr) ? Math.max(1, deviceDpr) : 1;
  if (w < 600 || w * h < 300_000) {
    return {tier: 'efficient', pixelRatio: Math.min(dpr, 1.25), particleCount: 650, bloomScale: 0.65, halo: true};
  }
  if (w < 1000 || w * h < 850_000) {
    return {tier: 'balanced', pixelRatio: Math.min(dpr, 1.5), particleCount: 1400, bloomScale: 0.85, halo: true};
  }
  return {tier: 'cinematic', pixelRatio: Math.min(dpr, 1.8), particleCount: 2600, bloomScale: 1, halo: true};
}
