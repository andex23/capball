import { useState } from 'react'
import { useClipStore, shareClip } from '../game/clips'
import { playButtonSelect } from '../audio/SoundManager'
import Icon from './Icon'

/** This match's goal replays, ready to share or save. */
export default function GoalClips({ limit = 3, open = false }) {
  const clips = useClipStore((s) => s.clips)
  const [note, setNote] = useState(null)
  const [playing, setPlaying] = useState(null)
  if (!clips.length) return null
  const share = async (c) => {
    playButtonSelect()
    const how = await shareClip(c)
    setNote(how === 'downloaded' ? 'Saved to your downloads.' : how === 'shared' ? 'Shared!' : null)
  }
  return (
    <details className="goal-clips" open={open || undefined} onToggle={(e) => { if (e.currentTarget.open) playButtonSelect() }}>
      <summary className="goal-clips-summary">
        <span className="eyebrow">Goal clips</span>
        <span className="goal-clips-count">{Math.min(limit, clips.length)}</span>
        <Icon name="next" size={14} />
      </summary>
      <div className="goal-clips-row">
        {clips.slice(0, limit).map((c, i) => (
          <div className="goal-clip" key={c.url}>
            {playing === c.url
              ? <video src={c.url} autoPlay muted playsInline loop className="goal-clip-video" onClick={() => setPlaying(null)} />
              : (
                <button className="goal-clip-thumb" onClick={() => { playButtonSelect(); setPlaying(c.url) }} aria-label={`Watch goal ${clips.length - i}`}>
                  <Icon name="play" size={20} />
                  <span>{c.scorer || 'Goal'}</span>
                </button>
              )}
            <button className="btn btn-gold goal-clip-share" onClick={() => share(c)}><Icon name="share" size={16} /> Share</button>
          </div>
        ))}
      </div>
      {note && <p className="muted t-note" role="status">{note}</p>}
    </details>
  )
}
