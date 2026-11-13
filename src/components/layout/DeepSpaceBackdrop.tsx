import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  color: string;
  phase: number;
  speed: number;
  bright?: boolean;
}

export const DeepSpaceBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars: Star[] = [];

    const palette = [
      '226, 232, 240', // Starlight white
      '165, 243, 252', // Cyan giant
      '147, 197, 253', // O/B hot blue
      '253, 230, 138', // K-type warm gold
      '196, 181, 253', // Subtle violet
    ];

    const initStars = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(260, Math.max(110, Math.floor((width * height) / 7200)));
      stars = Array.from({ length: count }, (_, idx) => {
        // Deterministic pseudo-random distribution for visual stability
        const seedA = Math.sin((idx + 1) * 12.9898) * 43758.5453;
        const seedB = Math.sin((idx + 1) * 78.233) * 19341.123;
        const rx = seedA - Math.floor(seedA);
        const ry = seedB - Math.floor(seedB);
        const isBright = idx % 37 === 0;
        return {
          x: rx * width,
          y: ry * height,
          r: isBright ? 1.85 : 0.55 + (idx % 4) * 0.32,
          alpha: isBright ? 0.85 : 0.25 + ((idx * 17) % 55) / 100,
          color: palette[idx % palette.length],
          phase: (idx * 0.73) % (Math.PI * 2),
          speed: 0.4 + ((idx % 7) * 0.14),
          bright: isBright,
        };
      });
    };

    const drawFrame = (timeSec: number) => {
      ctx.clearRect(0, 0, width, height);

      // Subtle celestial coordinate arc & ecliptic horizon curves
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const cy = height * (0.25 + i * 0.28);
        ctx.ellipse(width * 0.55, cy, width * 0.65, 160 + i * 70, -0.14, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Starfield planes
      for (const s of stars) {
        const twinkle = prefersReduced
          ? 1
          : 0.72 + 0.28 * Math.sin(timeSec * s.speed + s.phase);
        const a = Math.min(1, s.alpha * twinkle);

        ctx.fillStyle = `rgba(${s.color}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.bright) {
          // Subtle 4-point diffraction spikes on bright reference stars
          ctx.strokeStyle = `rgba(${s.color}, ${(a * 0.36).toFixed(3)})`;
          ctx.lineWidth = 0.75;
          const spike = s.r * 5.2;
          ctx.beginPath();
          ctx.moveTo(s.x - spike, s.y);
          ctx.lineTo(s.x + spike, s.y);
          ctx.moveTo(s.x, s.y - spike);
          ctx.lineTo(s.x, s.y + spike);
          ctx.stroke();

          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
          glow.addColorStop(0, `rgba(${s.color}, ${(a * 0.25).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    initStars();
    drawFrame(0);

    let lastTick = 0;
    const loop = (now: number) => {
      if (!prefersReduced) {
        if (now - lastTick > 45) {
          drawFrame(now * 0.001);
          lastTick = now;
        }
        animId = requestAnimationFrame(loop);
      }
    };

    if (!prefersReduced) {
      animId = requestAnimationFrame(loop);
    }

    const handleResize = () => {
      initStars();
      drawFrame(performance.now() * 0.001);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden no-print"
      aria-hidden="true"
    >
      {/* Deep-space atmospheric nebula depth gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 50% at 14% 8%, rgba(6, 182, 212, 0.14) 0%, transparent 62%), radial-gradient(ellipse 65% 50% at 86% 18%, rgba(79, 70, 229, 0.13) 0%, transparent 60%), radial-gradient(ellipse 80% 45% at 50% 100%, rgba(14, 116, 144, 0.12) 0%, transparent 65%)',
        }}
      />
      {/* Galactic plane subtle oblique infrared dust glow */}
      <div
        className="absolute -inset-24 opacity-40"
        style={{
          background:
            'linear-gradient(125deg, transparent 32%, rgba(34, 211, 238, 0.05) 48%, rgba(99, 102, 241, 0.05) 54%, transparent 70%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full opacity-90" />
    </div>
  );
};
