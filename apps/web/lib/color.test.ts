import { describe, expect, it } from 'vitest'
import { hexToOklch, contrastForeground } from './color'

/** Helper to parse oklch string into numeric components */
function parseOklch(oklch: string): { L: number; C: number; H: number } {
  const match = oklch.match(/oklch\((\S+) (\S+) (\S+)\)/)
  if (!match) throw new Error(`Invalid oklch string: ${oklch}`)
  return {
    L: parseFloat(match[1]),
    C: parseFloat(match[2]),
    H: parseFloat(match[3]),
  }
}

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

    const { L, C, H } = parseOklch(result)

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
    const { L, C, H } = parseOklch(result)
    // Red should have significant chroma and hue in the red range (~20-30)
    expect(C).toBeGreaterThan(0.1)
    expect(L).toBeGreaterThan(0.4)
    expect(L).toBeLessThan(0.75)
    expect(H).toBeGreaterThan(15)
    expect(H).toBeLessThan(35)
  })

  it('handles pure green (#00ff00)', () => {
    const result = hexToOklch('#00ff00')
    const { L, C, H } = parseOklch(result)
    // Green is perceived as very bright in OKLab
    expect(L).toBeGreaterThan(0.8)
    expect(C).toBeGreaterThan(0.1)
    // Green hue should be in the ~140-160 range
    expect(H).toBeGreaterThan(130)
    expect(H).toBeLessThan(170)
  })

  it('handles pure blue (#0000ff)', () => {
    const result = hexToOklch('#0000ff')
    const { L, C, H } = parseOklch(result)
    // Pure blue is perceived as quite dark
    expect(L).toBeLessThan(0.5)
    expect(C).toBeGreaterThan(0.1)
    // Blue hue should be in the ~260-270 range
    expect(H).toBeGreaterThan(255)
    expect(H).toBeLessThan(275)
  })

  it('handles uppercase hex input (#FF0000)', () => {
    const lower = hexToOklch('#ff0000')
    const upper = hexToOklch('#FF0000')
    expect(upper).toBe(lower)
  })

  it('produces consistent output format for all inputs', () => {
    const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', '#3b82f6']
    for (const hex of colors) {
      const result = hexToOklch(hex)
      // All should match the oklch(L C H) format
      expect(result).toMatch(/^oklch\(\S+ \S+ \S+\)$/)
    }
  })

  it('differentiates between similar but distinct colors', () => {
    const darkRed = hexToOklch('#8b0000')
    const brightRed = hexToOklch('#ff0000')
    const { L: darkL } = parseOklch(darkRed)
    const { L: brightL } = parseOklch(brightRed)
    // Bright red should have higher lightness than dark red
    expect(brightL).toBeGreaterThan(darkL)
  })

  it('returns higher lightness for lighter shades of the same hue', () => {
    const darkBlue = hexToOklch('#1e3a8a')
    const lightBlue = hexToOklch('#93c5fd')
    const { L: darkL } = parseOklch(darkBlue)
    const { L: lightL } = parseOklch(lightBlue)
    expect(lightL).toBeGreaterThan(darkL)
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

  it('returns only one of two possible values (dark or white foreground)', () => {
    const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', '#fde68a', '#1e3a5f']
    const validOutputs = ['oklch(0.15 0.02 270)', 'oklch(0.985 0 0)']
    for (const hex of colors) {
      const result = contrastForeground(hex)
      expect(validOutputs).toContain(result)
    }
  })

  it('returns dark foreground for a very light gray (#f0f0f0)', () => {
    const result = contrastForeground('#f0f0f0')
    expect(result).toBe('oklch(0.15 0.02 270)')
  })

  it('returns white foreground for a very dark gray (#1a1a1a)', () => {
    const result = contrastForeground('#1a1a1a')
    expect(result).toBe('oklch(0.985 0 0)')
  })

  it('handles uppercase hex consistently', () => {
    expect(contrastForeground('#FFFFFF')).toBe(contrastForeground('#ffffff'))
    expect(contrastForeground('#000000')).toBe(contrastForeground('#000000'))
  })
})
