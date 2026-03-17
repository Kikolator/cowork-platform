import { describe, expect, it } from 'vitest'
import { hexToOklch, contrastForeground } from './color'

describe('hexToOklch', () => {
  it('converts black (#000000) to oklch with zero lightness and chroma', () => {
    const result = hexToOklch('#000000')
    expect(result).toBe('oklch(0.000 0.000 0)')
  })

  it('converts white (#ffffff) to oklch with full lightness and near-zero chroma', () => {
    const result = hexToOklch('#ffffff')
    // White should have L ~1.0, achromatic (C < 0.002) so hue is "0"
    expect(result).toMatch(/^oklch\(1\.000 0\.00\d 0\)$/)
  })

  it('converts a mid-tone blue (#3b82f6) to a valid oklch string', () => {
    const result = hexToOklch('#3b82f6')
    // Should match oklch(L C H) format with 3 decimal places for L/C and 1 for H
    expect(result).toMatch(/^oklch\(\d\.\d{3} \d\.\d{3} \d+\.\d\)$/)

    // Extract numeric values
    const match = result.match(/oklch\((\S+) (\S+) (\S+)\)/)
    expect(match).not.toBeNull()
    const [, l, c, h] = match!
    const L = parseFloat(l)
    const C = parseFloat(c)
    const H = parseFloat(h)

    // Blue should have mid-range lightness, noticeable chroma, and hue in the blue range (~250-270)
    expect(L).toBeGreaterThan(0.4)
    expect(L).toBeLessThan(0.8)
    expect(C).toBeGreaterThan(0.1)
    expect(H).toBeGreaterThan(240)
    expect(H).toBeLessThan(280)
  })

  it('sets hue to 0 for achromatic colors (gray)', () => {
    const result = hexToOklch('#808080')
    expect(result).toMatch(/^oklch\(\d\.\d{3} \d\.\d{3} 0\)$/)
  })

  it('handles pure red (#ff0000)', () => {
    const result = hexToOklch('#ff0000')
    const match = result.match(/oklch\((\S+) (\S+) (\S+)\)/)
    expect(match).not.toBeNull()
    const C = parseFloat(match![2])
    // Red should have significant chroma
    expect(C).toBeGreaterThan(0.1)
  })

  it('handles pure green (#00ff00)', () => {
    const result = hexToOklch('#00ff00')
    const match = result.match(/oklch\((\S+) (\S+) (\S+)\)/)
    expect(match).not.toBeNull()
    const L = parseFloat(match![1])
    // Green is perceived as very bright in OKLab
    expect(L).toBeGreaterThan(0.8)
  })
})

describe('contrastForeground', () => {
  it('returns dark foreground for light background (#ffffff)', () => {
    const result = contrastForeground('#ffffff')
    expect(result).toBe('oklch(0.15 0.02 270)')
  })

  it('returns white foreground for dark background (#000000)', () => {
    const result = contrastForeground('#000000')
    expect(result).toBe('oklch(0.985 0 0)')
  })

  it('returns dark foreground for a light yellow (#fde68a)', () => {
    const result = contrastForeground('#fde68a')
    expect(result).toBe('oklch(0.15 0.02 270)')
  })

  it('returns white foreground for a dark navy (#1e3a5f)', () => {
    const result = contrastForeground('#1e3a5f')
    expect(result).toBe('oklch(0.985 0 0)')
  })

  it('returns dark foreground for a mid-tone blue (#3b82f6) which is perceived as light', () => {
    // #3b82f6 has OKLab L slightly above 0.6, so it is treated as a light background
    const result = contrastForeground('#3b82f6')
    expect(result).toBe('oklch(0.15 0.02 270)')
  })

  it('returns white foreground for a darker blue (#1d4ed8)', () => {
    const result = contrastForeground('#1d4ed8')
    expect(result).toBe('oklch(0.985 0 0)')
  })
})
