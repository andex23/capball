// Camera presets, kept out of Scene.jsx so the HUD doesn't pull in three.js.

// Each preset has a landscape pose and, for tall phone screens, a pose that
// turns the pitch so its long side runs up the screen.
export const CAMERA_PRESETS = [
  { key: 'overhead', label: 'Overhead', pos: [0, 30, 5], portraitPos: [5, 30, 0], target: [0, 0, 0] },
  { key: 'low', label: 'Low angle', pos: [0, 14, 14], portraitPos: [14, 14, 0], target: [0, 0, 0] },
  { key: 'behindGoal', label: 'Behind goal', pos: [-16, 12, 0], portraitPos: [-16, 12, 0], target: [2, 0, 0] },
]

const PORTRAIT_BELOW = 0.9
const FOV = 55
// Area the camera must keep in view (pitch + goals + frame), in world units
const FOOTPRINT = { long: 34, short: 24 }
const BASE_DISTANCE = Math.hypot(30, 5)

// Refs registered by the 3D scene so the HUD can move the camera
let _controlsRef = null
let _cameraRef = null
let _canvasRef = null
let _presetIndex = 0

export function setCameraRefs({ camera, controls, canvas }) {
  if (camera !== undefined) _cameraRef = camera
  if (controls !== undefined) _controlsRef = controls
  if (canvas !== undefined) _canvasRef = canvas
}

/**
 * Where a world point is on screen, in client pixels, or null when there is no
 * camera yet or the point is behind it. Plain matrix maths on the camera's
 * own matrices, so the DOM UI can use it without importing three.js.
 */
export function projectToScreen(x, y, z, camera = _cameraRef, rect = _canvasRef?.getBoundingClientRect()) {
  if (!camera?.projectionMatrix || !camera.matrixWorldInverse || !rect) return null
  camera.updateMatrixWorld?.()
  const v = camera.matrixWorldInverse.elements
  const p = camera.projectionMatrix.elements
  // view space
  const vx = v[0] * x + v[4] * y + v[8] * z + v[12]
  const vy = v[1] * x + v[5] * y + v[9] * z + v[13]
  const vz = v[2] * x + v[6] * y + v[10] * z + v[14]
  const vw = v[3] * x + v[7] * y + v[11] * z + v[15]
  // clip space
  const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12] * vw
  const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13] * vw
  const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15] * vw
  if (!(cw > 0)) return null
  const nx = cx / cw
  const ny = cy / cw
  return {
    x: rect.left + ((nx + 1) / 2) * rect.width,
    y: rect.top + ((1 - ny) / 2) * rect.height,
    onScreen: Math.abs(nx) <= 1 && Math.abs(ny) <= 1,
  }
}

export function resetCameraPreset() {
  _presetIndex = 0
}

export function fitCurrentPreset() {
  applyPreset(CAMERA_PRESETS[_presetIndex])
}

/** How much further back than the preset the camera must sit to fit the pitch. */
export function fitScale(aspect) {
  const portrait = aspect < PORTRAIT_BELOW
  const across = portrait ? FOOTPRINT.short : FOOTPRINT.long // screen width
  const tall = portrait ? FOOTPRINT.long : FOOTPRINT.short // screen height
  const perUnit = 2 * Math.tan((FOV * Math.PI) / 360) // visible height per unit distance
  const needed = Math.max(tall / perUnit, across / (perUnit * aspect))
  return Math.max(1, needed / BASE_DISTANCE)
}

export function posePreset(preset, aspect) {
  const portrait = aspect < PORTRAIT_BELOW
  const pos = portrait ? preset.portraitPos : preset.pos
  const target = preset.target
  const k = fitScale(aspect)
  return {
    position: pos.map((p, i) => target[i] + (p - target[i]) * k),
    target,
  }
}

function applyPreset(preset) {
  if (!preset || !_controlsRef || !_cameraRef) return
  const { position, target } = posePreset(preset, _cameraRef.aspect || 1)
  _cameraRef.position.set(...position)
  _controlsRef.target.set(...target)
  _controlsRef.update()
}

/** Move to the next camera preset; returns its label. */
export function cycleCameraPreset() {
  _presetIndex = (_presetIndex + 1) % CAMERA_PRESETS.length
  const preset = CAMERA_PRESETS[_presetIndex]
  applyPreset(preset)
  return preset.label
}

/** Where the camera is right now (so a replay can move it and put it back). */
export function getCameraPose() {
  if (!_controlsRef || !_cameraRef) return null
  return { position: _cameraRef.position.toArray(), target: _controlsRef.target.toArray() }
}

export function setCameraPose({ position, target }) {
  if (!_controlsRef || !_cameraRef) return
  _cameraRef.position.set(...position)
  _controlsRef.target.set(...target)
  _controlsRef.update()
}
