// src/utils/color.ts
// Adds an alpha channel to a "#rrggbb" hex color, returning rgba(...).
// Used for the ambient background glow (radial-falloff approximation) since
// RN has no cross-platform CSS blur filter to soften a flat shape directly.
export function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
