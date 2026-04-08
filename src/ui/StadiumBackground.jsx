import { useEffect, useRef } from 'react'

/**
 * Generates a retro stadium atmosphere background — a real rasterized bitmap.
 * Closely matches the reference: warm floodlight arc, colorful crowd,
 * purple sky, green pitch glow.
 *
 * TO USE YOUR OWN IMAGE:
 *   Save your file as: public/assets/menu-bg.jpg
 *   The MenuScreen will automatically load it instead of this canvas.
 */
export default function StadiumBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const w = 1920
    const h = 1080
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    // === Deep purple/blue stadium sky ===
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45)
    skyGrad.addColorStop(0, '#0a0820')
    skyGrad.addColorStop(0.3, '#15123a')
    skyGrad.addColorStop(0.6, '#1a1650')
    skyGrad.addColorStop(1, '#1d1a55')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, w, h)

    // === Stars in sky ===
    drawStars(ctx, w, h * 0.35)

    // === Warm floodlight arc across upper portion ===
    drawFloodlightArc(ctx, w, h)

    // === Stadium crowd bowl ===
    drawCrowdBowl(ctx, w, h)

    // === Pitch green glow at bottom ===
    const pitchGlow = ctx.createRadialGradient(w / 2, h * 0.95, 30, w / 2, h * 0.75, h * 0.45)
    pitchGlow.addColorStop(0, 'rgba(50, 140, 50, 0.2)')
    pitchGlow.addColorStop(0.4, 'rgba(35, 100, 35, 0.1)')
    pitchGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = pitchGlow
    ctx.fillRect(0, h * 0.5, w, h * 0.5)

    // === Green pitch strip at bottom ===
    const pitchY = h * 0.82
    const pitchGrad = ctx.createLinearGradient(0, pitchY, 0, h)
    pitchGrad.addColorStop(0, 'rgba(25, 70, 28, 0.0)')
    pitchGrad.addColorStop(0.1, 'rgba(30, 85, 32, 0.3)')
    pitchGrad.addColorStop(0.4, 'rgba(35, 100, 38, 0.45)')
    pitchGrad.addColorStop(1, 'rgba(18, 55, 22, 0.5)')
    ctx.fillStyle = pitchGrad
    ctx.fillRect(0, pitchY, w, h - pitchY)

    // === Subtle haze ===
    drawHazeParticles(ctx, w, h)

    // === Vignette ===
    const vignette = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.12, w / 2, h * 0.45, h * 0.9)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(0.5, 'rgba(0,0,0,0)')
    vignette.addColorStop(0.8, 'rgba(0,0,0,0.2)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    // === Film grain ===
    addFilmGrain(ctx, w, h, 0.025)

  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
      }}
    />
  )
}

