// Small stroke icon set (24×24, currentColor). Decorative unless a label is passed.
const PATHS = {
  play: <path d="M7 5v14l12-7z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  back: <><path d="M15 6l-6 6 6 6" /></>,
  next: <><path d="M9 6l6 6-6 6" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.4c2.3.2 3.9 1.8 4.5 4.6" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5" /><circle cx="12" cy="16.8" r=".6" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" /></>,
  camera: <><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" /><circle cx="12" cy="13" r="3.2" /></>,
  restart: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v3.5H8" /></>,
  exit: <><path d="M14 4h4.5v16H14" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h9" /></>,
  share: <><circle cx="17" cy="6" r="2.4" /><circle cx="7" cy="12" r="2.4" /><circle cx="17" cy="18" r="2.4" /><path d="M9.1 10.9l5.8-3.6M9.1 13.1l5.8 3.6" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  volume: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3" /><path d="M12 13v4M8.5 20h7M9.5 17h5v3h-5z" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4z" /><path d="M12 3.5v4M15.4 10l4.2-1.3M14.1 14l2.6 3.5M9.9 14l-2.6 3.5M8.6 10L4.4 8.7" /></>,
  wifi: <><path d="M3.5 9a12 12 0 0 1 17 0" /><path d="M6.5 12.2a7.5 7.5 0 0 1 11 0" /><path d="M9.5 15.4a3.2 3.2 0 0 1 5 0" /><circle cx="12" cy="18.5" r=".9" fill="currentColor" /></>,
}

export default function Icon({ name, size = 20, label, strokeWidth = 1.9, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    >
      {PATHS[name]}
    </svg>
  )
}
