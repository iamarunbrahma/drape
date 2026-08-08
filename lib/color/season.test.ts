import { describe, it, expect } from 'vitest'
import { classifyUndertone, classifySeason } from './season'

describe('undertone (real + synthetic)', () => {
  it('real warm skin colors classify warm', () => {
    for (const hex of ['#6e4b34', '#ba9277', '#ac876c', '#b89277', '#be9c82', '#bd9a80']) {
      expect(classifyUndertone(hex)).toBe('warm')
    }
  })
  it('pink/cool skin classifies cool', () => {
    expect(classifyUndertone('#e8c4c0')).toBe('cool')
  })
})

describe('season parents from real data', () => {
  const cases: Array<[string, string, string]> = [
    // [skin, eye, expectedParent]
    ['#6e4b34', '#1e110d', 'Autumn'], // m1 deep warm -> Deep Autumn
    ['#ba9277', '#1f0d03', 'Autumn'], // c3 red-hair medium warm -> Autumn
    ['#ac876c', '#42240e', 'Autumn'], // c6 medium warm
    ['#be9c82', '#4f4030', 'Spring'], // c1 light warm -> Spring
  ]
  for (const [skin, eye, parent] of cases) {
    it(`${skin} -> ${parent}`, () => {
      expect(classifySeason({ skinToneHex: skin, eyeHex: eye }).parent).toBe(parent)
    })
  }
})

describe('depth ordering', () => {
  it('deep skin -> deep, light skin -> light', () => {
    expect(classifySeason({ skinToneHex: '#6e4b34' }).depth).toBe('deep')
    expect(classifySeason({ skinToneHex: '#be9c82' }).depth).toBe('light')
  })
})

describe('specific seasons', () => {
  it('m1 -> Deep Autumn', () => {
    expect(classifySeason({ skinToneHex: '#6e4b34', eyeHex: '#1e110d' }).season).toBe('Deep Autumn')
  })
  it('cool light pink -> Summer family', () => {
    expect(classifySeason({ skinToneHex: '#e8c4c0' }).parent).toBe('Summer')
  })
  it('cool deep -> Winter family', () => {
    // deep skin with cool (low-b*) undertone
    expect(classifySeason({ skinToneHex: '#5a4a48' }).parent).toBe('Winter')
  })
})
