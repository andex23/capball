// Attributes use the same power, shooting, passing and physical scales as every career cap.
export const LEGENDS = [
  ['castoro', 'Castoro', 'ATK', 31, 750, 'range', [91, 98, 82, 84], 'A scratched brass cap that made its name scoring from the centre spot.'],
  ['miranda', 'Miranda', 'MID', 32, 680, 'touch', [82, 86, 99, 85], 'Learned to split two defenders with one soft flick on a narrow kitchen table.'],
  ['ivanov', 'Ivanov', 'GK', 33, 850, 'reflex', [84, 75, 89, 98], 'His folded foot is worn smooth from sliding post to post.'],
  ['valeno', 'Valeno', 'DEF', 32, 590, 'weight', [89, 79, 86, 98], 'A heavy steel cap that stayed planted when lighter caps skidded away.'],
  ['espino', 'Espino', 'MID', 31, 820, 'touch', [87, 89, 97, 84], 'Played his first season on a table barely wide enough for two passing lanes.'],
  ['ordaro', 'Ordaro', 'ATK', 33, 1050, 'range', [96, 97, 80, 88], 'Won a cup final with a flick from his own half. The dent in his skirt is still there.'],
  ['stamel', 'Stamel', 'DEF', 32, 720, 'weight', [90, 78, 85, 96], 'Kept his original steel rim through three championship seasons.'],
  ['hasken', 'Hasken', 'GK', 32, 950, 'reflex', [83, 76, 91, 97], 'An upright keeper whose first move is a short slide across the line.'],
  ['burano', 'Burano', 'ATK', 30, 1200, 'range', [98, 96, 80, 86], 'Practised on a long dining table before anyone let him near the short one.'],
  ['cerrin', 'Cerrin', 'MID', 33, 560, 'touch', [84, 85, 98, 83], 'Still carries the thin painted stripe he used to line up his passes.'],
  ['dormer', 'Dormer', 'DEF', 31, 900, 'weight', [92, 80, 87, 97], 'His low centre of gravity made him the last cap picked up after a scramble.'],
  ['lazari', 'Lazari', 'ATK', 32, 1400, 'range', [96, 99, 87, 88], 'His favourite shot starts just inside his own half, one flick from the side rail.'],
].map(([key, name, pos, age, fee, trait, [pwr, sht, pas, phy], story]) => ({
  id: 'leg-' + key, name, pos, age, fee, trait, attrs: { pwr, sht, pas, phy }, story,
}))

export const TRAIT_LABEL = {
  range: 'Long shots drift half as far',
  touch: 'Soft passes hold their line',
  reflex: 'Quicker slides across goal',
  weight: 'Extra weight in collisions',
}

export const legendById = (id) => LEGENDS.find((p) => p.id === id)

export function seasonLegends(season) {
  const first = ((Math.max(1, season) - 1) * 2) % LEGENDS.length
  return LEGENDS.slice(first, first + 2)
}

