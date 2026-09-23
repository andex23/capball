import { describe, it, expect } from 'vitest'
import { CAMERA_PRESETS, fitScale, posePreset } from '../scene/camera'

describe('camera fitting', () => {
  it('leaves a normal landscape screen alone', () => {
    expect(fitScale(16 / 9)).toBe(1)
    expect(posePreset(CAMERA_PRESETS[0], 16 / 9).position).toEqual([0, 30, 5])
  })

  it('turns the pitch upright on a phone and backs off enough to fit it', () => {
    const phone = 390 / 844
    const { position } = posePreset(CAMERA_PRESETS[0], phone)
    // Tilted along x instead of z → the long side of the pitch runs up the screen
    expect(Math.abs(position[0])).toBeGreaterThan(Math.abs(position[2]))
    expect(fitScale(phone)).toBeGreaterThan(1.3)
  })

  it('never pulls the camera closer than the preset', () => {
    for (const a of [0.3, 0.5, 0.8, 1, 1.4, 2.5]) expect(fitScale(a)).toBeGreaterThanOrEqual(1)
  })
})
