/**
 * Hex → OKLCh conversion and contrast utilities for brand color theming.
 * No external dependencies — pure math from the OKLab spec.
 */

/** Parse "#rrggbb" to [r, g, b] in 0–1 range */
function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** sRGB component → linear RGB */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear RGB → OKLab (Björn Ottosson's method) */
function linearRgbToOklab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** Convert "#rrggbb" → "oklch(L C H)" CSS string */
export function hexToOklch(hex: string): string {
  const [sr, sg, sb] = hexToSrgb(hex);
  const [lr, lg, lb] = [linearize(sr), linearize(sg), linearize(sb)];
  const [L, a, b] = linearRgbToOklab(lr, lg, lb);

  const C = Math.sqrt(a * a + b * b);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  const hue = H < 0 ? H + 360 : H;

  // Round to 3 decimal places for readability
  const lStr = L.toFixed(3);
  const cStr = C.toFixed(3);
  const hStr = C < 0.002 ? "0" : hue.toFixed(1); // achromatic → hue irrelevant

  return `oklch(${lStr} ${cStr} ${hStr})`;
}

/**
 * Return an oklch foreground color (white or near-black) that contrasts
 * well against the given hex background.
 * Uses relative luminance (sRGB) with a 0.5 threshold on the OKLab L channel.
 */
export function contrastForeground(hex: string): string {
  const [sr, sg, sb] = hexToSrgb(hex);
  const [lr, lg, lb] = [linearize(sr), linearize(sg), linearize(sb)];
  const [L] = linearRgbToOklab(lr, lg, lb);

  // L > 0.6 means the color is perceived as light → use dark foreground
  return L > 0.6
    ? "oklch(0.15 0.02 270)" // near-black (matches --foreground default)
    : "oklch(0.985 0 0)"; // white (matches --primary-foreground default)
}
