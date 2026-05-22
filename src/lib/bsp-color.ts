export function bspColor(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 100)
  const hue = clamped * 1.2 // 0 → red (0°), 100 → green (120°)
  const lightness = clamped < 50 ? 55 : 48 // slightly darker at green end
  return `hsl(${hue.toFixed(0)}, 80%, ${lightness}%)`
}
