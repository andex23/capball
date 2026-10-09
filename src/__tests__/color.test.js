import { describe, it, expect } from 'vitest'
import { inkOn, displayColor } from '../ui/color'

describe('team colour text', () => {
  it('uses dark ink on light kits and white on dark ones', () => {
    for (const light of ['#FFFFFF', '#FFEB3B', '#E3E8F2', '#B0BEC5']) expect(inkOn(light)).not.toBe('#ffffff')
    for (const dark of ['#111111', '#C8102E', '#1E88E5', '#43A047', '#4A148C']) expect(inkOn(dark)).toBe('#ffffff')
  })
  it('keeps a white kit white in the UI', () => {
    expect(displayColor('#FFFFFF')).toBe('#FFFFFF')
  })
})
