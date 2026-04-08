import { useState, useEffect } from 'react'
import { useMatchStore, SCREEN, MATCH_DURATIONS } from '../state/MatchStore'
import StadiumBackground from '../ui/StadiumBackground'
import { playButtonSelect, playConfirm, playBack, playMenuNavigate, playHoverTick } from '../audio/SoundManager'
import { startMenuMusic, updateMenuMusicVolume } from '../audio/MusicManager'

const BG_IMAGE_PATH = '/assets/menu-bg.jpg'

export default function MenuScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)
  const setGameMode = useMatchStore((s) => s.setGameMode)
  const matchDuration = useMatchStore((s) => s.matchDuration)
  const setMatchDuration = useMatchStore((s) => s.setMatchDuration)
  const masterVolume = useMatchStore((s) => s.masterVolume)
  const sfxVolume = useMatchStore((s) => s.sfxVolume)
  const muted = useMatchStore((s) => s.muted)
  const setMasterVolume = useMatchStore((s) => s.setMasterVolume)
  const setSfxVolume = useMatchStore((s) => s.setSfxVolume)
  const aiDifficulty = useMatchStore((s) => s.aiDifficulty)
  const setAiDifficulty = useMatchStore((s) => s.setAiDifficulty)
  const toggleMute = useMatchStore((s) => s.toggleMute)

  const [imgFailed, setImgFailed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // Keep music playing on menu, update volume when settings change
  useEffect(() => {
    startMenuMusic()
  }, [])
  useEffect(() => {
    updateMenuMusicVolume()
  }, [masterVolume, muted])

  const handleMode = (mode) => {
    playConfirm()
    setGameMode(mode)
    goToScreen(SCREEN.TEAM_SELECT)
  }

  const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={styles.container}>
      {!imgFailed ? (
        <img
          src={BG_IMAGE_PATH}
          alt=""
          style={styles.bgImage}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <StadiumBackground />
      )}

      <div style={styles.overlay} />

      {/* Main content */}
      <div style={styles.content}>
        <div style={styles.logoContainer}>
          <h1 style={styles.title}>CAPBALL</h1>
          <div style={styles.titleUnderline} />
          <p style={styles.subtitle}>TABLETOP FOOTBALL</p>
        </div>

        <div style={styles.ballIcon}>&#9917;</div>

        <p style={styles.pressStart}>SELECT GAME MODE</p>

        <div style={styles.buttons}>
          <button
            className="arcade-btn"
            style={styles.buttonRed}
            onClick={() => handleMode('local')}
            onMouseEnter={() => playHoverTick()}
          >
            LOCAL MATCH
          </button>
          <button
            className="arcade-btn"
            style={styles.buttonBlue}
            onClick={() => handleMode('ai')}
            onMouseEnter={() => playHoverTick()}
          >
            VS COMPUTER
          </button>
          <button
            className="arcade-btn"
            style={styles.buttonOnline}
            onClick={() => { playConfirm(); goToScreen(SCREEN.ONLINE) }}
            onMouseEnter={() => playHoverTick()}
          >
            ONLINE MATCH
          </button>
        </div>

        {/* Bottom row: How to Play + Settings */}
        <div style={styles.bottomLinks}>
          <button className="arcade-link" style={styles.linkBtn} onClick={() => { playMenuNavigate(); setShowRules(!showRules); setShowSettings(false) }} onMouseEnter={() => playHoverTick()} title="How to Play">
            <span style={{ fontSize: '16px' }}>&#9873;</span> {showRules ? 'CLOSE' : 'HOW TO PLAY'}
          </button>
          <button className="arcade-link" style={styles.linkBtn} onClick={() => { playMenuNavigate(); setShowSettings(!showSettings); setShowRules(false) }} onMouseEnter={() => playHoverTick()} title="Settings">
            <span style={{ fontSize: '16px' }}>&#9881;</span> {showSettings ? 'CLOSE' : 'SETTINGS'}
          </button>
        </div>

        {/* Settings panel — popup bottom-right */}
        {showSettings && (
          <div style={styles.settingsPopup}>
            {/* Match Duration */}
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>MATCH TIME</span>
              <div style={styles.durationPills}>
                {MATCH_DURATIONS.map((d) => (
                  <button
                    key={d}
                    className="pill-btn"
                    onClick={() => { playButtonSelect(); setMatchDuration(d) }}
                    onMouseEnter={() => playHoverTick()}
                    style={{
                      ...styles.pill,
                      background: matchDuration === d
                        ? 'linear-gradient(135deg, rgba(255,215,64,0.2) 0%, rgba(255,215,64,0.08) 100%)'
                        : 'rgba(0,0,0,0.3)',
                      border: matchDuration === d
                        ? '1.5px solid rgba(255,215,64,0.6)'
                        : '1px solid rgba(255,255,255,0.12)',
                      color: matchDuration === d ? '#FFD740' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {formatDuration(d)}
                  </button>
                ))}
              </div>
            </div>

            {/* Master Volume */}
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>VOLUME</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderVal}>{Math.round(masterVolume * 100)}%</span>
            </div>

            {/* SFX Volume */}
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>SFX</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sfxVolume}
                onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderVal}>{Math.round(sfxVolume * 100)}%</span>
            </div>

            {/* Mute toggle */}
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>MUTE</span>
              <button
                className="pill-btn"
                onClick={() => { playButtonSelect(); toggleMute() }}
                style={{
                  ...styles.muteBtn,
                  background: muted ? 'rgba(255,87,34,0.25)' : 'rgba(76,175,80,0.2)',
                  border: muted ? '1px solid rgba(255,87,34,0.5)' : '1px solid rgba(76,175,80,0.4)',
                  color: muted ? '#FF5722' : '#4CAF50',
                }}
              >
                {muted ? 'MUTED' : 'ON'}
              </button>
            </div>

            {/* AI Difficulty */}
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>AI LEVEL</span>
              <div style={styles.durationPills}>
                {['easy', 'medium', 'hard'].map((d) => (
                  <button
                    key={d}
                    className="pill-btn"
                    onClick={() => { playButtonSelect(); setAiDifficulty(d) }}
                    onMouseEnter={() => playHoverTick()}
                    style={{
                      ...styles.pill,
                      background: aiDifficulty === d
                        ? 'linear-gradient(135deg, rgba(255,215,64,0.2) 0%, rgba(255,215,64,0.08) 100%)'
                        : 'rgba(0,0,0,0.3)',
                      border: aiDifficulty === d
                        ? '1.5px solid rgba(255,215,64,0.6)'
                        : '1px solid rgba(255,255,255,0.12)',
                      color: aiDifficulty === d ? '#FFD740' : 'rgba(255,255,255,0.5)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rules popup — bottom-left */}
        {showRules && (
          <div style={styles.rulesPopup}>
            <div style={styles.popupTitle}>HOW TO PLAY</div>
            <div style={styles.ruleItem}><b>1.</b> Teams take turns flicking caps</div>
            <div style={styles.ruleItem}><b>2.</b> Select a cap, drag back to aim, release to flick</div>
            <div style={styles.ruleItem}><b>3.</b> Hit the ball into the opponent's goal</div>
            <div style={styles.ruleItem}><b>4.</b> Turn ends when all pieces stop</div>
            <div style={styles.popupDivider} />
            <div style={styles.popupTitle}>RULES</div>
            <div style={styles.ruleItem}>&#9917; Match lasts 2, 3, or 5 minutes</div>
            <div style={styles.ruleItem}>&#9917; Highest score wins</div>
            <div style={styles.ruleItem}>&#9917; No goal from kickoff</div>
            <div style={styles.ruleItem}>&#9917; GK stays in penalty area</div>
            <div style={styles.popupDivider} />
            <div style={styles.popupTitle}>FOULS</div>
            <div style={styles.ruleItem}>! Hit opponent before ball = foul</div>
            <div style={styles.ruleItem}>! Foul = free kick or penalty</div>
          </div>
        )}
      </div>

      <div style={styles.creditStrip}>
        <span style={styles.creditText}>&#9917; CAPBALL TABLETOP FOOTBALL &#9917;</span>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    position: 'relative',
    overflow: 'hidden',
    background: '#050818',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 40%',
    zIndex: 0,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(2,3,10,0.78) 0%, rgba(2,3,10,0.5) 25%, rgba(2,3,10,0.42) 50%, rgba(2,3,10,0.55) 75%, rgba(2,3,10,0.82) 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  content: {
    textAlign: 'center',
    position: 'relative',
    zIndex: 2,
    animation: 'fadeIn 0.8s ease-out',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '16px',
  },
  title: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: 'clamp(48px, 8vw, 80px)',
    fontWeight: '900',
    color: '#FFD740',
    textShadow: '0 0 30px rgba(255,215,64,0.5), 0 4px 0 #B8860B, 0 8px 25px rgba(0,0,0,0.7)',
    margin: 0,
    letterSpacing: '8px',
    lineHeight: 1,
    animation: 'titleFloat 3s ease-in-out infinite',
  },
  titleUnderline: {
    width: '200px',
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
    margin: '10px auto 14px',
    borderRadius: '2px',
  },
  subtitle: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: 'clamp(12px, 2vw, 16px)',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '6px',
    textTransform: 'uppercase',
    margin: 0,
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
  },
  ballIcon: {
    fontSize: '36px',
    margin: '24px 0',
    opacity: 0.75,
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    alignItems: 'center',
    marginBottom: '28px',
  },
  buttonRed: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '16px 48px',
    background: 'linear-gradient(180deg, #EF5350 0%, #E53935 40%, #B71C1C 100%)',
    border: '2px solid #B71C1C',
    borderRadius: '10px',
    cursor: 'pointer',
    minWidth: '340px',
    textTransform: 'uppercase',
    textShadow: '0 2px 3px rgba(0,0,0,0.4)',
    boxShadow: '0 4px 0 #7f0000, 0 6px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    outline: 'none',
  },
  buttonBlue: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '16px 48px',
    background: 'linear-gradient(180deg, #42A5F5 0%, #1E88E5 40%, #0D47A1 100%)',
    border: '2px solid #0D47A1',
    borderRadius: '10px',
    cursor: 'pointer',
    minWidth: '340px',
    textTransform: 'uppercase',
    textShadow: '0 2px 3px rgba(0,0,0,0.4)',
    boxShadow: '0 4px 0 #062a6e, 0 6px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    outline: 'none',
  },
  buttonOnline: {
    fontFamily: "var(--font-display, 'Bungee', 'Impact', sans-serif)",
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'white',
    padding: '14px 48px',
    background: 'linear-gradient(180deg, #AB47BC 0%, #8E24AA 40%, #6A1B9A 100%)',
    border: '2px solid #4A148C',
    borderRadius: '10px',
    cursor: 'pointer',
    minWidth: '340px',
    textTransform: 'uppercase',
    textShadow: '0 2px 3px rgba(0,0,0,0.4)',
    boxShadow: '0 4px 0 #4A148C, 0 6px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
    transition: 'transform 0.08s ease, box-shadow 0.08s ease',
    outline: 'none',
  },
  pressStart: {
    fontFamily: "var(--font-pixel, 'Press Start 2P', monospace)",
    fontSize: '10px',
    color: 'rgba(255,215,64,0.6)',
    letterSpacing: '3px',
    animation: 'pressStart 2s ease-in-out infinite',
    textShadow: '0 0 10px rgba(255,215,64,0.3)',
    margin: '0 0 12px',
  },

  /* Bottom links row */
  bottomLinks: {
    position: 'fixed',
    bottom: '24px',
    left: '24px',
    right: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 3,
  },
  linkBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.55)',
    padding: '10px 22px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(4px)',
  },

  /* Settings popup — fixed bottom-right */
  settingsPopup: {
    position: 'fixed',
    bottom: '70px',
    right: '24px',
    background: 'rgba(8,10,25,0.95)',
    border: '1.5px solid rgba(255,215,64,0.25)',
    borderRadius: '12px',
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: '320px',
    maxWidth: '380px',
    animation: 'fadeIn 0.2s ease-out',
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  /* Rules popup — fixed bottom-left */
  rulesPopup: {
    position: 'fixed',
    bottom: '70px',
    left: '24px',
    background: 'rgba(8,10,25,0.95)',
    border: '1.5px solid rgba(255,215,64,0.25)',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    maxWidth: '340px',
    animation: 'fadeIn 0.2s ease-out',
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  popupTitle: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '11px',
    color: '#FFD740',
    letterSpacing: '2px',
    marginBottom: '2px',
  },
  ruleItem: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '11px',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: '18px',
    letterSpacing: '0.3px',
  },
  popupDivider: {
    height: '1px',
    background: 'rgba(255,215,64,0.12)',
    margin: '4px 0',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  settingLabel: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.4)',
    minWidth: '70px',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  durationPills: {
    display: 'flex',
    gap: '6px',
  },
  pill: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1px',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.12s ease',
  },
  slider: {
    flex: 1,
    height: '4px',
    accentColor: '#FFD740',
    cursor: 'pointer',
  },
  sliderVal: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    color: 'rgba(255,215,64,0.6)',
    minWidth: '32px',
    textAlign: 'right',
  },
  muteBtn: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    padding: '5px 16px',
    borderRadius: '5px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.12s ease',
  },

  creditStrip: {
    position: 'absolute',
    bottom: '16px',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 2,
  },
  creditText: {
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
}
