'use client';

/**
 * MagneticBackground — Fondo interactivo de "limaduras de imán" (campo magnético).
 *
 * Concepto: miles de agujas cortas distribuidas en una rejilla orgánica se orientan
 * como limaduras de hierro alrededor de un dipolo magnético invisible que sigue al
 * puntero/dedo del usuario. El campo es un actor vivo ligado al formulario:
 *
 *   idle      → calma ambiental con oscilación suave
 *   email     → acento cian dominante, campo atento
 *   password  → deriva a magenta/púrpura
 *   error     → turbulencia breve (el campo tiembla y pierde alineación)
 *   loading   → las limaduras orbitan lentamente alrededor del CTA (sin spinner)
 *   success   → onda de alineación total en cascada antes de navegar
 *
 * Interacciones directas: el puntero mueve el dipolo; un toque sobre el fondo vacío
 * dispara pulso + inversión de polaridad con cascada radial.
 *
 * Guardrails del proyecto aplicados (heredados de la arquitectura del fondo previo):
 * - Heurística A (batería/CPU): render pausado con `visibilitychange`, DPR con cap,
 *   rejilla adaptativa por densidad de puntero, batching de trazado por cubos de tensión.
 * - `prefers-reduced-motion`: se degrada al AuthBackground estático.
 * - Limpieza estricta de listeners y RAF al desmontar; sin operaciones destructivas
 *   sobre el contexto (compatible con remontaje de StrictMode).
 */

import { useEffect, useRef, useState } from 'react';
import AuthBackground from './AuthBackground';
import { AuthFieldContext } from './AuthFieldContext';

type FieldMode = 'pending' | 'active' | 'static';

/** Estados semánticos que el formulario puede transmitir al campo */
export type FieldMood =
  | 'idle'
  | 'email'
  | 'password'
  | 'error'
  | 'loading'
  | 'success';

/** API imperativa para que el formulario comunique eventos al campo */
export interface MagneticFieldApi {
  setMood: (mood: FieldMood) => void;
  /** Pulso de onda desde coordenadas de cliente (ej. posición de un input al teclear) */
  pulse: (clientX: number, clientY: number) => void;
  /** Inversión de polaridad con cascada radial */
  flipPolarity: () => void;
}

interface MagneticBackgroundProps {
  children: React.ReactNode;
  /** Entrega la API del motor cuando está listo (para conectar el formulario) */
  onApi?: (api: MagneticFieldApi) => void;
}

export default function MagneticBackground({
  children,
  onApi,
}: MagneticBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<FieldMode>('pending');
  const [engineApi, setEngineApi] = useState<MagneticFieldApi | null>(null);
  const onApiRef = useRef(onApi);
  onApiRef.current = onApi;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Accesibilidad: sin simulación si el usuario prefiere movimiento reducido
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setMode('static');
      return;
    }

    let engine: MagneticFieldApi & { destroy: () => void } | null = null;
    try {
      engine = createMagneticEngine(canvas);
      setMode('active');
      setEngineApi(engine);
      onApiRef.current?.(engine);
    } catch (error) {
      // Log solo-dev: el fallback nunca debe ser silencioso durante desarrollo
      if (process.env.NODE_ENV !== 'production') {
        console.error('[MagneticBackground] Fallback a fondo estático:', error);
      }
      setMode('static');
    }

    return () => {
      engine?.destroy();
    };
  }, []);

  const active = mode === 'active';

  return (
    <AuthBackground
      showEffects={!active}
      overlay={
        /* Canvas del campo magnético: cubre la pantalla por detrás de la card */
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full transition-opacity duration-700 ease-out pointer-events-none"
          style={{ opacity: active ? 1 : 0 }}
        />
      }
    >
      <AuthFieldContext.Provider value={active && engineApi ? engineApi : null}>
        {children}
      </AuthFieldContext.Provider>
    </AuthBackground>
  );
}

/* ================================================================
   Motor del campo magnético (Canvas 2D)
   ================================================================ */

interface Vec2 {
  x: number;
  y: number;
}

interface Filing {
  x: number;
  y: number;
  angle: number;
  omega: number;
  length: number;
  /** Polaridad efectiva propia (cambia con retardo según distancia → cascada) */
  polarity: 1 | -1;
}

interface PulseRing {
  t0: number;
  x: number;
  y: number;
}

interface FlipEvent {
  t0: number;
}

