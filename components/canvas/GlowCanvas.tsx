'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useViewport, useNodes } from '@xyflow/react';
import { usePatinaStore } from '@/lib/store';
import type { PatinaNode } from '@/types';

// Each node spawns several sub-blobs that drift independently.
// This makes the glow edges feel organic and alive.
const BLOBS_PER_COLOR = 3;

// Slow oscillation periods (seconds) — different for each axis
// so the movement doesn't feel like a circle.
const DRIFT_PERIODS = [
  { x: 5.0, y: 7.0 },
  { x: 6.5, y: 4.5 },
  { x: 8.0, y: 5.5 },
];

// How far blobs drift from center (as fraction of glow radius)
const DRIFT_AMOUNT = 0.35;

// Breathing: how much the radius pulses (fraction)
const BREATHE_AMOUNT = 0.12;
const BREATHE_PERIODS = [4.0, 5.5, 7.0];

export function GlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Store refs for animation loop (avoid stale closures)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<PatinaNode[]>([]);
  const vibeCacheRef = useRef<Record<string, { colors: string[] }>>({});

  const viewport = useViewport();
  const nodes = useNodes<PatinaNode>();
  const vibeCache = usePatinaStore((s) => s.vibeCache);

  // Keep refs current
  viewportRef.current = viewport;
  nodesRef.current = nodes;
  vibeCacheRef.current = vibeCache;

  // ── Resize canvas to match container ──
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Continuous animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let running = true;

    function animate(timestamp: number) {
      if (!running) return;

      const ctx = canvas!.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(animate); return; }

      const dpr = window.devicePixelRatio || 1;
      const t = timestamp / 1000; // seconds

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.globalCompositeOperation = 'screen';

      const { x: panX, y: panY, zoom } = viewportRef.current;
      const currentNodes = nodesRef.current;
      const cache = vibeCacheRef.current;

      for (let ni = 0; ni < currentNodes.length; ni++) {
        const node = currentNodes[ni];
        const vibe = cache[node.id];
        if (!vibe || !vibe.colors || vibe.colors.length === 0) continue;
        if (node.type === 'suggested') continue;

        const nodeW = node.measured?.width ?? 240;
        const nodeH = node.measured?.height ?? 200;
        const centerFlowX = node.position.x + nodeW / 2;
        const centerFlowY = node.position.y + nodeH / 2;

        const screenX = (centerFlowX * zoom + panX) * dpr;
        const screenY = (centerFlowY * zoom + panY) * dpr;

        const baseRadius = 300;
        const radius = baseRadius * zoom * dpr;

        const colors = vibe.colors.slice(0, 2);

        // ── Static base glow — always visible, anchored to node center ──
        const primaryRgb = hexToRgb(colors[0]);
        if (primaryRgb) {
          const baseGlowRadius = radius * 0.7;
          const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, baseGlowRadius);
          gradient.addColorStop(0, `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.35)`);
          gradient.addColorStop(0.3, `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.18)`);
          gradient.addColorStop(0.65, `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.06)`);
          gradient.addColorStop(1, `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(screenX - baseGlowRadius, screenY - baseGlowRadius, baseGlowRadius * 2, baseGlowRadius * 2);
        }

        // ── Animated blobs on top ──
        // Use node index as a phase seed so each node drifts differently
        const nodeSeed = ni * 2.37;

        for (let ci = 0; ci < colors.length; ci++) {
          const rgb = hexToRgb(colors[ci]);
          if (!rgb) continue;

          const colorRadius = ci === 0 ? radius : radius * 0.85;
          // Per-color opacity — primary is brighter
          const baseAlpha = ci === 0 ? 0.55 : 0.4;

          for (let bi = 0; bi < BLOBS_PER_COLOR; bi++) {
            const blobSeed = nodeSeed + ci * 3.71 + bi * 1.43;
            const drift = DRIFT_PERIODS[bi % DRIFT_PERIODS.length];

            // Drift: each blob wanders using sin/cos at unique phases
            const driftX = Math.sin(t / drift.x + blobSeed) * colorRadius * DRIFT_AMOUNT;
            const driftY = Math.cos(t / drift.y + blobSeed * 0.7) * colorRadius * DRIFT_AMOUNT;

            // Breathe: radius pulses slowly
            const breathePeriod = BREATHE_PERIODS[bi % BREATHE_PERIODS.length];
            const breathe = 1 + Math.sin(t / breathePeriod + blobSeed * 1.3) * BREATHE_AMOUNT;
            const blobRadius = (colorRadius / BLOBS_PER_COLOR * 1.8) * breathe;

            const bx = screenX + driftX;
            const by = screenY + driftY;

            // Alpha per blob — divide among blobs so total doesn't blow out
            const alpha = baseAlpha / BLOBS_PER_COLOR * 1.5;

            const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, blobRadius);
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
            gradient.addColorStop(0.25, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.7})`);
            gradient.addColorStop(0.55, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.3})`);
            gradient.addColorStop(0.85, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.08})`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(bx - blobRadius, by - blobRadius, blobRadius * 2, blobRadius * 2);
          }
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // runs once — reads state via refs

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          filter: 'blur(50px) saturate(1.6)',
          opacity: 0.85,
          willChange: 'transform',
        }}
      />
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}
