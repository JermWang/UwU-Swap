"use client";

import { useEffect, useRef } from "react";

export default function AsciiWaves() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = [".", ":", "-", "=", "+", "*", "#", "%", "@", "0", "1"];

    let width = 0;
    let height = 0;
    let time = 0;
    let rafId = 0;
    let running = true;

    type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number };
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      width = Math.floor(window.innerWidth);
      height = Math.floor(window.innerHeight);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      ctx.textBaseline = "top";

      const count = Math.max(24, Math.min(90, Math.floor((width * height) / 52000)));
      particles = new Array(count).fill(0).map(() => {
        const yMax = Math.max(1, height * 0.78);
        return {
          x: Math.random() * width,
          y: Math.random() * yMax,
          r: 0.6 + Math.random() * 1.1,
          vx: (Math.random() - 0.5) * 0.12,
          vy: 0.08 + Math.random() * 0.22,
          a: 0.05 + Math.random() * 0.10,
        };
      });
    };

    const draw = () => {
      if (!running) return;

      ctx.clearRect(0, 0, width, height);

      const isMobile = window.innerWidth < 768;
      const charW = isMobile ? 14 : 10;
      const charH = isMobile ? 18 : 14;

      const cols = Math.floor(width / charW);
      const rows = Math.floor(height / charH);

      const horizonRow = Math.floor(rows * 0.66);
      const baseRow = Math.floor(rows * 0.80);

      ctx.fillStyle = "#fff";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y -= p.vy;

        if (p.x < -4) p.x = width + 4;
        if (p.x > width + 4) p.x = -4;

        const yMax = height * 0.78;
        if (p.y < -6) {
          p.y = yMax + 6;
          p.x = Math.random() * width;
        }

        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let x = 0; x < cols; x++) {
        const wave =
          Math.sin(x * 0.12 + time) * 1.2 +
          Math.sin(x * 0.04 + time * 0.6) * 2.4;

        const yCenter = baseRow + Math.round(wave * 2.6);

        // Leave upper/middle mostly clean.
        if (yCenter < horizonRow) continue;

        // Draw a crisp crest line + a trailing band below it.
        for (let dy = -2; dy <= 14; dy++) {
          const y = yCenter + dy;
          if (y < 0 || y >= rows) continue;

          // Keep the surface line dense, but fade/sparsify depth below.
          const phase = Math.floor(time * 12);
          const sprinkle = (x * 7 + y * 11 + phase) % 6;

          if (dy <= 1) {
            // Crest: draw most columns, small gaps.
            if (sprinkle === 5) continue;
          } else if (dy <= 6) {
            // Upper body: draw ~50-66%.
            if (sprinkle === 4 || sprinkle === 5) continue;
          } else {
            // Lower body: draw ~33%.
            if (sprinkle !== 0 && sprinkle !== 1) continue;
          }

          const depth = Math.max(0, 1 - dy / 14);
          const intensity = dy <= 0 ? 1 : depth;
          const idx = Math.max(0, Math.min(chars.length - 1, Math.floor(intensity * (chars.length - 1))));

          ctx.globalAlpha = dy <= 1 ? 0.82 : 0.34 * depth;
          ctx.fillStyle = "#fff";
          ctx.fillText(chars[idx], x * charW, y * charH);
        }
      }

      time += 0.02;
      rafId = window.requestAnimationFrame(draw);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(rafId);
      } else {
        if (running) return;
        running = true;
        draw();
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    draw();

    return () => {
      running = false;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="ascii-waves" />;
}