/** Acentos por estado (paleta neón del proyecto) */
const ACCENTS: Record<FieldMood, readonly [number, number, number]> = {
  idle: [0.133, 0.827, 0.933], // cian #22d3ee
  email: [0.133, 0.827, 0.933], // cian reforzado
  password: [0.91, 0.474, 0.976], // magenta #e879f9
  error: [0.973, 0.443, 0.443], // rojo suave #f87171
  loading: [0.753, 0.518, 0.988], // púrpura #c084fc
  success: [0.133, 0.827, 0.933], // cian de alineación
};

const BASE_COLOR: readonly [number, number, number] = [0.23, 0.28, 0.44];

function createMagneticEngine(
  canvas: HTMLCanvasElement
): MagneticFieldApi & { destroy: () => void } {
  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (!maybeCtx) throw new Error('Canvas 2D no disponible');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const isCoarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  /* ---------------- Estado ---------------- */

  let width = 0;
  let height = 0;
  let dpr = 1;
  let filings: Filing[] = [];
  let stars: { x: number; y: number; size: number; phase: number; speed: number }[] = [];
  let bgGradient: CanvasGradient | null = null;

  const dipole: Vec2 & { tx: number; ty: number } = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastPointerAt = performance.now();

  let mood: FieldMood = 'idle';
  let moodUntil = Infinity; // auto-retorno a idle (error/success transitorios)
  let turbulenceUntil = 0;
  let accentFrom: readonly [number, number, number] = ACCENTS.idle;
  let accentTo: readonly [number, number, number] = ACCENTS.idle;
  let accentMix = 1; // 0 → accentFrom, 1 → accentTo

  const pulses: PulseRing[] = [];
  const flips: FlipEvent[] = [];

  let rafId: number | null = null;
  let lastUpdateTime = performance.now();
  let disposed = false;

  /* ---------------- Construcción de escena ---------------- */

  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resizeCanvas(): boolean {
    // Cap de DPR: protege GPU/batería en pantallas de alta densidad
    const targetDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * targetDpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * targetDpr));

    // Dimensiones lógicas SIEMPRE sincronizadas con el canvas: el segundo motor
    // de StrictMode hereda un canvas ya dimensionado y no entra a la rama de
    // cambio, pero igual necesita width/height reales para construir su escena.
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = targetDpr;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      sceneReady = false; // dimensiones nuevas → reconstruir escena
    }
    // Idempotencia crítica: sin esta guarda el motor remontado arrancaría sin
    // escena pintando nada sobre un canvas opaco → pantalla negra hasta resize.
    if (!sceneReady) {
      buildScene();
      return true;
    }
    return false;
  }

  let sceneReady = false;

  function buildScene(): void {
    sceneReady = true;
    // Rejilla orgánica de limaduras: espaciado adaptativo + jitter determinista
    const spacing = isCoarse ? 36 : 30;
    const rand = mulberry32(20260824);
    filings = [];
    for (
      let gy = spacing / 2;
      gy < height;
      gy += spacing
    ) {
      for (
        let gx = spacing / 2;
        gx < width;
        gx += spacing
      ) {
        filings.push({
          x: gx + (rand() - 0.5) * spacing * 0.5,
          y: gy + (rand() - 0.5) * spacing * 0.5,
          angle: rand() * Math.PI * 2,
          omega: 0,
          length: 6.5 + rand() * 2.5,
          polarity: 1,
        });
      }
    }

    // Estrellas tenues fijas (tinte espacial minimalista)
    stars = [];
    const starCount = Math.round((width * height) / 26000);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: rand() * width,
        y: rand() * height,
        size: rand() < 0.85 ? 1 : 1.6,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 0.8,
      });
    }

    bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#070d1d');
    bgGradient.addColorStop(0.55, '#0b1226');
    bgGradient.addColorStop(1, '#060a16');

    if (dipole.x === 0 && dipole.y === 0) {
      dipole.x = dipole.tx = width / 2;
      dipole.y = dipole.ty = height / 2;
    }
  }

  /* ---------------- Eventos de puntero ---------------- */

  const INTERACTIVE_TAGS = new Set(['input', 'button', 'a', 'label', 'select', 'textarea']);

  const onPointerMove = (event: PointerEvent) => {
    dipole.tx = event.clientX;
    dipole.ty = event.clientY;
    lastPointerAt = performance.now();
  };

  /**
   * Toque/click sobre el fondo (no sobre controles del formulario):
   * pulso + inversión de polaridad en cascada radial.
   */
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && INTERACTIVE_TAGS.has(target.tagName.toLowerCase())) return;

    dipole.tx = event.clientX;
    dipole.ty = event.clientY;
    lastPointerAt = performance.now();
    pulses.push({ t0: performance.now(), x: event.clientX, y: event.clientY });
    flipPolarity();
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });

  /* ---------------- API pública ---------------- */

  function flipPolarity(): void {
    flips.push({ t0: performance.now() });
    // Poda: conserva solo eventos recientes relevantes para la cascada
    const horizon = performance.now() - 4000;
    while (flips.length > 0 && flips[0].t0 < horizon) flips.shift();
  }

  function pulse(clientX: number, clientY: number): void {
    pulses.push({ t0: performance.now(), x: clientX, y: clientY });
    if (pulses.length > 12) pulses.shift();
  }

  function setMood(next: FieldMood): void {
    if (next === mood) return;
    const now = performance.now();
    accentFrom = currentAccent(now);
    accentTo = ACCENTS[next];
    accentMix = 0;
    mood = next;
    const nowMs = now;
    if (next === 'error') {
      turbulenceUntil = nowMs + 950;
      moodUntil = nowMs + 1600;
    } else if (next === 'success') {
      moodUntil = nowMs + 1500;
    } else if (next === 'loading') {
      moodUntil = Infinity;
    } else {
      moodUntil = Infinity;
    }
  }

  function currentAccent(now: number): readonly [number, number, number] {
    if (accentMix >= 1) return accentTo;
    // Transición suave entre acentos
    const t = Math.min(1, accentMix);
    return [
      accentFrom[0] + (accentTo[0] - accentFrom[0]) * t,
      accentFrom[1] + (accentTo[1] - accentFrom[1]) * t,
      accentFrom[2] + (accentTo[2] - accentFrom[2]) * t,
    ];
  }

  /* ---------------- Física ---------------- */

  function angleDiff(a: number, b: number): number {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function step(now: number, dt: number, elapsed: number): void {
    // Auto-retorno a idle tras estados transitorios (error/success)
    if (now >= moodUntil && mood !== 'idle' && mood !== 'loading') {
      setMood('idle');
    }
    if (accentMix < 1) accentMix = Math.min(1, accentMix + dt * 2.2);

    // Deriva ambiental del dipolo cuando no hay interacción (escena viva)
    if (now - lastPointerAt > 3200) {
      dipole.tx =
        width * (0.5 + 0.24 * Math.sin(elapsed * 0.00021));
      dipole.ty =
        height * (0.48 + 0.2 * Math.cos(elapsed * 0.00016));
    }
    dipole.x += (dipole.tx - dipole.x) * Math.min(1, dt * 3.4);
    dipole.y += (dipole.ty - dipole.y) * Math.min(1, dt * 3.4);

    const influenceR = Math.min(width, height) * 0.48;
    const turbulent = now < turbulenceUntil;

    // Parámetros por estado
    const loading = mood === 'loading';
    const successWave = mood === 'success';
    const stiffnessBase = loading ? 46 : mood === 'error' ? 90 : 62;
    const damping = loading ? 10 : 7.5;

    // Ancla del modo loading: centro aproximado del CTA del formulario
    const anchorX = width / 2;
    const anchorY = height * 0.56;

    // Poda de pulsos viejos
    for (let i = pulses.length - 1; i >= 0; i--) {
      if (now - pulses[i].t0 > 2200) pulses.splice(i, 1);
    }

    for (const f of filings) {
      const dx = f.x - dipole.x;
      const dy = f.y - dipole.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirToDipole = Math.atan2(dy, dx);

      // Cascada de polaridad: cada evento voltea la polaridad de la limadura
      // cuando el frente de onda (propagación por distancia) la alcanza
      let polarity = f.polarity;
      for (const flip of flips) {
        const triggerAt = flip.t0 + dist * 1.1;
        if (now >= triggerAt) polarity = (polarity * -1) as 1 | -1;
      }
      f.polarity = polarity;

      // Ángulo objetivo según estado
      let target: number;
      if (successWave) {
        // Onda de alineación: convergen a un rumbo común en cascada
        const cascade = Math.min(1, Math.max(0, (now - (moodUntil - 1500) - f.x * 0.6) / 450));
        target = -0.35 + (polarity > 0 ? 0 : Math.PI) + (1 - cascade) * dirToDipole * 0.2;
      } else if (loading) {
        // Órbita alrededor del CTA
        const orbitR = Math.hypot(f.x - anchorX, f.y - anchorY);
        target = dirToDipole + Math.PI / 2 + Math.sin(elapsed * 0.0012 + orbitR * 0.01) * 0.15;
      } else {
        // Alineación hacia/a partir del dipolo + vórtice en el núcleo cercano
        const core = Math.exp(-Math.pow(dist / (influenceR * 0.22), 2)) * 0.65;
        target = dirToDipole * polarity + (polarity > 0 ? Math.PI : 0) * core;
        target += core * (Math.PI / 2);
        // Oscilación ambiental sutil
        target += 0.14 * Math.sin(elapsed * 0.0006 + f.x * 0.011 + f.y * 0.013);
      }

      if (turbulent) {
        target += (Math.random() - 0.5) * 1.6;
      }

      // Pulsos: patada angular + brillo al paso del frente de onda
      let glowBoost = 0;
      for (const p of pulses) {
        const pdx = f.x - p.x;
        const pdy = f.y - p.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        const ringR = (now - p.t0) * 0.55;
        const band = Math.exp(-Math.pow((pdist - ringR) / 26, 2));
        if (band > 0.02) {
          f.omega += band * 6 * dt;
          glowBoost = Math.max(glowBoost, band);
        }
      }

      // Muelle angular amortiguado (movimiento orgánico con inercia)
      const diff = angleDiff(f.angle, target);
      f.omega += diff * stiffnessBase * dt;
      f.omega -= f.omega * damping * dt;
      f.angle += f.omega * dt;

      // Tensión = proximidad al dipolo (con boost de pulso) — controla brillo/color
      const proximity = Math.max(0, 1 - dist / influenceR);
      (f as Filing & { _tension?: number })._tension = Math.min(
        1,
        Math.pow(proximity, 1.5) + glowBoost
      );
    }

    // Poda de eventos de flip antiguos ya propagados
    const maxDist = Math.sqrt(width * width + height * height);
    while (flips.length > 0 && now - flips[0].t0 > maxDist * 1.1 + 500) flips.shift();
  }

  /* ---------------- Render ---------------- */

  // Cubos de tensión para batching de trazado (evita cambios de estilo por línea)
  const BUCKETS = 4;

  function render(now: number, elapsed: number): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fondo espacial profundo
    if (bgGradient) {
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#080e1e';
      ctx.fillRect(0, 0, width, height);
    }

    // Estrellas tenues con titileo suave
    ctx.fillStyle = 'rgba(190, 210, 255, 0.5)';
    ctx.beginPath();
    for (const s of stars) {
      const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 0.001 * s.speed + s.phase));
      ctx.globalAlpha = tw;
      ctx.rect(s.x, s.y, s.size, s.size);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // Paths por cubo de tensión
    const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
    for (const f of filings) {
      const tension = ((f as Filing & { _tension?: number })._tension ?? 0);
      const bucket = Math.min(BUCKETS - 1, Math.floor(tension * BUCKETS));
      const path = paths[bucket];
      const cosA = Math.cos(f.angle) * f.length;
      const sinA = Math.sin(f.angle) * f.length;
      path.moveTo(f.x - cosA, f.y - sinA);
      path.lineTo(f.x + cosA, f.y + sinA);
    }

    const accent = currentAccent(now);
    for (let b = 0; b < BUCKETS; b++) {
      const tMin = b / BUCKETS;
      const intensity = 0.1 + (b / (BUCKETS - 1)) * 0.9;
      const r = Math.round((BASE_COLOR[0] + (accent[0] - BASE_COLOR[0]) * intensity) * 255);
      const g = Math.round((BASE_COLOR[1] + (accent[1] - BASE_COLOR[1]) * intensity) * 255);
      const bl = Math.round((BASE_COLOR[2] + (accent[2] - BASE_COLOR[2]) * intensity) * 255);
      const alpha = 0.22 + intensity * 0.68;

      // Halo suave solo para el cubo más caliente (glow barato y contenido)
      if (b === BUCKETS - 1) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, 0.18)`;
        ctx.lineWidth = 3.4;
        ctx.stroke(paths[b]);
      }

      ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${alpha})`;
      ctx.lineWidth = 1.25;
      ctx.stroke(paths[b]);
    }
  }

  /* ---------------- Bucle principal ---------------- */

  function frame(now: number): void {
    if (disposed) return;
    if (document.hidden) {
      rafId = null;
      return;
    }

    let dt = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    dt = Math.min(Math.max(dt, 0), 0.033);

    resizeCanvas();
    step(now, dt, now);
    render(now, now);

    rafId = requestAnimationFrame(frame);
  }

  const startLoop = () => {
    if (rafId === null && !disposed) {
      lastUpdateTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      startLoop();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);

  // Arranque
  resizeCanvas();
  startLoop();

  return {
    setMood,
    pulse,
    flipPolarity,
    destroy() {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      filings = [];
      stars = [];
    },
  };
}
