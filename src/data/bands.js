/**
 * Rubber bands: like the elastic band you'd stretch round a bottle cap as a
 * kid. Each of your six players can wear one, so every cap is "my player".
 * Looks only: a band never changes how a cap plays.
 *
 * Every band is earned (none are free); inside Lagos Life every locked one can also be
 * bought (the price here is only for showing; Lagos Life holds the real one).
 */
export const BANDS = [
  { key: 'red', name: 'Red', color: '#D32F2F', hint: 'Win a match', need: (p) => [p.won, 1] },
  { key: 'black', name: 'Black', color: '#1A1A1A', hint: 'Score 5 goals', need: (p) => [p.goalsFor, 5] },
  { key: 'yellow', name: 'Yellow', color: '#FFD600', hint: 'Keep a clean sheet', need: (p) => [p.cleanSheets, 1] },
  { key: 'blue', name: 'Blue', color: '#1E63D6', hint: 'Win 3 matches', need: (p) => [p.won, 3], price: 100 },
  { key: 'green', name: 'Green', color: '#1FA34A', hint: 'Score 20 goals', need: (p) => [p.goalsFor, 20], price: 100 },
  { key: 'white', name: 'White', color: '#F4F4F4', hint: 'Keep 3 clean sheets', need: (p) => [p.cleanSheets, 3], price: 100 },
  { key: 'orange', name: 'Orange', color: '#FF7A00', hint: 'Win a tournament', need: (p) => [p.cups, 1], price: 200 },
  { key: 'pink', name: 'Hot Pink', color: '#FF2E88', shopOnly: true, price: 100 },
  { key: 'glow', name: 'Glow Green', color: '#B6FF00', shopOnly: true, price: 100 },
  { key: 'purple', name: 'Purple', color: '#7B1FA2', shopOnly: true, price: 100 },
  { key: 'gold', name: 'Gold', color: '#D4AF37', shopOnly: true, price: 200 },
]

export const BAND_KEYS = new Set(BANDS.map((b) => b.key))
export const bandOf = (key) => BANDS.find((b) => b.key === key) || null
export const bandColor = (key) => bandOf(key)?.color || null

/** A band opens once its goal is met. */
export function bandEarned(band, progress) {
  if (!band) return false
  if (band.shopOnly) return false
  if (!band.need) return true
  const [have, target] = band.need(progress)
  return (have || 0) >= target
}
