import { describe, expect, it } from 'vitest'
import { ARCHIVE_DESIGNS } from '../data/ArchiveCaps.js'
import { heritageFace, isHeritagePattern } from '../data/HeritageCaps.js'
import { hasArt } from '../game/capArt.js'

describe('Archive caps (the Weekend League computer clubs)', () => {
  it('has fifteen distinct designs, drawn as cap art, with only a small number on them', () => {
    expect(ARCHIVE_DESIGNS).toHaveLength(15)
    const faces = ARCHIVE_DESIGNS.map((d) => {
      expect(d.cpu).toBe(true)
      expect(isHeritagePattern(d.pattern)).toBe(true)
      expect(hasArt(d.key)).toBe(true)
      const face = heritageFace({ pattern: d.pattern, number: 99 })
      expect(face.labels.some((l) => l.role === 'name')).toBe(false)
      expect(face.labels.find((l) => l.role === 'number').text).toBe('99')
      expect(face.shapes.every((p) => p.d.startsWith('M') && !/NaN|Infinity/.test(p.d))).toBe(true)
      return JSON.stringify(face.shapes)
    })
    expect(new Set(faces).size).toBe(15)
  })
})
