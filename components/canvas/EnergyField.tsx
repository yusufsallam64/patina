'use client';

import { useRef, useEffect } from 'react';
import { useViewport, useNodes } from '@xyflow/react';
import { usePatinaStore } from '@/lib/store';
import type { PatinaNode } from '@/types';

const MAX_PAIRS = 12;
const MAX_DISTANCE = 1200;
const FALLBACK_COLOR = '#8b5cf6';

// ── Shaders ──────────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform int u_numPairs;
uniform vec2 u_posA[${MAX_PAIRS}];
uniform vec2 u_posB[${MAX_PAIRS}];
uniform vec3 u_colorA[${MAX_PAIRS}];
uniform vec3 u_colorB[${MAX_PAIRS}];
uniform float u_weight[${MAX_PAIRS}];

out vec4 fragColor;

// ── Ashima Arts 3D Simplex Noise ──
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec2 uv = gl_FragCoord.xy;
  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_PAIRS}; i++) {
    if (i >= u_numPairs) break;

    float w = u_weight[i];
    if (w < 0.001) continue;

    vec2 a = u_posA[i];
    vec2 b = u_posB[i];
    vec2 ab = b - a;
    float segLen = length(ab);
    if (segLen < 1.0) continue;

    vec2 dir = ab / segLen;

    // Project pixel onto line segment
    float t = clamp(dot(uv - a, dir) / segLen, 0.0, 1.0);
    vec2 closest = a + dir * t * segLen;
    float d = length(uv - closest);

    // 3 octaves of simplex noise displacement
    float noiseInput = t * segLen * 0.003; // normalize frequency to segment length
    float disp = snoise(vec3(noiseInput * 4.0, float(i) * 1.7, u_time * 0.3)) * 25.0 * w
               + snoise(vec3(noiseInput * 8.0, float(i) * 1.7 + 50.0, u_time * 0.5)) * 12.0 * w
               + snoise(vec3(noiseInput * 16.0, float(i) * 1.7 + 100.0, u_time * 0.7)) * 5.0 * w;

    d = abs(d - disp);

    // Fade at endpoints
    float endFade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);

    // Steeper weight curve — close connections are much brighter
    float sw = w * w * w; // cubic falloff

    // Beam width scales with weight
    float bw = 2.0 + sw * 5.0;

    // Layered glow — stronger for close pairs
    float core  = exp(-d * d / (bw * bw * 4.0))   * 0.8;
    float mid   = exp(-d * d / (bw * bw * 120.0))  * 0.4;
    float bloom  = exp(-d * d / (bw * bw * 700.0)) * 0.15;

    // Color: gradient along beam
    vec3 beamColor = mix(u_colorA[i], u_colorB[i], t);

    // Core is lightly lifted beam color (mostly colored, slight brightness)
    vec3 coreColor = mix(beamColor, vec3(1.0), 0.25);
    vec3 beamContrib = coreColor * core * sw
                     + beamColor * mid * sw
                     + beamColor * bloom * sw;

    col += beamContrib * endFade;
  }

  // Soft tone-map to prevent blowout
  col = col / (1.0 + col);

  fragColor = vec4(col, 1.0);
}
`;

// ── Helpers ──────────────────────────────────────────────────────

function hexToGL(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [0.55, 0.36, 0.96]; // fallback purple
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// ── Component ────────────────────────────────────────────────────

export function EnergyField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const glRef = useRef<{
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    locs: {
      time: WebGLUniformLocation | null;
      resolution: WebGLUniformLocation | null;
      numPairs: WebGLUniformLocation | null;
      posA: WebGLUniformLocation | null;
      posB: WebGLUniformLocation | null;
      colorA: WebGLUniformLocation | null;
      colorB: WebGLUniformLocation | null;
      weight: WebGLUniformLocation | null;
    };
  } | null>(null);

  // Refs to avoid stale closures in animation loop
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<PatinaNode[]>([]);
  const vibeCacheRef = useRef<Record<string, { colors: string[] }>>({});
  const fallbackColorRef = useRef(FALLBACK_COLOR);

  const viewport = useViewport();
  const nodes = useNodes<PatinaNode>();
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const compositeVibe = usePatinaStore((s) => s.compositeVibe);

  // Keep refs current
  viewportRef.current = viewport;
  nodesRef.current = nodes;
  vibeCacheRef.current = vibeCache;
  fallbackColorRef.current = compositeVibe?.color_palette?.dominant?.[0] ?? FALLBACK_COLOR;

  // ── Resize canvas at half resolution ──
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const scale = dpr * 0.5; // half-res
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        if (glRef.current) {
          glRef.current.gl.viewport(0, 0, canvas.width, canvas.height);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── WebGL setup ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.warn('EnergyField: WebGL2 not available');
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    // Full-screen quad
    const quad = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    glRef.current = {
      gl,
      program,
      locs: {
        time: gl.getUniformLocation(program, 'u_time'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        numPairs: gl.getUniformLocation(program, 'u_numPairs'),
        posA: gl.getUniformLocation(program, 'u_posA'),
        posB: gl.getUniformLocation(program, 'u_posB'),
        colorA: gl.getUniformLocation(program, 'u_colorA'),
        colorB: gl.getUniformLocation(program, 'u_colorB'),
        weight: gl.getUniformLocation(program, 'u_weight'),
      },
    };

    // Start animation loop
    let running = true;

    // Pre-allocate typed arrays to avoid GC pressure
    const posAData = new Float32Array(MAX_PAIRS * 2);
    const posBData = new Float32Array(MAX_PAIRS * 2);
    const colorAData = new Float32Array(MAX_PAIRS * 3);
    const colorBData = new Float32Array(MAX_PAIRS * 3);
    const weightData = new Float32Array(MAX_PAIRS);

    function animate(timestamp: number) {
      if (!running) return;
      const ref = glRef.current;
      if (!ref) { rafRef.current = requestAnimationFrame(animate); return; }

      const { gl, locs } = ref;
      const t = timestamp / 1000;

      const { x: panX, y: panY, zoom } = viewportRef.current;
      const currentNodes = nodesRef.current;
      const cache = vibeCacheRef.current;
      const dpr = window.devicePixelRatio || 1;
      const scale = dpr * 0.5;

      // ── Gather visible nodes ──
      const visible: { cx: number; cy: number; id: string }[] = [];
      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];
        if (node.type === 'suggested') continue;
        const w = node.measured?.width ?? 240;
        const h = node.measured?.height ?? 200;
        visible.push({
          cx: node.position.x + w / 2,
          cy: node.position.y + h / 2,
          id: node.id,
        });
      }

      // ── Compute pairs ──
      type Pair = { ai: number; bi: number; dist: number };
      const pairs: Pair[] = [];
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const dx = visible[i].cx - visible[j].cx;
          const dy = visible[i].cy - visible[j].cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DISTANCE) {
            pairs.push({ ai: i, bi: j, dist });
          }
        }
      }

      // Sort by distance, take top pairs
      pairs.sort((a, b) => a.dist - b.dist);
      const numPairs = Math.min(pairs.length, MAX_PAIRS);

      // ── Fill uniform arrays ──
      for (let i = 0; i < numPairs; i++) {
        const pair = pairs[i];
        const a = visible[pair.ai];
        const b = visible[pair.bi];

        // Flow-space → screen-space → half-res canvas space
        const ax = (a.cx * zoom + panX) * scale;
        const ay = (a.cy * zoom + panY) * scale;
        const bx = (b.cx * zoom + panX) * scale;
        const by = (b.cy * zoom + panY) * scale;

        // WebGL has Y=0 at bottom, flip Y
        const canvasH = canvas!.height;
        posAData[i * 2] = ax;
        posAData[i * 2 + 1] = canvasH - ay;
        posBData[i * 2] = bx;
        posBData[i * 2 + 1] = canvasH - by;

        // Absolute distance-based weight: 1.0 when touching, 0.0 at maxDistance
        const weight = Math.max(0, 1 - pair.dist / MAX_DISTANCE);
        weightData[i] = weight;

        const vibeA = cache[a.id];
        const vibeB = cache[b.id];
        const fb = fallbackColorRef.current;
        const cA = hexToGL(vibeA?.colors?.[0] ?? fb);
        const cB = hexToGL(vibeB?.colors?.[0] ?? fb);
        colorAData[i * 3] = cA[0];
        colorAData[i * 3 + 1] = cA[1];
        colorAData[i * 3 + 2] = cA[2];
        colorBData[i * 3] = cB[0];
        colorBData[i * 3 + 1] = cB[1];
        colorBData[i * 3 + 2] = cB[2];
      }

      // ── Upload uniforms & draw ──
      gl.viewport(0, 0, canvas!.width, canvas!.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(locs.time, t);
      gl.uniform2f(locs.resolution, canvas!.width, canvas!.height);
      gl.uniform1i(locs.numPairs, numPairs);

      if (numPairs > 0) {
        gl.uniform2fv(locs.posA, posAData);
        gl.uniform2fv(locs.posB, posBData);
        gl.uniform3fv(locs.colorA, colorAData);
        gl.uniform3fv(locs.colorB, colorBData);
        gl.uniform1fv(locs.weight, weightData);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
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
        style={{ willChange: 'transform' }}
      />
    </div>
  );
}