function drawStars(ctx, w, maxY) {
  ctx.save()
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * w
    const y = Math.random() * maxY
    const size = 0.3 + Math.random() * 1.2
    const alpha = 0.2 + Math.random() * 0.5
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200, 210, 255, ${alpha})`
    ctx.fill()
  }
  ctx.restore()
}

function drawFloodlightArc(ctx, w, h) {
  // Wide warm orange/amber arc of floodlights across upper-mid area
  // Matching the reference: a bright band of warm light sweeping across

  // Main warm glow arc
  ctx.save()
  const arcY = h * 0.32
  const arcGrad = ctx.createRadialGradient(w / 2, arcY, w * 0.05, w / 2, arcY, w * 0.55)
  arcGrad.addColorStop(0, 'rgba(255, 200, 100, 0.2)')
  arcGrad.addColorStop(0.2, 'rgba(255, 180, 80, 0.12)')
  arcGrad.addColorStop(0.5, 'rgba(255, 160, 60, 0.05)')
  arcGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = arcGrad
  ctx.fillRect(0, 0, w, h * 0.65)

  // Individual floodlight clusters along the arc
  const numLights = 28
  for (let i = 0; i < numLights; i++) {
    const t = i / (numLights - 1) // 0 to 1
    const x = w * 0.05 + t * w * 0.9
    // Arc curve — parabola peaking at edges, dipping in center
    const curve = 0.6 + 0.35 * Math.pow(2 * t - 1, 2)
    const y = h * (0.25 + 0.12 * curve)

    const brightness = 0.4 + Math.random() * 0.3
    const size = 15 + Math.random() * 25

    // Warm orange glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3)
    glow.addColorStop(0, `rgba(255, 200, 120, ${brightness * 0.6})`)
    glow.addColorStop(0.3, `rgba(255, 175, 80, ${brightness * 0.25})`)
    glow.addColorStop(0.6, `rgba(255, 150, 50, ${brightness * 0.08})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6)

    // Core bright dot
    ctx.beginPath()
    ctx.arc(x, y, size * 0.25, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 240, 200, ${brightness})`
    ctx.fill()
  }

  // Bright floodlight towers at far corners (bigger, brighter)
  const towerPositions = [
    { x: w * 0.04, y: h * 0.18 },
    { x: w * 0.96, y: h * 0.18 },
    { x: w * 0.15, y: h * 0.22 },
    { x: w * 0.85, y: h * 0.22 },
  ]
  for (const pos of towerPositions) {
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 80)
    glow.addColorStop(0, 'rgba(255, 245, 220, 0.8)')
    glow.addColorStop(0.15, 'rgba(255, 220, 160, 0.4)')
    glow.addColorStop(0.4, 'rgba(255, 190, 100, 0.12)')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(pos.x - 80, pos.y - 80, 160, 160)

    // Bright core
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 250, 240, 0.95)'
    ctx.fill()
  }

  ctx.restore()
}

function drawCrowdBowl(ctx, w, h) {
  const bowlTopY = h * 0.33
  const bowlBottomY = h * 0.78

  // Stadium bowl — curved mass with warm lighting from above
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, bowlTopY + 50)
  ctx.quadraticCurveTo(w * 0.12, bowlTopY - 20, w * 0.28, bowlTopY + 30)
  ctx.quadraticCurveTo(w * 0.5, bowlTopY + 80, w * 0.72, bowlTopY + 30)
  ctx.quadraticCurveTo(w * 0.88, bowlTopY - 20, w, bowlTopY + 50)
  ctx.lineTo(w, bowlBottomY)
  ctx.lineTo(0, bowlBottomY)
  ctx.closePath()

  // Warm-lit crowd gradient
  const crowdGrad = ctx.createLinearGradient(0, bowlTopY, 0, bowlBottomY)
  crowdGrad.addColorStop(0, 'rgba(60, 40, 30, 0.5)')
  crowdGrad.addColorStop(0.15, 'rgba(50, 35, 40, 0.65)')
  crowdGrad.addColorStop(0.4, 'rgba(35, 25, 45, 0.75)')
  crowdGrad.addColorStop(0.7, 'rgba(20, 18, 35, 0.85)')
  crowdGrad.addColorStop(1, 'rgba(12, 12, 25, 0.9)')
  ctx.fillStyle = crowdGrad
  ctx.fill()
  ctx.restore()

  // Crowd color dots — camera flashes, team colors, warm accents
  ctx.save()
  for (let i = 0; i < 1200; i++) {
    const px = Math.random() * w
    const py = bowlTopY + 15 + Math.random() * (bowlBottomY - bowlTopY - 30)

    // Check roughly inside bowl
    const t = px / w
    const baseY = bowlTopY + 30 + Math.sin(t * Math.PI) * 50
    if (py < baseY - 15) continue

    const size = 0.4 + Math.random() * 1.8
    const rnd = Math.random()

    if (rnd > 0.95) {
      // Camera flash — bright white/yellow
      ctx.globalAlpha = 0.3 + Math.random() * 0.5
      ctx.fillStyle = `rgba(255, 250, 220, 1)`
      ctx.fillRect(px, py, size * 1.5, size * 1.5)
    } else if (rnd > 0.82) {
      // Red team crowd
      ctx.globalAlpha = 0.15 + Math.random() * 0.2
      const reds = ['rgba(229,57,53,1)', 'rgba(198,40,40,1)', 'rgba(255,100,80,1)']
      ctx.fillStyle = reds[Math.floor(Math.random() * reds.length)]
      ctx.fillRect(px, py, size * 2.5, size * 2)
    } else if (rnd > 0.69) {
      // Blue team crowd
      ctx.globalAlpha = 0.15 + Math.random() * 0.2
      const blues = ['rgba(30,136,229,1)', 'rgba(21,101,192,1)', 'rgba(66,165,245,1)']
      ctx.fillStyle = blues[Math.floor(Math.random() * blues.length)]
      ctx.fillRect(px, py, size * 2.5, size * 2)
    } else if (rnd > 0.58) {
      // Warm highlight (amber/orange from floodlights)
      ctx.globalAlpha = 0.08 + Math.random() * 0.12
      ctx.fillStyle = `rgba(255, 190, 100, 1)`
      ctx.fillRect(px, py, size * 2, size * 1.5)
    } else if (rnd > 0.35) {
      // Yellow/green/misc colors
      ctx.globalAlpha = 0.06 + Math.random() * 0.1
      const misc = ['rgba(255,215,64,1)', 'rgba(100,200,100,1)', 'rgba(255,150,200,1)', 'rgba(180,130,255,1)']
      ctx.fillStyle = misc[Math.floor(Math.random() * misc.length)]
      ctx.fillRect(px, py, size * 2, size * 1.5)
    } else {
      // Dark silhouette
      ctx.globalAlpha = 0.15 + Math.random() * 0.25
      ctx.fillStyle = `rgba(15, 12, 25, 1)`
      ctx.fillRect(px, py, size * 1.5, size * 2.5)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Bowl edge highlights
  ctx.save()
  ctx.strokeStyle = 'rgba(180, 140, 80, 0.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, bowlTopY + 48)
  ctx.quadraticCurveTo(w * 0.12, bowlTopY - 22, w * 0.28, bowlTopY + 28)
  ctx.quadraticCurveTo(w * 0.5, bowlTopY + 78, w * 0.72, bowlTopY + 28)
  ctx.quadraticCurveTo(w * 0.88, bowlTopY - 22, w, bowlTopY + 48)
  ctx.stroke()
  ctx.restore()

  // Horizontal tier lines in the stands
  ctx.save()
  ctx.strokeStyle = 'rgba(100, 80, 60, 0.04)'
  ctx.lineWidth = 1
  for (let tier = 0; tier < 5; tier++) {
    const ty = bowlTopY + 60 + tier * ((bowlBottomY - bowlTopY - 60) / 5)
    ctx.beginPath()
    ctx.moveTo(0, ty)
    ctx.lineTo(w, ty)
    ctx.stroke()
  }
  ctx.restore()
}

function drawHazeParticles(ctx, w, h) {
  ctx.save()
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * w
    const y = h * 0.15 + Math.random() * h * 0.5
    const size = 25 + Math.random() * 80
    const alpha = 0.008 + Math.random() * 0.02

    const haze = ctx.createRadialGradient(x, y, 0, x, y, size)
    haze.addColorStop(0, `rgba(200, 190, 220, ${alpha})`)
    haze.addColorStop(1, 'transparent')
    ctx.fillStyle = haze
    ctx.fillRect(x - size, y - size, size * 2, size * 2)
  }
  ctx.restore()
}

function addFilmGrain(ctx, w, h, intensity) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for perf
    const noise = (Math.random() - 0.5) * 255 * intensity
    data[i] = Math.min(255, Math.max(0, data[i] + noise))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise))
  }
  ctx.putImageData(imageData, 0, 0)
}
