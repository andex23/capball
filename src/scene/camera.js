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

/**
 * Screen space the HUD keeps to itself, in CSS pixels, when the pitch stands
 * upright (phones and tablets held tall). The scoreboard and turn pill sit
 * above the far goal and the pause/camera buttons below the near one, so the
 * pitch is fitted between them instead of underneath them. Landscape screens
 * have room beside the pitch and are left alone.
 */
export function hudInsets(width, height) {
  if (!(width > 0 && height > 0) || width / height >= PORTRAIT_BELOW) return { top: 0, bottom: 0 }
  // Scoreboard + turn prompt (which wraps onto two lines on a narrow phone), then
  // the pause/camera buttons — less the goal's depth, which sits between them
  return { top: width <= 560 ? 112 : 104, bottom: 34 }
}

// Notch / home-indicator space, read from CSS because JS has no direct API for it
let _safeProbe = null
function safeAreaInsets() {
  if (typeof document === 'undefined' || !document.body) return { top: 0, bottom: 0 }
  if (!_safeProbe) {
    _safeProbe = document.createElement('div')
    _safeProbe.setAttribute('aria-hidden', 'true')
    _safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
    document.body.appendChild(_safeProbe)
  }
  const cs = getComputedStyle(_safeProbe)
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
}

/**
 * How much further back than the preset the camera must sit to fit the pitch.
 * `freeHeight` is the share of the screen height the pitch may use (1 = all).
 */
export function fitScale(aspect, freeHeight = 1) {
  const portrait = aspect < PORTRAIT_BELOW
  const across = portrait ? FOOTPRINT.short : FOOTPRINT.long // screen width
  const tall = portrait ? FOOTPRINT.long : FOOTPRINT.short // screen height
  const perUnit = 2 * Math.tan((FOV * Math.PI) / 360) // visible height per unit distance
  const free = Math.min(1, Math.max(0.4, freeHeight))
  const needed = Math.max(tall / (perUnit * free), across / (perUnit * aspect))
  return Math.max(1, needed / BASE_DISTANCE)
}

export function posePreset(preset, aspect, freeHeight = 1) {
  const portrait = aspect < PORTRAIT_BELOW
  const pos = portrait ? preset.portraitPos : preset.pos
  const target = preset.target
  const k = fitScale(aspect, freeHeight)
  return {
    position: pos.map((p, i) => target[i] + (p - target[i]) * k),
    target,
  }
}

/** Top/bottom pixels to keep clear of the pitch on the current canvas. */
function currentInsets() {
  const w = _canvasRef?.clientWidth || 0
  const h = _canvasRef?.clientHeight || 0
  const hud = hudInsets(w, h)
  if (!hud.top && !hud.bottom) return { w, h, top: 0, bottom: 0 }
  const safe = safeAreaInsets()
  return { w, h, top: hud.top + safe.top, bottom: hud.bottom + safe.bottom }
}

function applyPreset(preset) {
  if (!preset || !_controlsRef || !_cameraRef) return
  const { w, h, top, bottom } = currentInsets()
  const freeHeight = h > 0 ? (h - top - bottom) / h : 1
  const { position, target } = posePreset(preset, _cameraRef.aspect || 1, freeHeight)
  // Slide the picture so the pitch is centred in the space the HUD leaves free.
  // A view offset moves the image without touching the camera pose, so aiming,
  // the tutorial pointers and replays all keep working off the same matrices.
  if (top || bottom) _cameraRef.setViewOffset?.(w, h, 0, -(top - bottom) / 2, w, h)
  else if (_cameraRef.view) _cameraRef.clearViewOffset?.()
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
