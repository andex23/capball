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
let _presetIndex = 0

export function setCameraRefs({ camera, controls }) {
  if (camera !== undefined) _cameraRef = camera
  if (controls !== undefined) _controlsRef = controls
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
