import { useMatchStore, SCREEN } from '../state/MatchStore'

export default function RulesScreen() {
  const goToScreen = useMatchStore((s) => s.goToScreen)

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />

      <div style={styles.card}>
        <h1 style={styles.title}>HOW TO PLAY</h1>
        <div style={styles.titleLine} />

        <div style={styles.scrollArea}>
          <Section title="GAMEPLAY">
            <Rule icon="1" text="Teams take turns flicking their caps" />
            <Rule icon="2" text="Select a cap, drag to aim, release to flick" />
            <Rule icon="3" text="Hit the ball into the opponent's goal to score" />
            <Rule icon="4" text="Once all pieces stop moving, the turn ends" />
          </Section>

          <Section title="MATCH RULES">
            <Rule icon="&#9917;" text="Match lasts 2, 3, or 5 minutes" />
            <Rule icon="&#9917;" text="Highest score at full time wins" />
            <Rule icon="&#9917;" text="After each goal, play restarts from center" />
            <Rule icon="&#9917;" text="Goalkeepers cannot score goals" />
          </Section>

          <Section title="FOULS">
            <Rule icon="!" text="Hitting an opponent cap before the ball is a foul" />
            <Rule icon="!" text="Fouls give a free kick to the other team" />
            <Rule icon="!" text="Fouls inside the penalty box give a penalty kick" />
          </Section>

          <Section title="SET PIECES">
            <Rule icon="&#8594;" text="Free kick: ball placed at foul spot" />
            <Rule icon="&#8594;" text="Penalty: ball placed at the penalty spot" />
            <Rule icon="&#8594;" text="Fouled team takes the kick" />
          </Section>

          <Section title="CONTROLS">
            <Rule icon="&#9755;" text="Left-click/drag to select and flick caps" />
            <Rule icon="&#9755;" text="Right-drag to rotate camera" />
            <Rule icon="&#9755;" text="Scroll to zoom in/out" />
          </Section>
        </div>

        <button style={styles.backBtn} onClick={() => goToScreen(SCREEN.MENU)}>
          BACK TO MENU
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.ruleList}>{children}</div>
    </div>
  )
}

function Rule({ icon, text }) {
  return (
    <div style={styles.rule}>
      <span style={styles.ruleIcon}>{icon}</span>
      <span style={styles.ruleText}>{text}</span>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #060814 0%, #0c1028 30%, #111840 60%, #0a0e22 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "var(--font-hud, 'Russo One', sans-serif)",
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(16,20,45,0.95) 0%, rgba(10,13,30,0.98) 100%)',
    border: '1.5px solid rgba(255,215,64,0.3)',
    borderRadius: '16px',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    position: 'relative',
    zIndex: 1,
    maxWidth: '680px',
    width: '90%',
    maxHeight: '85vh',
  },
  title: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '28px',
    fontWeight: '900',
    color: '#FFD740',
    margin: 0,
    letterSpacing: '5px',
    textShadow: '0 0 15px rgba(255,215,64,0.3), 0 2px 0 #B8860B',
  },
  titleLine: {
    width: '160px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FFD740, transparent)',
  },
  scrollArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
    overflowY: 'auto',
    maxHeight: 'calc(85vh - 160px)',
    paddingRight: '8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sectionTitle: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '12px',
    fontWeight: '700',
    color: '#FFD740',
    letterSpacing: '3px',
    margin: 0,
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,215,64,0.15)',
  },
  ruleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rule: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '4px 0',
  },
  ruleIcon: {
    fontSize: '12px',
    color: 'rgba(255,215,64,0.5)',
    minWidth: '18px',
    textAlign: 'center',
    lineHeight: '18px',
  },
  ruleText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '0.5px',
    lineHeight: '18px',
  },
  backBtn: {
    fontFamily: "var(--font-display, 'Bungee', sans-serif)",
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.7)',
    padding: '12px 32px',
    background: 'linear-gradient(180deg, rgba(55,60,85,0.9) 0%, rgba(30,33,50,0.95) 100%)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
    outline: 'none',
    marginTop: '4px',
  },
}
