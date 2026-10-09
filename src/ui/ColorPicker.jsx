import { useId } from 'react'
import { COLOR_PRESETS } from '../data/TeamOptions'
import { playButtonSelect } from '../audio/SoundManager'

/**
 * A row of quick colours plus a rainbow swatch that opens the phone's full
 * colour picker. `allowDefault` adds an "Auto" choice that clears the colour.
 */
export default function ColorPicker({ label, value, onPick, disabled, allowDefault = false, autoLabel = 'Auto' }) {
  const id = useId()
  const custom = !!value && !COLOR_PRESETS.includes(value)
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="swatches" role="group" aria-label={label}>
        {allowDefault && (
          <button
            className="swatch swatch-auto"
            aria-pressed={!value}
            aria-label={`${label}: ${autoLabel}`}
            title={autoLabel}
            disabled={disabled}
            onClick={() => { playButtonSelect(); onPick('') }}
          >A</button>
        )}
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            aria-pressed={value === c}
            aria-label={`${label} ${c}`}
            disabled={disabled}
            onClick={() => { playButtonSelect(); onPick(c) }}
          />
        ))}
        <label className="swatch swatch-custom" aria-pressed={custom} htmlFor={id} title="Any colour" style={custom ? { '--picked': value } : undefined}>
          <span className="sr-only">{label}: any colour</span>
          <input
            id={id}
            type="color"
            value={value || '#ffffff'}
            disabled={disabled}
            onChange={(e) => onPick(e.target.value.toUpperCase())}
          />
        </label>
      </div>
    </div>
  )
}
