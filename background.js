/* ===== DEEP DIVE PROTOCOL — CINEMATIC BACKGROUND ENGINE ===== */

(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;z-index:-2;pointer-events:none;width:100%;height:100%';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ───── COLOR PALETTE ───── */
  const COLORS = {
    surface: [110, 198, 255],
    ocean: [33, 150, 243],
    deep: [13, 71, 161],
    midnight: [2, 6, 23],
    abyss: [0, 0, 0],
    glow: [0, 229, 255],
    danger: [255, 77, 77],
  };

  /* ───── ZONE DEFINITIONS ───── */
  const ZONE_STOPS = [
    // SUNLIGHT ZONE — warm turquoise-green, surface glow
    { at: 0.00, bg1: [20, 120, 140], bg2: [10, 80, 110] },
    { at: 0.10, bg1: [15, 100, 130], bg2: [8, 65, 100] },
    // SUNLIGHT → TWILIGHT transition — deeper blue-green
    { at: 0.25, bg1: [8, 55, 100], bg2: [4, 30, 72] },
    // TWILIGHT — dark blue
    { at: 0.42, bg1: [3, 18, 55], bg2: [2, 10, 35] },
    // MIDNIGHT — near black blue
    { at: 0.58, bg1: [2, 7, 25], bg2: [1, 3, 12] },
    { at: 0.72, bg1: [1, 2, 8], bg2: [0, 0, 3] },
    // ABYSS — pure black
    { at: 0.85, bg1: [0, 0, 3], bg2: [0, 0, 0] },
    { at: 1.00, bg1: [0, 0, 0], bg2: [0, 0, 0] },
  ];

  /* ───── UTILITY ───── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  }
  function rgb(c, a) { return a !== undefined ? `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})` : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ───── GLOBAL BREATHING & CURRENT ───── */
  function getBreath(time) {
    return Math.sin(time * 0.00015) * 0.5 + 0.5;
  }
  function getBreathSlow(time) {
    return Math.sin(time * 0.00008) * 0.5 + 0.5;
  }
  function getCurrentX(time) {
    return Math.sin(time * 0.0001) * 0.4 + Math.sin(time * 0.00023) * 0.2;
  }
  function getCurrentY(time) {
    return Math.cos(time * 0.00012) * 0.25 + Math.sin(time * 0.00007) * 0.15;
  }

  /* ───── CAMERA DRIFT (diver floating) ───── */
  // Multi-frequency drift simulates camera mounted on a floating diver
  function getCameraDrift(time) {
    return {
      x: Math.sin(time * 0.00006) * 8 + Math.sin(time * 0.00015) * 4 + Math.cos(time * 0.0001) * 3,
      y: Math.cos(time * 0.00005) * 6 + Math.sin(time * 0.00012) * 3 + Math.cos(time * 0.00008) * 2,
      rot: Math.sin(time * 0.00004) * 0.003 + Math.sin(time * 0.0001) * 0.001,
    };
  }

  /* ───── DEPTH BLUR LAYERS ───── */
  // Off-screen canvas for rendering blurred background layer
  const bgLayer = document.createElement('canvas');
  const bgCtx = bgLayer.getContext('2d');
  function resizeLayers() {
    bgLayer.width = W;
    bgLayer.height = H;
  }
  resizeLayers();
  const origResize = resize;
  resize = function () { origResize(); resizeLayers(); };

  /* ───── FOREGROUND BUBBLES ───── */
  const NUM_BUBBLES = 40;
  const bubbles = [];
  class Bubble {
    constructor() { this.reset(true); }
    reset(initial) {
      this.x = Math.random() * 2000;
      this.y = initial ? Math.random() * 2000 : H + 20;
      this.r = 1.5 + Math.random() * 4;
      this.vy = -(0.2 + Math.random() * 0.5);
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.wobbleFreq = 0.001 + Math.random() * 0.002;
      this.wobbleAmp = 0.3 + Math.random() * 0.6;
      this.shimmerPhase = Math.random() * Math.PI * 2;
      this.opacity = 0.08 + Math.random() * 0.15;
    }
  }
  for (let i = 0; i < NUM_BUBBLES; i++) bubbles.push(new Bubble());

  function drawBubbles(p, time) {
    const densityMul = clamp(1 - p * 1.5, 0.02, 1);
    const count = Math.floor(NUM_BUBBLES * densityMul);
    ctx.save();
    for (let i = 0; i < NUM_BUBBLES; i++) {
      const b = bubbles[i];
      b.y += b.vy;
      b.x += Math.sin(time * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
      if (b.y < -20) b.reset(false);
      if (i >= count) continue;

      const shimmer = 0.6 + Math.sin(time * 0.003 + b.shimmerPhase) * 0.4;
      ctx.globalAlpha = b.opacity * shimmer * clamp(1 - p * 2, 0.1, 1);

      // Bubble ring
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(110,198,255,${0.3 * shimmer})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Specular highlight
      const hx = b.x - b.r * 0.3;
      const hy = b.y - b.r * 0.3;
      ctx.globalAlpha = b.opacity * shimmer * 0.6 * clamp(1 - p * 2, 0.05, 1);
      ctx.fillStyle = 'rgba(200,230,255,0.5)';
      ctx.beginPath();
      ctx.arc(hx, hy, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function getZoneColors(p) {
    for (let i = 0; i < ZONE_STOPS.length - 1; i++) {
      if (p >= ZONE_STOPS[i].at && p <= ZONE_STOPS[i + 1].at) {
        const t = (p - ZONE_STOPS[i].at) / (ZONE_STOPS[i + 1].at - ZONE_STOPS[i].at);
        return {
          bg1: lerpColor(ZONE_STOPS[i].bg1, ZONE_STOPS[i + 1].bg1, t),
          bg2: lerpColor(ZONE_STOPS[i].bg2, ZONE_STOPS[i + 1].bg2, t),
        };
      }
    }
    const last = ZONE_STOPS[ZONE_STOPS.length - 1];
    return { bg1: last.bg1, bg2: last.bg2 };
  }

  /* ───── SCROLL PROGRESS ───── */
  let scrollProgress = 0;
  function updateScroll() {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  /* ═══════════════════════════════════════
     BACKGROUND GRADIENT
     ═══════════════════════════════════════ */
  function drawBackground(p) {
    const colors = getZoneColors(p);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgb(colors.bg1));
    grad.addColorStop(1, rgb(colors.bg2));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ═══════════════════════════════════════
     LIGHT RAYS (SUNLIGHT ZONE)
     — slow sway, breathing intensity, organic drift
     ═══════════════════════════════════════ */
  const NUM_RAYS = 10;
  const rays = [];
  for (let i = 0; i < NUM_RAYS; i++) {
    rays.push({
      x: Math.random(),
      width: 25 + Math.random() * 65,
      speed: 0.00012 + Math.random() * 0.00018,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.025 + Math.random() * 0.045,
      breathPhase: Math.random() * Math.PI * 2,
    });
  }

  function drawLightRays(p, time) {
    const intensity = clamp(1 - p * 4, 0, 1);
    if (intensity <= 0) return;
    const breath = getBreath(time);
    const breathFactor = 0.85 + breath * 0.3;
    ctx.save();

    for (const ray of rays) {
      const sway = Math.sin(time * ray.speed + ray.phase) * 0.06
        + Math.sin(time * ray.speed * 0.4 + ray.breathPhase) * 0.03;
      const x = (ray.x + sway + getCurrentX(time) * 0.02) * W;
      const w = ray.width * (1 + Math.sin(time * ray.speed * 0.5 + ray.breathPhase) * 0.25);
      const a = ray.opacity * intensity * breathFactor;

      // PASS 1: Soft volumetric glow (wider, more transparent)
      ctx.globalCompositeOperation = 'lighter';
      const glowW = w * 2.2;
      const gGrad = ctx.createLinearGradient(x, 0, x, H * 0.85);
      gGrad.addColorStop(0, `rgba(255,220,120,${a * 0.45})`);
      gGrad.addColorStop(0.3, `rgba(180,230,255,${a * 0.22})`);
      gGrad.addColorStop(0.7, `rgba(33,150,243,${a * 0.07})`);
      gGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.moveTo(x - glowW * 0.4, 0);
      ctx.lineTo(x + glowW * 0.4, 0);
      ctx.lineTo(x + glowW * 1.3, H * 0.85);
      ctx.lineTo(x - glowW * 1.1, H * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // PASS 2: Core ray (sharper, brighter)
      const grad = ctx.createLinearGradient(x, 0, x, H);
      grad.addColorStop(0, `rgba(255,225,130,${a * 1.5})`);
      grad.addColorStop(0.2, `rgba(200,235,255,${a * 1.1})`);
      grad.addColorStop(0.5, `rgba(80,180,240,${a * 0.45})`);
      grad.addColorStop(0.75, `rgba(33,150,243,${a * 0.15})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, 0);
      ctx.lineTo(x + w * 0.3, 0);
      ctx.lineTo(x + w * 1.1, H);
      ctx.lineTo(x - w * 0.9, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     CAUSTICS (SUNLIGHT ZONE)
     ═══════════════════════════════════════ */
  function drawCaustics(p, time) {
    const intensity = clamp(1 - p * 3.5, 0, 1);
    if (intensity <= 0) return;
    const breath = getBreathSlow(time);
    ctx.save();
    ctx.globalAlpha = intensity * (0.04 + breath * 0.03);
    ctx.globalCompositeOperation = 'lighter';
    const cellSize = 120;
    const cols = Math.ceil(W / cellSize) + 2;
    const rows = Math.ceil(H / cellSize) + 2;
    // Global drift offset from current
    const driftX = getCurrentX(time) * 15;
    const driftY = getCurrentY(time) * 10;
    for (let col = -1; col < cols; col++) {
      for (let row = -1; row < rows; row++) {
        const cx = col * cellSize + driftX
          + Math.sin(time * 0.00025 + row * 0.5 + col * 0.3) * 35
          + Math.sin(time * 0.00015 + col * 0.7) * 12;
        const cy = row * cellSize + driftY
          + Math.cos(time * 0.0002 + col * 0.4 + row * 0.2) * 30
          + Math.cos(time * 0.00012 + row * 0.6) * 10;
        const r = cellSize * 0.4 + Math.sin(time * 0.0003 + col + row) * 18;
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cGrad.addColorStop(0, 'rgba(110,198,255,0.5)');
        cGrad.addColorStop(0.4, 'rgba(0,229,255,0.2)');
        cGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cGrad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     FLOATING PARTICLES SYSTEM
     ═══════════════════════════════════════ */
  const MAX_PARTICLES = 150;
  const particles = [];
  class BGParticle {
    constructor() { this.reset(true); }
    reset(initial) {
      this.x = Math.random() * 2000;
      this.y = initial ? Math.random() * 2000 : -10;
      this.size = Math.random() * 2.5 + 0.3;
      this.vy = Math.random() * 0.12 + 0.015;
      this.vx = (Math.random() - 0.5) * 0.06;
      this.drift = Math.random() * Math.PI * 2;
      this.drift2 = Math.random() * Math.PI * 2;
      this.driftSpeed = 0.0003 + Math.random() * 0.0007;
      this.glow = Math.random() > 0.82;
      this.glowPhase = Math.random() * Math.PI * 2;
      // Parallax depth layer: 0=far background, 1=midground, 2=foreground
      this.layer = Math.floor(Math.random() * 3);
    }
  }
  for (let i = 0; i < MAX_PARTICLES; i++) particles.push(new BGParticle());

  function drawParticles(p, time) {
    const densityMul = clamp(1 - p * 1.2, 0.05, 1);
    const visibleCount = Math.floor(MAX_PARTICLES * densityMul);
    const curX = getCurrentX(time);
    const curY = getCurrentY(time);
    const breath = getBreath(time);
    // Layer speed multipliers: far = slow, near = fast
    const layerSpeeds = [0.4, 0.7, 1.0];
    const layerSizes = [0.6, 0.85, 1.0];
    const layerAlphas = [0.5, 0.75, 1.0];

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const pt = particles[i];
      const ls = layerSpeeds[pt.layer];
      // Multi-sine organic drift — each particle has unique feel
      pt.y -= pt.vy * ls;
      pt.x += (pt.vx + curX * 0.3 * ls) * ls
        + Math.sin(time * pt.driftSpeed + pt.drift) * 0.05
        + Math.sin(time * pt.driftSpeed * 0.6 + pt.drift2) * 0.03;
      pt.y += curY * 0.15 * ls;
      if (pt.y < -10) { pt.y = H + 10; pt.x = Math.random() * W; }
      if (pt.x < -10) pt.x = W + 10;
      if (pt.x > W + 10) pt.x = -10;

      if (i >= visibleCount) continue;

      let color, glowColor, alpha;
      if (p < 0.2) {
        color = pt.glow ? [0, 229, 255] : [110, 198, 255];
        glowColor = 'rgba(110,198,255,0.4)';
        alpha = 0.25 + Math.sin(time * 0.0015 + pt.glowPhase) * 0.12 + breath * 0.06;
      } else if (p < 0.4) {
        color = pt.glow ? [0, 229, 255] : [58, 123, 213];
        glowColor = 'rgba(0,229,255,0.5)';
        alpha = 0.2 + Math.sin(time * 0.002 + pt.glowPhase) * 0.15 + breath * 0.08;
      } else if (p < 0.65) {
        color = pt.glow ? [0, 229, 255] : [50, 80, 130];
        glowColor = 'rgba(0,229,255,0.25)';
        alpha = 0.1 + breath * 0.03;
      } else {
        color = pt.glow ? [255, 77, 77] : [0, 40, 60];
        glowColor = pt.glow ? 'rgba(255,77,77,0.2)' : 'rgba(0,229,255,0.05)';
        alpha = 0.04 + breath * 0.02;
      }

      const drawSize = pt.size * layerSizes[pt.layer];
      const drawAlpha = clamp(alpha * layerAlphas[pt.layer], 0, 1);

      ctx.save();
      if (pt.glow && p < 0.6) {
        const glowPulse = 0.6 + Math.sin(time * 0.0025 + pt.glowPhase) * 0.4;
        ctx.shadowBlur = (12 + glowPulse * 8) * layerSizes[pt.layer];
        ctx.shadowColor = glowColor;
      }
      ctx.globalAlpha = drawAlpha;
      ctx.fillStyle = rgb(color);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ═══════════════════════════════════════
     BIOLUMINESCENT ORGANISMS (TWILIGHT)
     ═══════════════════════════════════════ */
  const NUM_BIO = 15;
  const bioOrgs = [];
  for (let i = 0; i < NUM_BIO; i++) {
    bioOrgs.push({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      size: 2 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0006 + Math.random() * 0.0012,
      driftX: (Math.random() - 0.5) * 0.2,
      driftY: (Math.random() - 0.5) * 0.1,
      color: Math.random() > 0.25 ? COLORS.glow : (Math.random() > 0.5 ? [80, 200, 120] : [120, 100, 255]),
      trail: [],
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  function drawBioOrganisms(p, time) {
    const intensity = p > 0.18 && p < 0.55 ? 1 : (p <= 0.18 ? clamp((p - 0.1) / 0.08, 0, 1) : clamp((0.6 - p) / 0.05, 0, 1));
    if (intensity <= 0) return;
    const breath = getBreath(time);
    const curX = getCurrentX(time);
    const curY = getCurrentY(time);

    ctx.save();
    ctx.globalAlpha = intensity;
    for (const org of bioOrgs) {
      // Multi-frequency organic drift — never linear
      org.x += org.driftX + curX * 0.25
        + Math.sin(time * org.speed + org.phase) * 0.35
        + Math.sin(time * org.speed * 0.3 + org.pulsePhase) * 0.15;
      org.y += org.driftY + curY * 0.15
        + Math.cos(time * org.speed * 0.6 + org.phase) * 0.25
        + Math.cos(time * org.speed * 0.2 + org.pulsePhase) * 0.1;
      if (org.x < -80) org.x = W + 80;
      if (org.x > W + 80) org.x = -80;
      if (org.y < -80) org.y = H + 80;
      if (org.y > H + 80) org.y = -80;

      // Rich multi-sine glow pulse — "heartbeat" feel
      const pulse1 = Math.sin(time * org.speed * 1.5 + org.phase) * 0.5 + 0.5;
      const pulse2 = Math.sin(time * org.speed * 3.2 + org.pulsePhase) * 0.3 + 0.5;
      const pulse = pulse1 * 0.7 + pulse2 * 0.3 + breath * 0.15;
      const sz = org.size * (0.7 + pulse * 0.5);

      // Longer, softer trail
      org.trail.push({ x: org.x, y: org.y, p: pulse });
      if (org.trail.length > 14) org.trail.shift();
      for (let t = 0; t < org.trail.length; t++) {
        const tp = t / org.trail.length;
        ctx.globalAlpha = intensity * tp * 0.12 * org.trail[t].p;
        ctx.fillStyle = rgb(org.color);
        ctx.beginPath();
        ctx.arc(org.trail[t].x, org.trail[t].y, sz * tp * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core glow — breathing intensity
      ctx.globalAlpha = intensity * (0.25 + pulse * 0.55);
      ctx.shadowBlur = 18 + pulse * 22;
      ctx.shadowColor = rgb(org.color, 0.5 + pulse * 0.2);
      ctx.fillStyle = rgb(org.color);
      ctx.beginPath();
      ctx.arc(org.x, org.y, sz, 0, Math.PI * 2);
      ctx.fill();

      // Outer halo — large soft glow that breathes
      ctx.shadowBlur = 0;
      ctx.globalAlpha = intensity * pulse * 0.1;
      const haloR = sz * (5 + breath * 2);
      const halo = ctx.createRadialGradient(org.x, org.y, 0, org.x, org.y, haloR);
      halo.addColorStop(0, rgb(org.color, 0.35));
      halo.addColorStop(0.4, rgb(org.color, 0.1));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(org.x, org.y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     CREATURE SILHOUETTES (TWILIGHT/MIDNIGHT)
     ═══════════════════════════════════════ */
  const creatures = [
    { x: -200, y: 0.3, w: 180, h: 50, speed: 0.07, dir: 1, phase: 0, tailWag: 10 },
    { x: -400, y: 0.6, w: 130, h: 38, speed: 0.05, dir: 1, phase: 2, tailWag: 7 },
    { x: 2200, y: 0.45, w: 260, h: 72, speed: 0.035, dir: -1, phase: 4, tailWag: 14 },
  ];

  function drawCreatures(p, time) {
    const intensity = p > 0.2 && p < 0.7 ? clamp(Math.min((p - 0.2) / 0.1, (0.7 - p) / 0.1), 0, 0.25) : 0;
    if (intensity <= 0) return;
    const curX = getCurrentX(time);

    ctx.save();
    ctx.globalAlpha = intensity;
    for (const cr of creatures) {
      // Slow, drifting speed with current influence
      cr.x += (cr.speed + curX * 0.05) * cr.dir;
      if (cr.dir > 0 && cr.x > W + 400) cr.x = -cr.w - 300;
      if (cr.dir < 0 && cr.x < -cr.w - 300) cr.x = W + 400;

      // Body undulation — sinusoidal vertical motion
      const bodyUndulate = Math.sin(time * 0.0005 + cr.phase) * 25
        + Math.sin(time * 0.0003 + cr.phase * 1.3) * 10;
      const yy = cr.y * H + bodyUndulate;
      const tw = Math.sin(time * 0.002 + cr.phase) * cr.tailWag;

      // Slight body rotation from undulation
      const bodyTilt = Math.sin(time * 0.0005 + cr.phase) * 0.04 * cr.dir;
      ctx.save();
      ctx.translate(cr.x + cr.w * 0.4, yy);
      ctx.rotate(bodyTilt);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, cr.w * 0.45, cr.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dorsal fin
      const finWave = Math.sin(time * 0.0018 + cr.phase) * 4;
      ctx.beginPath();
      ctx.moveTo(-cr.w * 0.1, -cr.h * 0.35);
      ctx.quadraticCurveTo(cr.w * 0.05, -cr.h * 0.7 + finWave, cr.w * 0.2, -cr.h * 0.35);
      ctx.fill();

      // Tail with organic wag
      ctx.beginPath();
      ctx.moveTo(cr.w * 0.4, 0);
      ctx.quadraticCurveTo(cr.w * 0.55, tw * 0.6, cr.w * 0.7, -cr.h * 0.25 + tw);
      ctx.quadraticCurveTo(cr.w * 0.55, tw * 0.3, cr.w * 0.7, cr.h * 0.25 + tw);
      ctx.quadraticCurveTo(cr.w * 0.55, -tw * 0.4, cr.w * 0.4, 0);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     SPOTLIGHT / FLASHLIGHT (MIDNIGHT)
     ═══════════════════════════════════════ */
  function drawSpotlight(p, time) {
    const intensity = p > 0.45 && p < 0.85 ? clamp(Math.min((p - 0.45) / 0.08, (0.85 - p) / 0.08), 0, 1) : 0;
    if (intensity <= 0) return;
    const breath = getBreath(time);

    ctx.save();
    const cx = W * 0.35 + Math.sin(time * 0.00015) * 55 + getCurrentX(time) * 20;
    const cy = H * 0.4 + Math.cos(time * 0.00012) * 40 + getCurrentY(time) * 15;
    const r = Math.min(W, H) * (0.25 + breath * 0.06);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const ba = 0.03 + breath * 0.02;
    grad.addColorStop(0, `rgba(0,229,255,${ba * intensity})`);
    grad.addColorStop(0.3, `rgba(0,229,255,${ba * 0.4 * intensity})`);
    grad.addColorStop(0.6, `rgba(0,100,150,${ba * 0.12 * intensity})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'multiply';
    const vig = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, Math.max(W, H) * 0.8);
    vig.addColorStop(0, `rgba(8,15,25,${0.3 * intensity})`);
    vig.addColorStop(0.5, `rgba(2,4,10,${0.6 * intensity})`);
    vig.addColorStop(1, `rgba(0,0,0,${0.8 * intensity})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     GLOWING EYES (MIDNIGHT)
     ═══════════════════════════════════════ */
  const eyes = [
    { x: 0.82, y: 0.35, size: 3, phase: 0, color: COLORS.glow, blinkSpeed: 0.0004 },
    { x: 0.83, y: 0.355, size: 3, phase: 0.1, color: COLORS.glow, blinkSpeed: 0.0004 },
    { x: 0.12, y: 0.65, size: 2.5, phase: 3, color: COLORS.danger, blinkSpeed: 0.00035 },
    { x: 0.135, y: 0.655, size: 2.5, phase: 3.1, color: COLORS.danger, blinkSpeed: 0.00035 },
  ];

  function drawGlowingEyes(p, time) {
    const intensity = p > 0.5 && p < 0.8 ? clamp(Math.min((p - 0.5) / 0.05, (0.8 - p) / 0.05), 0, 1) : 0;
    if (intensity <= 0) return;
    const curX = getCurrentX(time);
    const curY = getCurrentY(time);

    ctx.save();
    for (const eye of eyes) {
      const blink = Math.sin(time * eye.blinkSpeed + eye.phase);
      const openness = blink > 0.7 ? (blink - 0.7) / 0.3 : 0;
      if (openness <= 0) continue;

      // Eyes drift subtly with current
      const ex = eye.x * W + Math.sin(time * 0.00012 + eye.phase) * 12 + curX * 5;
      const ey = eye.y * H + Math.cos(time * 0.0001 + eye.phase) * 8 + curY * 4;

      ctx.globalAlpha = intensity * openness * 0.7;
      ctx.shadowBlur = 10;
      ctx.shadowColor = rgb(eye.color, 0.5);
      ctx.fillStyle = rgb(eye.color);
      ctx.beginPath();
      ctx.arc(ex, ey, eye.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = intensity * openness * 0.15;
      const hg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 30);
      hg.addColorStop(0, rgb(eye.color, 0.45));
      hg.addColorStop(0.5, rgb(eye.color, 0.1));
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(ex, ey, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     LEVIATHAN SHADOW (ABYSS)
     ═══════════════════════════════════════ */
  let leviathanX = -600;
  const leviathanSpeed = 0.1;

  function drawLeviathan(p, time) {
    const intensity = p > 0.75 ? clamp((p - 0.75) / 0.1, 0, 1) * 0.15 : 0;
    if (intensity <= 0) { leviathanX = -600; return; }
    const breath = getBreathSlow(time);

    leviathanX += leviathanSpeed;
    if (leviathanX > W + 800) leviathanX = -800;

    // Body sways gently with current and breathing
    const ly = H * 0.55 + Math.sin(time * 0.00012) * 35 + getCurrentY(time) * 20;
    const bodyLen = 500;
    const bodyH = 120 + breath * 15;

    ctx.save();
    ctx.globalAlpha = intensity;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.ellipse(leviathanX, ly, bodyLen, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slow, heavy tail wag
    const tailWag = Math.sin(time * 0.001) * 20 + Math.sin(time * 0.0006) * 10;
    ctx.beginPath();
    ctx.moveTo(leviathanX + bodyLen * 0.8, ly);
    ctx.bezierCurveTo(
      leviathanX + bodyLen + 80, ly + tailWag,
      leviathanX + bodyLen + 120, ly - 50 + tailWag,
      leviathanX + bodyLen + 200, ly - 30 + tailWag * 1.5
    );
    ctx.bezierCurveTo(
      leviathanX + bodyLen + 120, ly + tailWag * 0.5,
      leviathanX + bodyLen + 80, ly + 50 + tailWag,
      leviathanX + bodyLen + 200, ly + 40 + tailWag * 1.5
    );
    ctx.lineTo(leviathanX + bodyLen * 0.8, ly);
    ctx.fill();

    // Faint red eye glow pulsing with breath
    const eyeGlow = 0.3 + breath * 0.4;
    ctx.globalAlpha = intensity * 2 * eyeGlow;
    ctx.shadowBlur = 10 + breath * 6;
    ctx.shadowColor = 'rgba(255,77,77,0.35)';
    ctx.fillStyle = 'rgba(255,77,77,0.5)';
    ctx.beginPath();
    ctx.arc(leviathanX - bodyLen * 0.6, ly - bodyH * 0.15, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ═══════════════════════════════════════
     FOG / ATMOSPHERIC HAZE
     ═══════════════════════════════════════ */
  const fogLayers = [
    { y: 0.25, speed: 0.06, alpha: 0.03, height: 0.22, phase: 0 },
    { y: 0.55, speed: -0.04, alpha: 0.025, height: 0.18, phase: 1.5 },
    { y: 0.78, speed: 0.03, alpha: 0.02, height: 0.28, phase: 3.2 },
  ];
  let fogOffsets = fogLayers.map(() => Math.random() * 2000);

  function drawFog(p, time) {
    const fogginess = clamp((p - 0.15) * 2, 0, 1);
    if (fogginess <= 0) return;
    const breath = getBreathSlow(time);
    const curX = getCurrentX(time);

    ctx.save();
    for (let i = 0; i < fogLayers.length; i++) {
      const fog = fogLayers[i];
      fogOffsets[i] += fog.speed + curX * 0.02;
      // Vertical breathing — fog rises & falls gently
      const breathOffset = Math.sin(time * 0.00008 + fog.phase) * 15;
      const y = fog.y * H + breathOffset;
      const h = fog.height * H * (0.9 + breath * 0.2);

      ctx.globalAlpha = fog.alpha * fogginess * (0.8 + breath * 0.4);
      const grad = ctx.createLinearGradient(0, y - h * 0.5, 0, y + h * 0.5);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.3, p < 0.5 ? 'rgba(200,220,255,0.4)' : 'rgba(80,100,120,0.3)');
      grad.addColorStop(0.5, p < 0.5 ? 'rgba(200,220,255,1)' : 'rgba(100,120,140,1)');
      grad.addColorStop(0.7, p < 0.5 ? 'rgba(200,220,255,0.4)' : 'rgba(80,100,120,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(fogOffsets[i] % W - W, y - h * 0.5, W * 2, h);
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     NOISE / GRAIN OVERLAY
     ═══════════════════════════════════════ */
  let noiseCanvas, noiseCtx;
  function createNoiseTexture() {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    noiseCtx = noiseCanvas.getContext('2d');
    const imgData = noiseCtx.createImageData(128, 128);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    noiseCtx.putImageData(imgData, 0, 0);
  }
  createNoiseTexture();

  let noiseFrame = 0;
  function drawNoise(p) {
    noiseFrame++;
    // Regenerate noise every 4 frames for subtle grain movement
    if (noiseFrame % 4 === 0) createNoiseTexture();
    const grainIntensity = 0.015 + p * 0.03;
    ctx.save();
    ctx.globalAlpha = grainIntensity;
    ctx.globalCompositeOperation = 'overlay';
    // Tile noise across canvas
    const pattern = ctx.createPattern(noiseCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     UNDERWATER DISTORTION (subtle waviness)
     ═══════════════════════════════════════ */
  function drawDistortion(p, time) {
    if (p > 0.7) return;
    const intensity = clamp(1 - p * 1.5, 0, 0.5);
    if (intensity <= 0) return;

    ctx.save();
    ctx.globalAlpha = intensity * 0.03;
    ctx.globalCompositeOperation = 'lighter';
    // Wavey horizontal bands
    for (let y = 0; y < H; y += 60) {
      const offset = Math.sin(time * 0.0003 + y * 0.01) * 3;
      const bandAlpha = 0.5 + Math.sin(time * 0.0005 + y * 0.02) * 0.5;
      ctx.globalAlpha = intensity * 0.02 * bandAlpha;
      ctx.fillStyle = 'rgba(110,198,255,1)';
      ctx.fillRect(offset, y, W, 1);
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     DEPTH VIGNETTE
     ═══════════════════════════════════════ */
  function drawVignette(p) {
    const strength = 0.3 + p * 0.5;
    ctx.save();
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.6, `rgba(0,0,0,${strength * 0.3})`);
    vig.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ═══════════════════════════════════════
     ABYSS FAINT GLOW PULSES
     ═══════════════════════════════════════ */
  function drawAbyssGlow(p, time) {
    if (p < 0.7) return;
    const intensity = clamp((p - 0.7) / 0.15, 0, 1);
    const breath = getBreath(time);
    const breathSlow = getBreathSlow(time);
    ctx.save();

    // Drifting red glow
    const rPulse = 0.4 + Math.sin(time * 0.00025) * 0.3 + breath * 0.3;
    const rx = W * (0.25 + Math.sin(time * 0.00008) * 0.08);
    const ry = H * (0.55 + Math.cos(time * 0.00006) * 0.06);
    ctx.globalAlpha = intensity * 0.03 * rPulse;
    const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, 280 + breathSlow * 60);
    rg.addColorStop(0, 'rgba(255,77,77,0.5)');
    rg.addColorStop(0.5, 'rgba(255,50,50,0.15)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // Drifting cyan glow
    const cPulse = 0.4 + Math.sin(time * 0.0002 + 2) * 0.3 + breathSlow * 0.3;
    const cx = W * (0.7 + Math.cos(time * 0.00009) * 0.06);
    const cy = H * (0.35 + Math.sin(time * 0.00007) * 0.05);
    ctx.globalAlpha = intensity * 0.025 * cPulse;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 230 + breath * 50);
    cg.addColorStop(0, 'rgba(0,229,255,0.4)');
    cg.addColorStop(0.5, 'rgba(0,180,220,0.1)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  /* ═══════════════════════════════════════
     CINEMATIC EVENT — THE ENCOUNTER
     A one-time event at the Midnight → Abyss boundary.
     Brief flicker, then a massive shadow crosses.
     ═══════════════════════════════════════ */
  let cineTriggered = false;
  let cineActive = false;
  let cineStartTime = 0;
  const CINE_DURATION = 12000; // total event duration in ms

  // Shadow entity state
  const shadowEntity = {
    x: -1400,
    baseY: 0.5,
    bodyLen: 600,
    bodyH: 160,
    speed: 0, // set on trigger
  };

  function triggerCinematicEvent(time) {
    cineTriggered = true;
    cineActive = true;
    cineStartTime = time;
    shadowEntity.x = -shadowEntity.bodyLen - 400;
    shadowEntity.baseY = 0.4 + Math.random() * 0.2;
    // Speed: cross the full screen in ~7 seconds at 60fps
    shadowEntity.speed = (W + shadowEntity.bodyLen * 2 + 800) / (7000 / 16.67);
  }

  function drawCinematicEvent(p, time) {
    // Check trigger
    if (!cineTriggered && p >= 0.63 && p <= 0.74) {
      triggerCinematicEvent(time);
    }
    if (!cineActive) return;

    const elapsed = time - cineStartTime;
    if (elapsed > CINE_DURATION) { cineActive = false; return; }

    const phase = elapsed / CINE_DURATION; // 0..1

    ctx.save();

    // ── PHASE 1: Flicker & static burst (0–15% of event) ──
    if (phase < 0.15) {
      const flickerT = phase / 0.15; // 0..1 within this phase
      // Rapid blackout flickers
      const flicker = Math.sin(elapsed * 0.05) * Math.sin(elapsed * 0.03);
      if (flicker > 0.3) {
        ctx.globalAlpha = 0.4 + flicker * 0.4;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      // Static noise burst — dense grain
      if (flickerT < 0.8) {
        ctx.globalAlpha = 0.08 * (1 - flickerT);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 60; i++) {
          const sx = Math.random() * W;
          const sy = Math.random() * H;
          const sw = 1 + Math.random() * 3;
          ctx.fillStyle = `rgba(${80 + Math.random() * 80},${100 + Math.random() * 60},${120 + Math.random() * 80},1)`;
          ctx.fillRect(sx, sy, sw, 1);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // ── PHASE 2: Shadow entity passes (10–85% of event) ──
    if (phase > 0.1 && phase < 0.85) {
      const shadowT = (phase - 0.1) / 0.75; // 0..1

      // Fade in/out the shadow
      let shadowAlpha;
      if (shadowT < 0.15) shadowAlpha = shadowT / 0.15;           // fade in
      else if (shadowT > 0.8) shadowAlpha = (1 - shadowT) / 0.2;  // fade out
      else shadowAlpha = 1;
      shadowAlpha *= 0.12; // always barely visible

      shadowEntity.x += shadowEntity.speed;

      const sy = shadowEntity.baseY * H
        + Math.sin(time * 0.00015) * 40
        + Math.sin(time * 0.00008) * 20; // slow undulation

      const bLen = shadowEntity.bodyLen;
      const bH = shadowEntity.bodyH + Math.sin(time * 0.0001) * 12;

      ctx.globalAlpha = shadowAlpha;

      // Body — elongated dark mass
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath();
      ctx.ellipse(shadowEntity.x, sy, bLen, bH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Secondary body segment (gives it organic length)
      ctx.beginPath();
      ctx.ellipse(shadowEntity.x + bLen * 0.6, sy + 8, bLen * 0.5, bH * 0.7, 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Head region
      ctx.beginPath();
      ctx.ellipse(shadowEntity.x - bLen * 0.7, sy - 5, bLen * 0.35, bH * 0.55, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Tail — heavy undulating wag
      const tailWag = Math.sin(time * 0.0008) * 35 + Math.sin(time * 0.0005) * 18;
      ctx.beginPath();
      ctx.moveTo(shadowEntity.x + bLen * 0.9, sy);
      ctx.bezierCurveTo(
        shadowEntity.x + bLen + 120, sy + tailWag * 0.5,
        shadowEntity.x + bLen + 200, sy - 60 + tailWag,
        shadowEntity.x + bLen + 320, sy - 40 + tailWag * 1.3
      );
      ctx.bezierCurveTo(
        shadowEntity.x + bLen + 200, sy + tailWag * 0.3,
        shadowEntity.x + bLen + 120, sy + 60 + tailWag,
        shadowEntity.x + bLen + 320, sy + 50 + tailWag * 1.3
      );
      ctx.lineTo(shadowEntity.x + bLen * 0.9, sy);
      ctx.fill();

      // Barely visible "eye" — single faint red point
      const eyeAlpha = shadowAlpha * 1.5 * (0.5 + Math.sin(time * 0.0006) * 0.5);
      ctx.globalAlpha = clamp(eyeAlpha, 0, 0.25);
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255,60,60,0.3)';
      ctx.fillStyle = 'rgba(255,60,60,0.6)';
      ctx.beginPath();
      ctx.arc(shadowEntity.x - bLen * 0.85, sy - bH * 0.18, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Displacement ripple around the entity — subtle lighter edge
      ctx.globalAlpha = shadowAlpha * 0.15;
      ctx.strokeStyle = 'rgba(0,229,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(shadowEntity.x, sy, bLen + 20, bH + 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── PHASE 3: Lingering unease (75–100%) — slightly darker environment ──
    if (phase > 0.75) {
      const uneaseT = (phase - 0.75) / 0.25;
      const uneaseAlpha = (1 - uneaseT) * 0.08; // fades to 0
      ctx.globalAlpha = uneaseAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }


  /* ═══════════════════════════════════════
     LIVE FISH SYSTEM
     ═══════════════════════════════════════ */

  // Fish color schemes per zone
  const FISH_ZONES = {
    tropical: {
      zStart: 0.00, zEnd: 0.30, fade: 0.06,
      colors: [['#FF6B35', '#FFD700'], ['#00CED1', '#48D1CC'], ['#FF4500', '#FF6347'],
      ['#7B68EE', '#00BFFF'], ['#32CD32', '#00FA9A'], ['#FF69B4', '#FF1493']]
    },
    deep: {
      zStart: 0.22, zEnd: 0.58, fade: 0.06,
      colors: [['rgba(0,229,255,0.85)', 'rgba(0,180,200,0.6)'],
      ['rgba(140,80,255,0.8)', 'rgba(80,40,200,0.5)'],
      ['rgba(80,200,255,0.8)', 'rgba(30,140,200,0.5)']]
    },
    ghost: {
      zStart: 0.48, zEnd: 0.78, fade: 0.06,
      colors: [['rgba(180,220,255,0.45)', 'rgba(120,160,200,0.25)'],
      ['rgba(200,200,255,0.35)', 'rgba(140,140,220,0.2)']]
    },
    abyss: {
      zStart: 0.72, zEnd: 1.00, fade: 0.06,
      colors: [['rgba(80,0,0,0.55)', 'rgba(30,0,0,0.35)'],
      ['rgba(0,40,40,0.5)', 'rgba(0,20,30,0.3)']]
    },
  };

  function fishZoneAlpha(type, p) {
    const z = FISH_ZONES[type];
    if (p < z.zStart || p > z.zEnd) return 0;
    const fadeIn = clamp((p - z.zStart) / z.fade, 0, 1);
    const fadeOut = clamp((z.zEnd - p) / z.fade, 0, 1);
    return Math.min(fadeIn, fadeOut);
  }

  class Fish {
    constructor(type, idx) {
      this.type = type;
      const z = FISH_ZONES[type];
      this.c1 = z.colors[idx % z.colors.length][0];
      this.c2 = z.colors[idx % z.colors.length][1];

      // Body size
      const sizeMap = { tropical: [22, 10], deep: [32, 11], ghost: [38, 13], abyss: [42, 15] };
      const [bwBase, bhBase] = sizeMap[type];
      this.bw = bwBase + Math.random() * bwBase * 0.8;
      this.bh = bhBase + Math.random() * bhBase * 0.7;

      this.dir = Math.random() > 0.5 ? 1 : -1;
      this.speed = 0.35 + Math.random() * 0.85;
      if (type === 'ghost') this.speed *= 0.55;

      this.phase = Math.random() * Math.PI * 2;
      this.waveFreq = 0.0012 + Math.random() * 0.0018;
      this.waveAmp = 15 + Math.random() * 22;
      this.tailFreq = 0.0038 + Math.random() * 0.004;
      this.tailPhase = Math.random() * Math.PI * 2;

      this.hasLure = type === 'abyss' && Math.random() > 0.45;
      this.lurePhase = Math.random() * Math.PI * 2;

      this.reset(true);
    }

    reset(initial) {
      this.baseY = 60 + Math.random() * (H - 120);
      this.y = this.baseY;
      if (initial) {
        this.x = Math.random() * W;
      } else {
        this.x = this.dir > 0 ? -this.bw - 80 : W + this.bw + 80;
        this.baseY = 60 + Math.random() * (H - 120);
      }
    }

    update(time, cx, cy) {
      this.x += this.speed * this.dir + cx * 0.25;
      this.y = this.baseY
        + Math.sin(time * this.waveFreq + this.phase) * this.waveAmp
        + cy * 6;

      const margin = this.bw + 120;
      if (this.dir > 0 && this.x > W + margin) this.reset(false);
      if (this.dir < 0 && this.x < -margin) this.reset(false);
    }

    draw(time, alpha) {
      if (alpha <= 0.015) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.dir < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = alpha;

      const tw = Math.sin(time * this.tailFreq + this.tailPhase) * this.bw * 0.26;

      // Body
      const bg2 = ctx.createLinearGradient(-this.bw * 0.4, -this.bh, -this.bw * 0.4, this.bh);
      bg2.addColorStop(0, this.c1);
      bg2.addColorStop(0.5, this.c2);
      bg2.addColorStop(1, this.c1);
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.ellipse(-this.bw * 0.05, 0, this.bw * 0.5, this.bh * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stripe (tropical only)
      if (this.type === 'tropical') {
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-this.bw * 0.05, 0, this.bw * 0.16, this.bh * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Glow (deep / ghost)
      if (this.type === 'deep' || this.type === 'ghost') {
        ctx.save();
        ctx.shadowBlur = 10 + Math.sin(time * 0.003 + this.phase) * 5;
        ctx.shadowColor = this.c1;
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = this.c1;
        ctx.beginPath();
        ctx.ellipse(-this.bw * 0.05, 0, this.bw * 0.32, this.bh * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Tail
      ctx.globalAlpha = alpha * 0.82;
      ctx.fillStyle = this.c1;
      ctx.beginPath();
      ctx.moveTo(this.bw * 0.40, 0);
      ctx.quadraticCurveTo(this.bw * 0.58, tw * 0.55, this.bw * 0.80, -this.bh * 0.78 + tw);
      ctx.quadraticCurveTo(this.bw * 0.58, tw * 0.28, this.bw * 0.80, this.bh * 0.78 + tw);
      ctx.quadraticCurveTo(this.bw * 0.58, -tw * 0.38, this.bw * 0.40, 0);
      ctx.fill();

      // Dorsal fin
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = this.c2;
      ctx.beginPath();
      ctx.moveTo(-this.bw * 0.18, -this.bh * 0.82);
      ctx.quadraticCurveTo(this.bw * 0.06, -this.bh * 1.55 + Math.sin(time * 0.003 + this.phase) * 3, this.bw * 0.24, -this.bh * 0.82);
      ctx.closePath();
      ctx.fill();

      // Pectoral fin
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.ellipse(-this.bw * 0.04, this.bh * 0.38, this.bw * 0.16, this.bh * 0.32, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.type === 'abyss' ? 'rgba(255,60,60,0.95)' :
        this.type === 'ghost' ? 'rgba(200,230,255,0.8)' : '#fff';
      ctx.beginPath();
      ctx.arc(-this.bw * 0.34, -this.bh * 0.14, this.bh * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.type === 'abyss' ? 'rgba(200,0,0,0.9)' : 'rgba(0,0,0,0.88)';
      ctx.beginPath();
      ctx.arc(-this.bw * 0.34 + 0.5, -this.bh * 0.14, this.bh * 0.13, 0, Math.PI * 2);
      ctx.fill();

      // Anglerfish lure
      if (this.hasLure) {
        const lp = 0.5 + Math.sin(time * 0.0045 + this.lurePhase) * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha * lp;
        ctx.strokeStyle = 'rgba(0,220,255,0.5)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 12 + lp * 8;
        ctx.shadowColor = 'rgba(0,229,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(-this.bw * 0.28, -this.bh * 0.82);
        ctx.quadraticCurveTo(-this.bw * 0.42, -this.bh * 1.45, -this.bw * 0.52, -this.bh * 1.82);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,229,255,0.95)';
        ctx.beginPath();
        ctx.arc(-this.bw * 0.52, -this.bh * 1.82, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // Spawn fish pools
  const FISH_POOLS = {
    tropical: Array.from({ length: 16 }, (_, i) => new Fish('tropical', i)),
    deep: Array.from({ length: 10 }, (_, i) => new Fish('deep', i)),
    ghost: Array.from({ length: 7 }, (_, i) => new Fish('ghost', i)),
    abyss: Array.from({ length: 5 }, (_, i) => new Fish('abyss', i)),
  };

  function drawFish(p, time) {
    const cx = getCurrentX(time);
    const cy = getCurrentY(time);
    for (const [type, pool] of Object.entries(FISH_POOLS)) {
      const alpha = fishZoneAlpha(type, p);
      if (alpha <= 0.015) continue;
      for (const fish of pool) {
        fish.update(time, cx, cy);
        fish.draw(time, alpha);
      }
    }
  }

  /* ═══════════════════════════════════════
     MAIN RENDER LOOP — 3-LAYER COMPOSITION
     Background (blurred, slowest) → Mid → Foreground (sharpest, fastest)
     ═══════════════════════════════════════ */
  function render(time) {
    const p = scrollProgress;
    const cam = getCameraDrift(time);

    // Layer parallax multipliers: bg = slowest, fg = fastest
    const BG_MUL = 0.3;
    const MID_MUL = 0.65;
    const FG_MUL = 1.0;

    // Depth blur amount: increases with depth
    const depthBlur = clamp(p * 2.5, 0, 3);

    /* ─── LAYER 1: BACKGROUND (blurred, slow parallax) ─── */
    // Render to offscreen canvas, then draw blurred onto main
    bgCtx.clearRect(0, 0, W, H);
    // Swap context temporarily
    const mainCtx = ctx;
    ctx = bgCtx;

    ctx.save();
    ctx.translate(cam.x * BG_MUL, cam.y * BG_MUL);
    ctx.rotate(cam.rot * BG_MUL);

    drawBackground(p);
    drawDistortion(p, time);
    drawCreatures(p, time);
    drawLeviathan(p, time);
    drawGlowingEyes(p, time);

    ctx.restore();

    // Restore main context and composite bg layer with depth blur
    ctx = mainCtx;
    ctx.save();
    if (depthBlur > 0.2) {
      ctx.filter = `blur(${depthBlur.toFixed(1)}px)`;
    }
    ctx.drawImage(bgLayer, 0, 0);
    ctx.filter = 'none';
    ctx.restore();

    /* ─── LAYER 2: MID LAYER (atmosphere, light, fog — slight blur) ─── */
    ctx.save();
    ctx.translate(cam.x * MID_MUL, cam.y * MID_MUL);
    ctx.rotate(cam.rot * MID_MUL);

    if (depthBlur > 1) {
      ctx.filter = `blur(${(depthBlur * 0.3).toFixed(1)}px)`;
    }

    drawLightRays(p, time);
    drawCaustics(p, time);
    drawFog(p, time);
    drawSpotlight(p, time);
    drawAbyssGlow(p, time);

    ctx.filter = 'none';
    ctx.restore();

    /* ─── LAYER 3: FOREGROUND (sharp, fastest parallax) ─── */
    ctx.save();
    ctx.translate(cam.x * FG_MUL, cam.y * FG_MUL);
    ctx.rotate(cam.rot * FG_MUL);

    drawFish(p, time);
    drawBioOrganisms(p, time);
    drawParticles(p, time);
    drawBubbles(p, time);

    ctx.restore();

    /* ─── POST-PROCESSING (no camera offset) ─── */
    drawCinematicEvent(p, time);
    drawVignette(p);
    drawNoise(p);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();