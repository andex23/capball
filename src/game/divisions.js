/** The career divisions and their computer clubs (bottom to top). */
// Bottom (index 0) to top. Each division is a league of you plus five computer clubs.
export const DIVISIONS = [
  {
    name: 'Sunday League', difficulty: 'easy',
    clubs: [
      { name: 'Bottle Rockets', primary: '#FF7043', edge: '#FFFFFF', pattern: 'stripe' },
      { name: 'Corner Shop FC', primary: '#8D6E63', edge: '#FFE082', pattern: 'ring' },
      { name: 'Fizzy Rovers', primary: '#26C6DA', edge: '#FFFFFF', pattern: 'dots' },
      { name: 'Park Rangers', primary: '#43A047', edge: '#FFFFFF', pattern: 'split' },
      { name: 'Kerbside Utd', primary: '#757575', edge: '#FFEB3B', pattern: 'cross' },
    ],
  },
  {
    name: 'District League', difficulty: 'easy',
    clubs: [
      { name: 'Crown City', primary: '#5E35B1', edge: '#FFD54F', pattern: 'ring', badge: 'crown' },
      { name: 'Tin Town', primary: '#90A4AE', edge: '#263238', pattern: 'stripe' },
      { name: 'Soda Valley', primary: '#EC407A', edge: '#FFFFFF', pattern: 'wave' },
      { name: 'Flick Athletic', primary: '#1E88E5', edge: '#FFEB3B', pattern: 'split' },
      { name: 'Rimside Wdrs', primary: '#6D4C41', edge: '#FFFFFF', pattern: 'rays' },
    ],
  },
  {
    name: 'National League', difficulty: 'medium',
    clubs: [
      { name: 'Cola Athletic', primary: '#C8102E', edge: '#FFFFFF', pattern: 'wave' },
      { name: 'Crimp United', primary: '#0D47A1', edge: '#FFFFFF', pattern: 'stripe', badge: 'shield' },
      { name: 'Bottleneck City', primary: '#00897B', edge: '#FFFFFF', pattern: 'ring' },
      { name: 'Seaside Pop', primary: '#FFB300', edge: '#0D47A1', pattern: 'rays' },
      { name: 'Ginger Town', primary: '#0B4D2C', edge: '#E8C766', pattern: 'stripe' },
    ],
  },
  {
    name: 'Premier Cap League', difficulty: 'hard',
    clubs: [
      { name: 'Royal Crowns', primary: '#4A148C', edge: '#FFD700', pattern: 'ring', badge: 'crown', finish: 'chrome' },
      { name: 'Chrome FC', primary: '#B0BEC5', edge: '#B71C1C', pattern: 'none', badge: 'star', finish: 'chrome' },
      { name: 'Golden Caps', primary: '#F9A825', edge: '#3E2723', pattern: 'rays', finish: 'gloss' },
      { name: 'Sparkle Utd', primary: '#E53935', edge: '#FFFFFF', pattern: 'dots', badge: 'bolt' },
      { name: 'Metro Fizz', primary: '#212121', edge: '#00E5FF', pattern: 'split', badge: 'flame' },
    ],
  },
]
