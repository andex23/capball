/** A little traffic cone (the way into the Training Ground). */
export default function Cone({ size = 26 }) {
  return (
    <svg width={size} height={size * 1.22} viewBox="0 0 46 56" aria-hidden="true">
      <ellipse cx="23" cy="51" rx="20" ry="4.5" fill="#d9520e" />
      <path d="M23 3 L37 49 L9 49 Z" fill="#ff7a1a" stroke="#1b0d00" strokeWidth="2" />
      <path d="M15.5 27 L30.5 27 L33 35 L13 35 Z" fill="#fff" />
      <path d="M19 15 L27 15 L28.5 20 L17.5 20 Z" fill="#fff" />
    </svg>
  )
}
