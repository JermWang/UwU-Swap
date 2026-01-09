"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// ASCII SHADER - Space Theme with Pink Kawaii Vibes
// Per-character computation with performance optimizations
// ============================================================================

const DENSITY_CHARS = " .·:;+=xX$#@";
const STAR_CHARS = " ·∙•✦✧★";

function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  
  const a = noise2D(ix, iy);
  const b = noise2D(ix + 1, iy);
  const c = noise2D(ix, iy + 1);
  const d = noise2D(ix + 1, iy + 1);
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x: number, y: number, octaves: number = 3): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    amplitude *= 0.5;
    frequency *= 2;
  }
  
  return value;
}

export default function AsciiShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Slightly larger cells for performance (12x18 instead of 10x16)
    const CELL_WIDTH = 12;
    const CELL_HEIGHT = 18;
    const TARGET_FPS = 24;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    
    let cols = 0;
    let rows = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / CELL_WIDTH);
      rows = Math.ceil(canvas.height / CELL_HEIGHT);
    };

    type Sample = { b: number; char?: string };

    // Starfield shader - twinkling stars
    const starfieldShader = (nx: number, ny: number, t: number): Sample => {
      const n = noise2D(nx * 100, ny * 100);
      if (n < 0.985) return { b: 0 };

      const twinkle = Math.sin(t * 0.003 + n * 100) * 0.5 + 0.5;
      const b = (n - 0.97) * 30 * (0.4 + 0.6 * twinkle);

      const charIdx = Math.floor(twinkle * STAR_CHARS.length);
      const char = STAR_CHARS[Math.min(charIdx, STAR_CHARS.length - 1)];
      return { b: Math.min(1, b), char };
    };

    // Nebula shader - flowing cosmic clouds
    const nebulaShader = (nx: number, ny: number, t: number): number => {
      const flow = t * 0.00012;
      const combined = fbm(nx * 2.5 + flow, ny * 2.5 - flow * 0.5, 3);
      
      const threshold = 0.38;
      if (combined > threshold) {
        return (combined - threshold) / (1 - threshold) * 0.4;
      }
      return 0;
    };

    // Tunnel/vortex shader - spiraling effect
    const tunnelShader = (nx: number, ny: number, t: number): number => {
      const cx = 0.5, cy = 0.5;
      const dx = nx - cx;
      const dy = (ny - cy) * 1.2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.02) return 0;

      const angle = Math.atan2(dy, dx);
      const spiral = Math.sin(angle * 4 + dist * 12 - t * 0.0015) * 0.5 + 0.5;
      const rings = Math.sin(dist * 20 - t * 0.002) * 0.5 + 0.5;
      const falloff = Math.max(0, 1 - dist * 1.3);
      
      return spiral * rings * falloff * 0.35;
    };

    // Plasma wave shader
    const plasmaShader = (nx: number, ny: number, t: number): number => {
      const wave1 = Math.sin(nx * 8 + t * 0.0008) * Math.cos(ny * 6 - t * 0.0006);
      const wave2 = Math.sin((nx + ny) * 5 + t * 0.001);
      
      const combined = (wave1 + wave2) / 2 * 0.5 + 0.5;
      return combined * 0.2;
    };

    // Shooting star shader
    const shootingStarShader = (nx: number, ny: number, t: number): Sample => {
      const period = 5000;
      const life = 1000;
      const phase = t % period;
      if (phase > life) return { b: 0 };

      const cycle = Math.floor(t / period);
      const startX = noise2D(cycle, 0) * 0.6 + 0.2;
      const startY = noise2D(0, cycle) * 0.3 + 0.05;
      const angle = 0.5 + noise2D(cycle, cycle) * 0.3;

      const progress = phase / life;
      const headX = startX + Math.cos(angle) * progress * 0.6;
      const headY = startY + Math.sin(angle) * progress * 0.6;

      const dx = nx - headX;
      const dy = ny - headY;
      const headDist = Math.sqrt(dx * dx + dy * dy);
      if (headDist < 0.02) {
        return { b: (1 - headDist / 0.02) * 1.0, char: "★" };
      }

      const trailLength = 0.12;
      const projLen = -(dx * Math.cos(angle) + dy * Math.sin(angle));
      if (projLen > 0 && projLen < trailLength) {
        const perpDist = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
        if (perpDist < 0.015) {
          const fade = 1 - projLen / trailLength;
          const b = fade * (1 - perpDist / 0.015) * 0.7;
          return { b: Math.min(1, b), char: "✦" };
        }
      }

      return { b: 0 };
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${CELL_HEIGHT}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = "top";

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const nx = col / cols;
          const ny = row / rows;
          
          let brightness = 0;
          let bestB = 0;
          let bestChar: string | undefined;

          const apply = (s: Sample) => {
            brightness += s.b;
            if (s.b > bestB) {
              bestB = s.b;
              bestChar = s.char;
            }
          };

          apply(starfieldShader(nx, ny, time));
          apply(shootingStarShader(nx, ny, time));
          apply({ b: nebulaShader(nx, ny, time) });
          apply({ b: tunnelShader(nx, ny, time) });
          apply({ b: plasmaShader(nx, ny, time) });

          if (brightness < 0.02) continue;
          brightness = Math.min(1, brightness);

          const char = bestChar ?? DENSITY_CHARS[Math.floor(brightness * (DENSITY_CHARS.length - 1))];
          if (char === " ") continue;
          
          const x = col * CELL_WIDTH;
          const y = row * CELL_HEIGHT;
          
          // Pink color for kawaii vibes
          const alpha = 0.3 + brightness * 0.7;
          ctx.fillStyle = `rgba(255, 105, 180, ${alpha})`;
          ctx.fillText(char, x, y);
        }
      }

    };

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrameRef.current;
      
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameRef.current = timestamp - (elapsed % FRAME_INTERVAL);
        draw(timestamp);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
