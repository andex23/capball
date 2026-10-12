/**
 * Which host the game is running in. The normal site leaves this unset; the
 * Lagos Life entry (lagos.html) sets it before anything else loads, so the
 * menus can hide what the Lagos Life frame doesn't allow (install, sign-in,
 * sharing, LAN, voice, full screen).
 */
export const isLagos = () => globalThis.__COUNTERBALL_PLATFORM__ === 'lagos'
