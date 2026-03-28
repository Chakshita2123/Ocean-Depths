/* ===== DEEP DIVE PROTOCOL — INTERACTIVE ENGINE ===== */
(function () {
  'use strict';

  // ===== CONFIG =====
  const ZONES = [
    { id: 'section-mission', depth: 0, oxygen: 100, status: 'Ready', pressure: 'Normal', zone: 'mission' },
    { id: 'section-sunlight', depth: 120, oxygen: 92, status: 'Descending', pressure: 'Stable', zone: 'sunlight' },
    { id: 'section-twilight', depth: 640, oxygen: 75, status: 'Descending', pressure: 'Increasing', zone: 'twilight' },
    { id: 'section-midnight', depth: 2400, oxygen: 48, status: 'WARNING', pressure: 'Critical', zone: 'midnight' },
    { id: 'section-abyss', depth: 11000, oxygen: 12, status: 'CRITICAL', pressure: 'Extreme', zone: 'abyss' },
    { id: 'section-ending', depth: 11000, oxygen: 0, status: 'SYSTEM FAILURE', pressure: '---', zone: 'ending' },
  ];

  const AMBIENT_WORDS = ['Silence...', 'Darkness...', 'Pressure...', 'Depth...', 'Unknown...'];

  const MICRO_STORIES = [
    { threshold: 0.15, text: 'Depth increasing beyond safe limits...' },
    { threshold: 0.35, text: 'No communication from surface...' },
    { threshold: 0.55, text: 'Signal weakening...' },
    { threshold: 0.75, text: 'Signal lost.' },
    { threshold: 0.92, text: '...' },
  ];

  const LOG_MESSAGES = {
    mission: ['Mission log initiated.', 'All systems operational.', 'Awaiting pilot confirmation.'],
    sunlight: ['Entering Sunlight Zone.', 'Marine life detected.', 'All vitals normal.', 'Exploration mode active.'],
    twilight: ['Light levels dropping.', 'Bioluminescent organisms detected.', 'Unidentified movement nearby.', 'Caution advised.'],
    midnight: ['⚠ Pressure exceeding safe limits.', '⚠ Signal weakening.', '⚠ Hull stress detected.', '⚠ Manual control recommended.'],
    abyss: ['🔴 CRITICAL ERROR.', '🔴 Life support failing.', '🔴 Unknown signal detected.', '🔴 Abort recommended.'],
    ending: ['CONNECTION TERMINATED.', 'SYSTEM OFFLINE.'],
  };

  // ===== STATE =====
  let currentZoneIndex = 0;
  let lastLoggedZone = '';
  let particlesArr = [];
  let raf;
  let loaded = false;
  let cinematicTriggered = false;

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {};
  function cacheDom() {
    els.loadingScreen = $('#loading-screen');
    els.ambientText = $('#ambient-text');
    els.hudStatus = $('#hud-status');
    els.hudDepth = $('#hud-depth');
    els.hudOxygen = $('#hud-oxygen');
    els.hudPressure = $('#hud-pressure');
    els.hudLog = $('#hud-log');
    els.hudStory = $('#hud-story');
    els.depthBarFill = $('#depth-bar-fill');
    els.oxygenRingFill = $('#oxygen-ring-fill');
    els.oxygenRingLabel = $('#oxygen-ring-label');
    els.btnBegin = $('#btn-begin');
    els.sections = $$('.dive-section');
    els.sectionInners = $$('.section-inner');
    els.parallaxLayers = $$('.parallax-layer');
    els.hudBlocks = $$('.hud-block');
    els.hudStatusBlock = $('#hud-status-block');
    els.hudDepthBlock = $('#hud-depth-block');
    els.hudOxygenBlock = $('#hud-oxygen-block');
    els.hudPressureBlock = $('#hud-pressure-block');
    els.hudMessagesBlock = $('#hud-messages-block');
  }

  // ===== LOADING =====
  function hideLoading() {
    setTimeout(() => {
      els.loadingScreen.classList.add('hidden');
      loaded = true;
      initSectionObserver();
      animateLogLines();
    }, 2800);
  }

  // ===== PARTICLE ENGINE (now handled by background.js) =====
  function resizeCanvas() { }
  function initParticles() { }
  function animateParticles() { }

  // ===== SCROLL PROGRESS =====
  function getScrollProgress() {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    return docH > 0 ? Math.min(1, scrollTop / docH) : 0;
  }

  function getCurrentZone(progress) {
    const idx = Math.min(ZONES.length - 1, Math.floor(progress * ZONES.length));
    return idx;
  }

  // ===== INTERPOLATION =====
  function lerp(a, b, t) { return a + (b - a) * t; }

  function getCurrentZoneName(progress) {
    const idx = getCurrentZone(progress);
    return ZONES[idx].zone;
  }

  // ===== HUD UPDATES =====
  function updateHUD(progress) {
    const zoneIdx = getCurrentZone(progress);
    const zone = ZONES[zoneIdx];
    const nextZone = ZONES[Math.min(zoneIdx + 1, ZONES.length - 1)];

    // Local progress within current zone
    const zoneStart = zoneIdx / ZONES.length;
    const zoneEnd = (zoneIdx + 1) / ZONES.length;
    const localProgress = zoneEnd > zoneStart ? (progress - zoneStart) / (zoneEnd - zoneStart) : 0;
    const clampedLocal = Math.max(0, Math.min(1, localProgress));

    // Interpolated values
    const depth = Math.round(lerp(zone.depth, nextZone.depth, clampedLocal));
    const oxygen = Math.round(lerp(zone.oxygen, nextZone.oxygen, clampedLocal));

    // Update DOM
    els.hudDepth.innerHTML = `${depth}<span class="hud-unit">m</span>`;
    els.hudOxygen.innerHTML = `${oxygen}<span class="hud-unit">%</span>`;
    els.hudStatus.textContent = zone.status;
    els.hudPressure.textContent = zone.pressure;

    // Depth bar
    const depthPercent = (depth / 11000) * 100;
    els.depthBarFill.style.width = `${depthPercent}%`;

    // Oxygen ring (263.9 = full circumference)
    const oxygenOffset = 263.9 * (1 - oxygen / 100);
    els.oxygenRingFill.style.strokeDashoffset = oxygenOffset;

    // Color transitions
    if (oxygen < 30) {
      els.oxygenRingFill.style.stroke = '#FF4D4D';
      els.hudOxygen.style.color = '#FF4D4D';
    } else if (oxygen < 60) {
      els.oxygenRingFill.style.stroke = '#FFCA28';
      els.hudOxygen.style.color = '#FFCA28';
    } else {
      els.oxygenRingFill.style.stroke = '#00E5FF';
      els.hudOxygen.style.color = '#fff';
    }

    // HUD block states
    updateHudBlockState(els.hudStatusBlock, zone.zone);
    updateHudBlockState(els.hudDepthBlock, zone.zone);
    updateHudBlockState(els.hudOxygenBlock, zone.zone);
    updateHudBlockState(els.hudPressureBlock, zone.zone);
    updateHudBlockState(els.hudMessagesBlock, zone.zone);

    // Status color
    if (zone.zone === 'abyss' || zone.zone === 'ending') {
      els.hudStatus.style.color = '#FF4D4D';
    } else if (zone.zone === 'midnight') {
      els.hudStatus.style.color = '#FFCA28';
    } else {
      els.hudStatus.style.color = '#fff';
    }

    // Pressure color
    if (zone.zone === 'midnight' || zone.zone === 'abyss') {
      els.hudPressure.style.color = '#FF4D4D';
    } else if (zone.zone === 'twilight') {
      els.hudPressure.style.color = '#FFCA28';
    } else {
      els.hudPressure.style.color = '#fff';
    }

    // Log messages per zone
    if (zone.zone !== lastLoggedZone) {
      lastLoggedZone = zone.zone;
      addLogMessages(zone.zone);
    }

    // Micro story
    updateMicroStory(progress);

    // Ambient text
    updateAmbientText(progress);

    // Body effects
    if (progress > 0.3) document.body.classList.add('scanlines');
    else document.body.classList.remove('scanlines');

    if (progress > 0.2) document.body.classList.add('vignette');
    else document.body.classList.remove('vignette');

    // Progressive depth blur
    const blurVal = Math.min(2.5, progress * 3.5);
    document.documentElement.style.setProperty('--depth-blur', `${blurVal}px`);

    // Cinematic moment check
    checkCinematicMoment(progress);


    // === CORNER HUD UPDATE ===
    const statusNew = document.getElementById('hud-status-new');
    const depthNew = document.getElementById('hud-depth-new');
    const oxygenNew = document.getElementById('hud-oxygen-new');
    const oxygenBarNew = document.getElementById('oxygen-bar-new');
    const rulerDot = document.getElementById('ruler-dot');
    const warningBar = document.getElementById('warning-bar');
    const scrollHint = document.getElementById('scroll-hint-text');

    if (statusNew) {
      statusNew.textContent = zone.status;
      statusNew.style.color = zone.zone === 'abyss' || zone.zone === 'ending' ? '#FF4D4D'
        : zone.zone === 'midnight' ? '#FFCA28' : '#fff';
    }
    if (depthNew) depthNew.innerHTML = `${depth}<span class="hud-corner-unit">m</span>`;
    if (oxygenNew) {
      oxygenNew.innerHTML = `${oxygen}<span class="hud-corner-unit">%</span>`;
      oxygenNew.style.color = oxygen < 30 ? '#FF4D4D' : oxygen < 60 ? '#FFCA28' : '#fff';
    }
    if (oxygenBarNew) {
      oxygenBarNew.style.width = `${oxygen}%`;
      oxygenBarNew.style.background = oxygen < 30 ? '#FF4D4D' : oxygen < 60 ? '#FFCA28' : '#00E5FF';
    }
    if (rulerDot) rulerDot.style.top = `${(depth / 11000) * 100}%`;
    if (warningBar) {
      warningBar.classList.toggle('show', zone.zone === 'midnight' || zone.zone === 'abyss');
      if (zone.zone === 'abyss') warningBar.textContent = '⚠  CRITICAL — LIFE SUPPORT FAILING';
      else warningBar.textContent = '⚠  WARNING: EXTREME PRESSURE';
    }
    if (scrollHint && progress > 0.95) scrollHint.style.opacity = '0';

    if (progress > 0.9) {
      triggerJumpscare();
    }
    if (zone.zone === "midnight" || zone.zone === "abyss") {
      applyCameraShake();
    }
    if (oxygen < 30) {
      document.body.classList.add("critical");
    } else {
      document.body.classList.remove("critical");
    }
  }

  function updateHudBlockState(block, zone) {
    block.classList.remove('warning', 'danger', 'critical');
    if (zone === 'twilight') block.classList.add('warning');
    else if (zone === 'midnight') block.classList.add('danger');
    else if (zone === 'abyss' || zone === 'ending') block.classList.add('critical');
  }

  function addLogMessages(zone) {
    const messages = LOG_MESSAGES[zone] || [];
    messages.forEach((msg, i) => {
      setTimeout(() => {
        const line = document.createElement('p');
        line.className = 'hud-log-line';
        line.textContent = `> ${msg}`;
        els.hudLog.appendChild(line);
        // Auto scroll
        els.hudLog.scrollTop = els.hudLog.scrollHeight;
      }, i * 600);
    });
  }

  function updateMicroStory(progress) {
    let storyText = '';
    for (const s of MICRO_STORIES) {
      if (progress >= s.threshold) storyText = s.text;
    }
    if (els.hudStory.textContent !== storyText) {
      els.hudStory.style.opacity = '0';
      setTimeout(() => {
        els.hudStory.textContent = storyText;
        els.hudStory.style.opacity = '1';
      }, 300);
    }
  }

  function updateAmbientText(progress) {
    const idx = Math.min(
      AMBIENT_WORDS.length - 1,
      Math.floor(progress * AMBIENT_WORDS.length)
    );
    const word = AMBIENT_WORDS[idx];
    if (els.ambientText.textContent !== word) {
      els.ambientText.textContent = word;
    }
    els.ambientText.style.opacity = progress > 0.25 ? '1' : '0';
  }

  // Water movement on photo backgrounds
  function updateWaterEffect() {
    const now = Date.now();
    const scrollY = window.scrollY;
    const photoBgs = document.querySelectorAll('.zone-photo-bg');
    photoBgs.forEach((bg, i) => {
      const waveX = Math.sin(now * 0.0018 + i * 1.5) * 25;
      const waveY = Math.cos(now * 0.0014 + i * 0.9) * 30 + scrollY * 0.07;
      const brightness = 1 + Math.sin(now * 0.0025 + i) * 0.15;
      const saturate = 1 + Math.cos(now * 0.002 + i) * 0.18;
      const scale = 1.08 + Math.sin(now * 0.0016 + i) * 0.05;
      bg.style.transform = `scale(${scale}) translate(${waveX}px, ${waveY}px)`;
      bg.style.filter = `brightness(${brightness}) saturate(${saturate})`;
      bg.style.transition = 'transform 0.1s ease-out, filter 0.1s ease-out';
    });
  }

  // ===== PARALLAX =====
  function updateParallax() {
    const scrollY = window.scrollY;
    els.parallaxLayers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed) || 0.05;
      layer.style.transform = `translateY(${scrollY * speed}px)`;
    });
  }

  // ===== SECTION OBSERVER =====
  function initSectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            triggerSectionAnimations(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    els.sectionInners.forEach((inner) => observer.observe(inner));

    // Ending lines
    const endingObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const lines = entry.target.querySelectorAll('.ending-line');
            lines.forEach((line, i) => {
              setTimeout(() => line.classList.add('show'), i * 1000);
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    const endingBlocks = $$('.ending-block');
    endingBlocks.forEach((block) => endingObserver.observe(block));
  }

  function triggerSectionAnimations(sectionInner) {
    const sysMessages = sectionInner.querySelectorAll('.sys-msg');
    sysMessages.forEach((msg) => {
      const delay = parseInt(msg.dataset.delay) || 0;
      setTimeout(() => msg.classList.add('show'), delay);
    });

    const logLines = sectionInner.querySelectorAll('.log-line');
    logLines.forEach((line) => {
      const delay = parseInt(line.dataset.delay) || 0;
      setTimeout(() => { line.style.animationDelay = '0s'; }, delay);
    });

    // Glitch on hero title
    const glitch = sectionInner.querySelector('.glitch-text');
    if (glitch) {
      glitch.setAttribute('data-text', glitch.textContent);
      setTimeout(() => {
        glitch.classList.add('active');
        setTimeout(() => glitch.classList.remove('active'), 400);
      }, 500);
    }
  }

  // ===== LOG LINES INITIAL =====
  function animateLogLines() {
    const logLines = document.querySelectorAll('#section-mission .log-line');
    logLines.forEach((line, i) => {
      const delay = parseInt(line.dataset.delay) || 0;
      line.style.animationDelay = `${delay}ms`;
    });
  }

  // ===== BEGIN DESCENT =====
  function onBeginDescent() {
    const sunlightSection = document.getElementById('section-sunlight');
    if (sunlightSection) {
      sunlightSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ===== INTERACT BUTTONS =====
  function initInteractButtons() {
    const SCAN_DATA = {
      sunlight: {
        scanning: '◉ Scanning...',
        done: '✓ Scan Complete',
        logs: [
          '> Bio-scan initiated...',
          '> 847 species detected in range.',
          '> Coral reef at 18m depth.',
          '> Water temp: 24°C — optimal.',
          '> Life density: EXTREME ✓',
        ],
      },
      twilight: {
        scanning: '◉ Analyzing...',
        done: '✓ Analysis Complete',
        logs: [
          '> Organism analysis started...',
          '> Bioluminescent class: Dinoflagellate.',
          '> Light output: 480nm wavelength.',
          '> Threat level: NONE.',
          '> Camouflage pattern logged.',
        ],
      },
      midnight: {
        scanning: '◉ Tracking...',
        done: '⚠ Signal Lost',
        logs: [
          '> Motion tracking engaged...',
          '> ⚠ Unidentified mass: 4.2m estimate.',
          '> ⚠ Moving toward vessel.',
          '> ⚠ Hull sensors triggered.',
          '> ABORT TRACKING — signal corrupted.',
        ],
      },
    };

    const btns = document.querySelectorAll('.interact-btn');
    const zoneMap = ['sunlight', 'twilight', 'midnight'];

    btns.forEach((btn, i) => {
      const zoneKey = zoneMap[i] || 'sunlight';
      const data = SCAN_DATA[zoneKey];

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const original = btn.innerHTML;
        btn.innerHTML = `<span class="scan-icon">◉</span> ${data.scanning}`;
        btn.disabled = true;

        const hudLog = document.getElementById('hud-log');

        data.logs.forEach((msg, idx) => {
          setTimeout(() => {
            const line = document.createElement('p');
            line.className = 'hud-log-line';
            line.textContent = msg;
            if (msg.includes('⚠') || msg.includes('ABORT')) {
              line.style.color = '#FF4D4D';
            } else if (msg.includes('✓')) {
              line.style.color = '#4CAF50';
            }
            hudLog.appendChild(line);
            hudLog.scrollTop = hudLog.scrollHeight;
          }, idx * 500);
        });

        setTimeout(() => {
          btn.innerHTML = `<span class="scan-icon">${data.done.includes('⚠') ? '⚠' : '✓'}</span> ${data.done}`;
          btn.style.borderColor = data.done.includes('⚠') ? 'rgba(255,77,77,.5)' : 'rgba(76,175,80,.5)';
          setTimeout(() => {
            btn.innerHTML = original;
            btn.disabled = false;
            btn.style.borderColor = '';
          }, 2500);
        }, data.logs.length * 500 + 300);
      });
    });
  }

  // ===== SCROLL HANDLER =====
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        const progress = getScrollProgress();
        updateHUD(progress);
        updateParallax();
        updateWaterEffect();
        ticking = false;
      });
      ticking = true;
    }
  }

  // ===== CINEMATIC MOMENT =====
  function checkCinematicMoment(progress) {
    if (!cinematicTriggered && progress >= 0.62 && progress <= 0.73) {
      cinematicTriggered = true;
      triggerCinematicMoment();
    }
  }

  function triggerCinematicMoment() {
    const overlay = document.getElementById('cinematic-overlay');
    if (!overlay) return;
    overlay.classList.add('flash');
    // Subtle screen shake
    const app = document.getElementById('app');
    app.style.transition = 'none';
    app.style.transform = 'translateX(-2px)';
    setTimeout(() => { app.style.transform = 'translateX(3px)'; }, 60);
    setTimeout(() => { app.style.transform = 'translateX(-1px) translateY(1px)'; }, 120);
    setTimeout(() => { app.style.transform = ''; app.style.transition = ''; }, 200);
    // HUD anomaly message
    setTimeout(() => {
      const line = document.createElement('p');
      line.className = 'hud-log-line';
      line.textContent = '> \u26A0 ANOMALY DETECTED';
      line.style.color = '#FF4D4D';
      els.hudLog.appendChild(line);
      els.hudLog.scrollTop = els.hudLog.scrollHeight;
    }, 600);
    setTimeout(() => { overlay.classList.remove('flash'); }, 2500);
  }

  // ===== INIT =====
  function init() {
    cacheDom();
    resizeCanvas();
    initParticles();
    animateParticles();
    hideLoading();
    initInteractButtons();

    els.btnBegin.addEventListener('click', onBeginDescent);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      resizeCanvas();
      initParticles();
    });

    // Initial HUD
    updateHUD(0);


    // ===== WATER SOUND =====
    const waterSound = document.getElementById('water-sound');
    const soundToggle = document.getElementById('sound-toggle');
    let soundOn = false;

    if (soundToggle && waterSound) {
      waterSound.volume = 0.6;
      soundToggle.addEventListener('click', () => {
        soundOn = !soundOn;
        if (soundOn) {
          waterSound.play().catch(() => { });
          soundToggle.textContent = '🔊 SOUND';
          soundToggle.style.background = 'rgba(0,229,255,0.2)';
        } else {
          waterSound.pause();
          soundToggle.textContent = '🔇 SOUND';
          soundToggle.style.background = 'rgba(0,229,255,0.1)';
        }
      });

      // Auto volume fade based on depth
      window.addEventListener('scroll', () => {
        if (soundOn && waterSound) {
          const p = getScrollProgress();
          waterSound.volume = Math.max(0.05, 0.35 - p * 0.3);
        }
      });
    }

    function waterLoop() {
      updateWaterEffect();
      requestAnimationFrame(waterLoop);
    }
    waterLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Mobile HUD toggle
  const hudToggle = document.getElementById('hud-toggle');
  const hudPanel = document.getElementById('hud-panel');
  if (hudToggle && hudPanel) {
    hudToggle.addEventListener('click', () => {
      hudPanel.classList.toggle('open');
      hudToggle.textContent = hudPanel.classList.contains('open') ? 'HUD ▼' : 'HUD ▲';
    });
  }
})();

