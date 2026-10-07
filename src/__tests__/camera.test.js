import { describe, it, expect } from 'vitest'
import { CAMERA_PRESETS, fitScale, posePreset, hudInsets } from '../scene/camera'

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

  it('keeps the upright pitch clear of the HUD on phones', () => {
    // Tall screens reserve room for the scoreboard above and the buttons below
    const phone = hudInsets(390, 844)
    expect(phone.top).toBeGreaterThan(90)
    expect(phone.bottom).toBeGreaterThan(0)
    expect(hudInsets(820, 1180).top).toBeGreaterThan(90)
    // Landscape screens have room beside the pitch: nothing reserved
    expect(hudInsets(844, 390)).toEqual({ top: 0, bottom: 0 })
    expect(hudInsets(1440, 900)).toEqual({ top: 0, bottom: 0 })
    expect(hudInsets(0, 0)).toEqual({ top: 0, bottom: 0 })
  })

  it('backs the camera off further when less of the screen height is free', () => {
    const small = 320 / 568 // short phone: the pitch is limited by height once the HUD is reserved
    const { top, bottom } = hudInsets(320, 568)
    const free = (568 - top - bottom) / 568
    expect(fitScale(small, free)).toBeGreaterThan(fitScale(small))
    expect(posePreset(CAMERA_PRESETS[0], small, free).position[1]).toBeGreaterThan(posePreset(CAMERA_PRESETS[0], small).position[1])
    // A tall phone is limited by width, so reserving the HUD costs nothing
    const tall = 390 / 844
    const i = hudInsets(390, 844)
    expect(fitScale(tall, (844 - i.top - i.bottom) / 844)).toBe(fitScale(tall))
    // Nonsense input never produces a wild pose
    expect(Number.isFinite(fitScale(tall, 0))).toBe(true)
    expect(fitScale(16 / 9, 1)).toBe(1)
  })
})
