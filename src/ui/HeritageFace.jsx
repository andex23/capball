import { useId } from 'react'
import { heritageFace, HERITAGE_FONT, FACE_GRADIENTS } from '../data/HeritageCaps.js'

/** The same normalized print paths and text widths used in the 3D texture. */
export default function HeritageFace({ config, number, capText, transform }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '_')
  const face = heritageFace({ ...config, number, capText })
  if (!face) return null
  const paint = value => value?.startsWith('@') ? 'url(#'+uid+'-'+value.slice(1)+')' : value
  return (
    <g transform={transform} pointerEvents="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <clipPath id={uid+'-disc'}><circle cx="50" cy="50" r="50" /></clipPath>
        {Object.entries(FACE_GRADIENTS).map(([key,[x1,y1,x2,y2,stops]]) => (
          <linearGradient key={key} id={uid+'-'+key} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
            {stops.map(([offset,color]) => <stop key={offset} offset={offset} stopColor={color} />)}
          </linearGradient>
        ))}
      </defs>
      <g clipPath={'url(#'+uid+'-disc)'}>
        {face.shapes.map((item,i) => <path key={i} d={item.d} fill={paint(item.fill)} stroke={paint(item.stroke)} strokeWidth={item.strokeWidth} />)}
        {face.labels.map((item,i) => (
          <text key={i} x={item.x} y={item.y} textAnchor="middle" dominantBaseline="central"
            fontFamily={HERITAGE_FONT} fontWeight="900" fontStyle={item.style} fontSize={item.size}
            textLength={item.width} lengthAdjust="spacingAndGlyphs"
            fill={item.fill} stroke={item.stroke} strokeWidth={item.strokeWidth} paintOrder="stroke">
            {item.text}
          </text>
        ))}
      </g>
    </g>
  )
}