let jumpscareTriggered = false;

function triggerJumpscare() {
  if (jumpscareTriggered) return;
  jumpscareTriggered = true;

  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.inset = "0";
  flash.style.background = "rgba(255,255,255,0.08)";
  flash.style.zIndex = "9999";
  flash.style.pointerEvents = "none";
  flash.style.animation = "flashAnim 0.4s ease";

  document.body.appendChild(flash);

  // 👁️ Eye element
  const eye = document.createElement("div");
  eye.innerHTML = "👁️";
  eye.style.position = "fixed";
  eye.style.top = "50%";
  eye.style.left = "50%";
  eye.style.transform = "translate(-50%, -50%) scale(0.5)";
  eye.style.fontSize = "120px";
  eye.style.opacity = "0";
  eye.style.zIndex = "10000";
  eye.style.transition = "all 0.3s ease";

  document.body.appendChild(eye);

  setTimeout(() => {
    eye.style.opacity = "1";
    eye.style.transform = "translate(-50%, -50%) scale(1)";
  }, 50);

  setTimeout(() => {
    eye.style.opacity = "0";
    flash.remove();
    eye.remove();
  }, 500);
}

function applyCameraShake() {
  const app = document.getElementById("app");

  const x = (Math.random() - 0.5) * 3;
  const y = (Math.random() - 0.5) * 3;

  app.style.transform = `translate(${x}px, ${y}px)`;

  setTimeout(() => {
    app.style.transform = "translate(0,0)";
  }, 50);
}
document.querySelectorAll(".interact-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const pulse = document.createElement("div");

    pulse.style.position = "fixed";
    pulse.style.inset = "0";
    pulse.style.border = "2px solid cyan";
    pulse.style.borderRadius = "50%";
    pulse.style.animation = "scan 1s ease-out";
    pulse.style.zIndex = "9999";

    document.body.appendChild(pulse);

    setTimeout(() => pulse.remove(), 1000);
  });
});

const isMobile = window.innerWidth < 768;

if (isMobile) {
  // reduce particles
  MAX_PARTICLES = 60;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const btn = document.activeElement;
    if (btn && btn.classList.contains("interact-btn")) {
      btn.click();
    }
  }
});
