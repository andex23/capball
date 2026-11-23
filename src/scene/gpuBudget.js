/**
 * How much graphics memory the pitch may use. Inside Lagos Life the game
 * shares the phone's graphics with the host app's own 3D city, and when the
 * phone runs short it takes the graphics away (the pitch "drops"). So there:
 * a smaller shadow map, half-size cap prints and a lower drawing resolution;
 * and on phones that say they have 4 GB or less, no real shadows at all.
 */
import { isLagos } from '../platform'

const lagos = isLagos()
const memory = typeof navigator !== 'undefined' && Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null

/** A phone that says it's short of memory (iPhones don't say: they keep shadows). */
export const LOW_MEMORY = memory !== null && memory <= 4
/** Draw real shadows? */
export const SHADOWS = !LOW_MEMORY
/** Shadow map size (pixels a side): 2048² is ~16 MB of graphics memory, 1024² a quarter of that. */
export const SHADOW_MAP = lagos ? 1024 : 2048
/** Cap prints are drawn at this share of their full size (caps are small on screen). */
export const CAP_TEXTURE_SCALE = lagos ? 0.5 : 1
/** Drawing resolution (device pixels per CSS pixel), lowest and highest. */
export const DPR = lagos ? [1, 1.25] : [1, 2]
