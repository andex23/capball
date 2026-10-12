import { describe, it, expect } from 'vitest'
import { CAMERA_PRESETS, fitScale, posePreset, hudInsets, needsFlip } from '../scene/camera'
import { facingTeam } from '../scene/useTurnFacing'

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

  it('turns the view round so the right end is nearest the viewer', () => {
    const [overhead, , behindGoal] = CAMERA_PRESETS
    const wide = 16 / 9
    const tall = 390 / 844
    // Wide screens: the left goal is on the viewer's side as drawn
    expect(needsFlip(overhead, wide, -1)).toBe(false)
    expect(needsFlip(overhead, wide, 1)).toBe(true)
    // Tall screens: the right goal is at the bottom as drawn
    expect(needsFlip(overhead, tall, 1)).toBe(false)
    expect(needsFlip(overhead, tall, -1)).toBe(true)
    // Behind-goal sits behind the left goal either way
    expect(needsFlip(behindGoal, tall, -1)).toBe(false)
    expect(needsFlip(behindGoal, wide, 1)).toBe(true)
    // Nobody to face: leave it alone
    expect(needsFlip(overhead, tall, null)).toBe(false)
  })
})

describe('whose end the view faces', () => {
  it('pass-and-play follows the turn; vs CPU the human; online this device', () => {
    expect(facingTeam({ gameMode: 'local', turnView: true, activeTeam: 'team2' })).toBe('team2')
    expect(facingTeam({ gameMode: 'local', turnView: true, activeTeam: 'team1' })).toBe('team1')
    expect(facingTeam({ gameMode: 'local', turnView: false, activeTeam: 'team2' })).toBeNull()
    expect(facingTeam({ gameMode: 'ai', aiTeam: 'team2', activeTeam: 'team2' })).toBe('team1')
    expect(facingTeam({ gameMode: 'online', onlineMyTeam: 'team2', activeTeam: 'team1' })).toBe('team2')
    expect(facingTeam({ gameMode: 'online', onlineMyTeam: null })).toBeNull()
  })
})
