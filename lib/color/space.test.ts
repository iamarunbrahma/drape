import { describe, it, expect } from 'vitest'
import { hexToRgb, rgbToHex, rgbToLab, hexToLab, labHue, ita } from './space'

describe('hexToRgb / rgbToHex', () => {
  it('parses full hex', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#bd9a80')).toEqual({ r: 189, g: 154, b: 128 })
  })
  it('parses short hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
  it('rejects bad hex', () => {
    expect(() => hexToRgb('#xyz123')).toThrow()
    expect(() => hexToRgb('12')).toThrow()
  })
  it('round-trips', () => {
    expect(rgbToHex({ r: 189, g: 154, b: 128 })).toBe('#bd9a80')
  })
})

describe('rgbToLab', () => {
  it('white -> L~100, a~0, b~0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 })
    expect(lab.L).toBeGreaterThan(99)
    expect(Math.abs(lab.a)).toBeLessThan(1)
    expect(Math.abs(lab.b)).toBeLessThan(1)
  })
  it('black -> L~0', () => {
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeLessThan(1)
  })
  it('a warm golden skin has positive b* (yellow)', () => {
    const lab = hexToLab('#e0b080')
    expect(lab.b).toBeGreaterThan(20)
  })
})

describe('labHue / labChroma', () => {
  it('real warm skin hue in ~45-75 deg', () => {
    const h = labHue(hexToLab('#bd9a80'))
    expect(h).toBeGreaterThan(45)
    expect(h).toBeLessThan(80)
  })
  it('a pink/cool skin has lower hue than a golden skin', () => {
    const warm = labHue(hexToLab('#c99a6e')) // golden
    const cool = labHue(hexToLab('#c99a95')) // pinkish
    expect(cool).toBeLessThan(warm)
  })
})

describe('ita', () => {
  it('lighter skin has higher ITA than deeper skin', () => {
    const light = ita(hexToLab('#f0d5b8'))
    const deep = ita(hexToLab('#6e4b34'))
    expect(light).toBeGreaterThan(deep)
  })
})
