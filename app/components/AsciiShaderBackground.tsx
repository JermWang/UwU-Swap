"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// OPTIMIZED ASCII SHADER - Lightweight Space Theme
// Reduced computation, lower resolution, frame throttling
// ============================================================================

const STAR_CHARS = "·∙•✦✧★";

// Simple noise function
function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export default function AsciiShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // OPTIMIZATION: Larger cell size = fewer characters to render
    const CELL_WIDTH = 16;
    const CELL_HEIGHT = 24;
    const TARGET_FPS = 20; // Throttle to 20 FPS instead of 60
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    
    let cols = 0;
    let rows = 0;

    // Pre-generate static star positions (only compute once)
    let stars: { col: number; row: number; brightness: number; seed: number }[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / CELL_WIDTH);
      rows = Math.ceil(canvas.height / CELL_HEIGHT);
      
      // Regenerate stars on resize
      stars = [];
      const starDensity = 0.012; // ~1.2% of cells have stars
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const n = noise2D(col * 7.3, row * 11.7);
          if (n > 1 - starDensity) {
            stars.push({
              col,
              row,
              brightness: (n - (1 - starDensity)) / starDensity,
              seed: noise2D(col, row) * 1000,
            });
          }
        }
      }
    };

    const draw = (time: number) => {
      // Clear with deep space background
      ctx.fillStyle = "#0A0A0F";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${CELL_HEIGHT}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = "top";

      // Only render pre-computed stars (much faster than iterating all cells)
      for (const star of stars) {
        // Simple twinkle animation
        const twinkle = Math.sin(time * 0.002 + star.seed) * 0.5 + 0.5;
        const brightness = star.brightness * (0.4 + 0.6 * twinkle);
        
        if (brightness < 0.1) continue;

        const charIdx = Math.floor(twinkle * STAR_CHARS.length);
        const char = STAR_CHARS[Math.min(charIdx, STAR_CHARS.length - 1)];
        
        const x = star.col * CELL_WIDTH;
        const y = star.row * CELL_HEIGHT;
        
        // Pink color to match theme
        const alpha = 0.2 + brightness * 0.6;
        ctx.fillStyle = `rgba(255, 105, 180, ${alpha})`;
        ctx.fillText(char, x, y);
      }

      // Subtle vignette (only in corners)
      const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
      );
      vignette.addColorStop(0, "rgba(10, 10, 15, 0)");
      vignette.addColorStop(1, "rgba(10, 10, 15, 0.7)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const animate = (timestamp: number) => {
      // Frame throttling - skip frames to maintain target FPS
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
        zIndex: -1,
      }}
    />
  );
}
