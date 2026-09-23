// Hex colour helpers for team-colour gradients.

function channels(hex) {
  const num = parseInt(String(hex).replace('#', ''), 16) || 0
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

const toHex = (r, g, b) => `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`

export function darkenHex(hex, amount) {
  const [r, g, b] = channels(hex)
  return toHex(...[r, g, b].map((c) => Math.max(0, Math.round(c * (1 - amount)))))
}

export function lightenHex(hex, amount) {
  const [r, g, b] = channels(hex)
  return toHex(...[r, g, b].map((c) => Math.min(255, Math.round(c + (255 - c) * amount))))
}

/** Relative luminance 0..1 — used to pick readable text over a team colour. */
export function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Team colour that stays visible on the dark UI (very dark kits get lifted). */
export function displayColor(hex) {
  return luminance(hex) < 0.03 ? lightenHex(hex, 0.35) : hex
}
