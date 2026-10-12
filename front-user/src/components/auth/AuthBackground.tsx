'use client';

import React, { useEffect, useRef } from 'react';

interface ParticleConfig {
  id: number;
  width: number;
  height: number;
  top: string;
  left: string;
  color: string;
  opacity: number;
  duration: string;
  delay: string;
  blur: number;
  shadow: number;
}

/**
 * Configuración determinista de 12 partículas para evitar hydration mismatch entre SSR y cliente.
 * Distribuidas de forma balanceada con duraciones y desfases asíncronos para simular movimiento natural.
 */
const PARTICLES: readonly ParticleConfig[] = [
  { id: 0, width: 2.5, height: 2.5, top: '15%', left: '12%', color: '#22d3ee', opacity: 0.45, duration: '12s', delay: '0s', blur: 0.5, shadow: 10 },
  { id: 1, width: 3.2, height: 3.2, top: '28%', left: '85%', color: '#c084fc', opacity: 0.55, duration: '15s', delay: '2.5s', blur: 0.8, shadow: 12 },
  { id: 2, width: 1.8, height: 1.8, top: '72%', left: '8%', color: '#e879f9', opacity: 0.4, duration: '10s', delay: '1s', blur: 0.4, shadow: 8 },
  { id: 3, width: 2.8, height: 2.8, top: '85%', left: '78%', color: '#22d3ee', opacity: 0.5, duration: '13s', delay: '3.5s', blur: 0.6, shadow: 11 },
  { id: 4, width: 3.5, height: 3.5, top: '45%', left: '22%', color: '#c084fc', opacity: 0.6, duration: '16s', delay: '0.8s', blur: 0.9, shadow: 14 },
  { id: 5, width: 2.0, height: 2.0, top: '60%', left: '92%', color: '#e879f9', opacity: 0.35, duration: '11s', delay: '4.2s', blur: 0.5, shadow: 9 },
  { id: 6, width: 2.4, height: 2.4, top: '10%', left: '65%', color: '#22d3ee', opacity: 0.48, duration: '14s', delay: '1.7s', blur: 0.7, shadow: 10 },
  { id: 7, width: 3.0, height: 3.0, top: '90%', left: '35%', color: '#c084fc', opacity: 0.52, duration: '12.5s', delay: '2.1s', blur: 0.6, shadow: 13 },
  { id: 8, width: 1.6, height: 1.6, top: '38%', left: '74%', color: '#e879f9', opacity: 0.42, duration: '9.5s', delay: '3.8s', blur: 0.3, shadow: 7 },
  { id: 9, width: 3.8, height: 3.8, top: '78%', left: '55%', color: '#22d3ee', opacity: 0.58, duration: '17s', delay: '1.2s', blur: 1.0, shadow: 15 },
  { id: 10, width: 2.2, height: 2.2, top: '22%', left: '40%', color: '#c084fc', opacity: 0.38, duration: '10.8s', delay: '4.7s', blur: 0.4, shadow: 8 },
  { id: 11, width: 2.6, height: 2.6, top: '65%', left: '30%', color: '#e879f9', opacity: 0.46, duration: '13.5s', delay: '2.9s', blur: 0.6, shadow: 10 },
];

interface AuthBackgroundProps {
  children: React.ReactNode;
  /**
   * Capa absoluta renderizada entre los efectos decorativos y el contenido.
   * La usa FluidBackground para montar el canvas de la simulación por detrás
   * de la card glassmorphism sin duplicar el layout.
   */
  overlay?: React.ReactNode;
  /**
   * Cuando un fondo más rico (fluidos) está activo, se ocultan partículas y
   * rayos para preservar el minimalismo y no competir visualmente.
   */
  showEffects?: boolean;
}

export default function AuthBackground({
  children,
  overlay,
  showEffects = true,
}: AuthBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Aplica fuerza de repulsión a las partículas según la posición del cursor o toque
    const updateParticles = (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const particles = containerRef.current.querySelectorAll<HTMLElement>('.particle');
      particles.forEach((particle) => {
        const rect = particle.getBoundingClientRect();
        const particleX = rect.left + rect.width / 2;
        const particleY = rect.top + rect.height / 2;

        const distX = clientX - particleX;
        const distY = clientY - particleY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < 160) {
          const angle = Math.atan2(distY, distX);
          const force = (160 - distance) / 160;
          const moveX = -Math.cos(angle) * force * 35;
          const moveY = -Math.sin(angle) * force * 35;

          particle.style.transform = `translate(${moveX}px, ${moveY}px)`;
        } else {
          particle.style.transform = 'translate(0, 0)';
        }
      });
    };

    // Restaura las partículas a su posición de flotación base
    const resetParticles = () => {
      if (!containerRef.current) return;
      const particles = containerRef.current.querySelectorAll<HTMLElement>('.particle');
      particles.forEach((particle) => {
        particle.style.transform = 'translate(0, 0)';
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateParticles(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateParticles(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateParticles(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      resetParticles();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('mouseleave', resetParticles);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mouseleave', resetParticles);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-screen w-full bg-gradient-to-br from-[#0a0e1a] via-[#1a1f35] to-[#0f1525] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-noise-texture" />

      {/* Partículas y rayos solo cuando no hay simulación de fluidos activa */}
      {showEffects && (
        <>
          {/* 12 Partículas flotantes reactivas al cursor y dedo en móvil */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {PARTICLES.map((particle) => (
              <div
                key={particle.id}
                className="particle absolute rounded-full transition-transform duration-700 ease-out"
                style={{
                  width: `${particle.width}px`,
                  height: `${particle.height}px`,
                  top: particle.top,
                  left: particle.left,
                  backgroundColor: particle.color,
                  opacity: particle.opacity,
                  animation: `float ${particle.duration} ease-in-out infinite`,
                  animationDelay: particle.delay,
                  filter: `blur(${particle.blur}px)`,
                  boxShadow: `0 0 ${particle.shadow}px currentColor`,
                }}
              />
            ))}
          </div>

          {/* Rayos crepitantes SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="electricGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#c084fc" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#e879f9" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            <path
              d="M 10 50 Q 100 30, 200 50 T 400 50"
              stroke="url(#electricGradient)"
              strokeWidth="1"
              fill="none"
              className="animate-pulse-slower"
              style={{ filter: 'blur(1px)' }}
            />
            <path
              d="M 800 400 Q 700 420, 600 400 T 400 400"
              stroke="url(#electricGradient)"
              strokeWidth="1"
              fill="none"
              className="animate-pulse-slow"
              style={{ filter: 'blur(1px)', animationDelay: '1s' }}
            />
            <path
              d="M 1200 200 Q 1100 180, 1000 200 T 800 200"
              stroke="url(#electricGradient)"
              strokeWidth="1"
              fill="none"
              className="animate-pulse"
              style={{ filter: 'blur(1px)', animationDelay: '2s' }}
            />
          </svg>
        </>
      )}

      {/* Capa interactiva (canvas WebGL) por detrás del contenido */}
      {overlay}

      {/* Gradientes de luz difusa con resplandor */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] animate-pulse-slower pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-fuchsia-500/3 rounded-full blur-[80px] animate-pulse pointer-events-none" />

      <div className="relative z-10 h-full flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Panel de ignición: vidrio más preciso, borde biselado y línea de energía superior */}
          <div className="relative bg-[#10162b]/55 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
