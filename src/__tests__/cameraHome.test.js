import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { setCameraRefs, resetCameraPreset, fitCurrentPreset, homePose, returnHome, setFacing, setCameraPose, getCameraPose } from '../scene/camera'

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6)

describe('the camera goes back to the normal view', () => {
  beforeEach(() => {
    const camera = new THREE.PerspectiveCamera(45, 390 / 844, 0.1, 500)
    const controls = { target: new THREE.Vector3(), update() {} }
    setCameraRefs({ camera, controls, canvas: null })
    resetCameraPreset()
    fitCurrentPreset()
  })

  it('after a play, even when the view was dragged and zoomed by hand', () => {
    const home = homePose()
    setCameraPose({ position: [3, 20, 9], target: [2, 0, 1] })
    returnHome()
    expect(near(getCameraPose().position, home.position)).toBe(true)
    expect(near(getCameraPose().target, home.target)).toBe(true)
  })

  it('turning round for the other player lands on the normal view from that end', () => {
    setFacing(-1, { animate: false })
    const before = homePose()
    setCameraPose({ position: [3, 20, 9], target: [2, 0, 1] })
    setFacing(1, { animate: false })
    const after = getCameraPose()
    expect(near(after.position, homePose().position)).toBe(true)
    // ...which is the other end: the same view turned half way round
    expect(near(after.position, [-before.position[0], before.position[1], -before.position[2]])).toBe(true)
  })
})
