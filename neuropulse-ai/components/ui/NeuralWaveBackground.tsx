"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// NeuralWaveBackground — Full-screen Neural Network Plexus Canvas
//
// Renders a fixed full-screen canvas with:
//   - ~80-100 nodes on desktop, ~30-40 on mobile
//   - Sine-wave displacement for brain-wave ripple effect
//   - Bokeh / depth-of-field blur on distant nodes
//   - Color morphing synced to brain state (Focus/Stress/Sleep)
//   - Connection lines between nearby nodes with glow
//   - Subtle particle drift for organic movement
//
// Moved to the ROOT LAYOUT so it sits behind every route (/, /login, /dashboard,
// /brainprint, /analytics, /ai-consultant). Because data-heavy pages are dense
// with cards/charts/tables, the intensity is toned down there:
//   - "hero"   — full density set on the splash route (pathname === "/")
//   - "subtle" — reduced node count, connection alpha & drift everywhere else
//
// Usage:
//   <NeuralWaveBackground brainState="focus" />
//   brainState controls the color palette: "focus" | "stress" | "sleep"
//   intensity overrides the route-aware default ("hero" | "subtle").
//
// Accessibility: honours prefers-reduced-motion by drawing a single static
// frame instead of animating. It's also paused (rAF cancelled) when the tab is
// hidden (Page Visibility API) so it never fights live waveform charts for CPU.
// ---------------------------------------------------------------------------

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  phase: number;
  z: number; // depth for bokeh (0 = far, 1 = near)
}

type BrainState = "focus" | "stress" | "sleep";
type Intensity = "hero" | "subtle";

const COLORS: Record<BrainState, { r: number; g: number; b: number }> = {
  focus: { r: 6, g: 182, b: 212 },   // cyan
  stress: { r: 239, g: 68, b: 68 },  // red
  sleep: { r: 139, g: 92, b: 246 },  // purple
};

const CONNECTION_DIST = 150;
const CONNECTION_MAX_ALPHA = 0.25;

/** Intensity scalers — kept in refs so a route change re-tunes the running
    loop live without tearing down the canvas. */
function intensityConfig(intensity: Intensity) {
  return intensity === "hero"
    ? { nodeMult: 1, alphaMult: 1, driftMult: 1 }
    : { nodeMult: 0.5, alphaMult: 0.4, driftMult: 0.6 };
}

function getDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return window.innerWidth < 768 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}

function getBaseNodeCount(): number {
  if (typeof window === "undefined") return 80;
  return window.innerWidth < 768 ? 35 : 90;
}

export function NeuralWaveBackground({
  brainState = "focus",
  intensity,
}: {
  brainState?: BrainState;
  intensity?: Intensity;
}) {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const currentColorRef = useRef<{ r: number; g: number; b: number }>(COLORS.focus);

  // Route-aware intensity default: full "hero" only on the splash page, subtle
  // everywhere else. Reads via ref so navigation re-tunes live, not at remount.
  const resolvedIntensity = intensity ?? (pathname === "/" ? "hero" : "subtle");
  const intensityRef = useRef(intensityConfig(resolvedIntensity));

  const initNodes = useCallback((w: number, h: number, nodeMult: number) => {
    const count = Math.max(18, Math.floor(getBaseNodeCount() * nodeMult));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        z: Math.random(),
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = getDevicePixelRatio();
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Fill initial background
    ctx.fillStyle = "#0A0F1D";
    ctx.fillRect(0, 0, w, h);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    initNodes(w, h, intensityRef.current.nodeMult);

    const handleResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      canvas.width = newW * dpr;
      canvas.height = newH * dpr;
      canvas.style.width = newW + "px";
      canvas.style.height = newH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Redraw background on resize
      ctx.fillStyle = "#0A0F1D";
      ctx.fillRect(0, 0, newW, newH);
      initNodes(newW, newH, intensityRef.current.nodeMult);
    };
    window.addEventListener("resize", handleResize);

    let lastTime = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      timeRef.current += dt;
      const t = timeRef.current;
      const cfg = intensityRef.current;

      // Smooth color interpolation (slowed in subtle so it doesn't distract)
      const target = COLORS[brainState];
      const cur = currentColorRef.current;
      const speed = 2 * cfg.driftMult;
      cur.r += (target.r - cur.r) * dt * speed;
      cur.g += (target.g - cur.g) * dt * speed;
      cur.b += (target.b - cur.b) * dt * speed;

      ctx.clearRect(0, 0, w, h);

      // Draw subtle gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, "#0A0F1D");
      bgGrad.addColorStop(0.5, "#0D1525");
      bgGrad.addColorStop(1, "#0A0F1D");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const drift = cfg.driftMult;

      // Update positions with sine wave displacement (scaled by intensity so
      // data-heavy routes drift slower and stay subtle).
      for (const node of nodes) {
        node.x += node.vx + Math.sin(t * 0.8 + node.phase) * 0.3 * drift;
        node.y += node.vy + Math.cos(t * 0.5 + node.phase) * 0.2 * drift;

        // Wrap around edges
        if (node.x < -20) node.x = w + 20;
        if (node.x > w + 20) node.x = -20;
        if (node.y < -20) node.y = h + 20;
        if (node.y > h + 20) node.y = -20;
      }

      // Draw connections (alpha scaled for subtle pages)
      const lineAlphaScale = CONNECTION_MAX_ALPHA * cfg.alphaMult;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * lineAlphaScale;
            const pulse = Math.sin(t * 2 + nodes[i].phase) * 0.5 + 0.5;
            const lineAlpha = alpha * (0.6 + pulse * 0.4);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${Math.round(cur.r)}, ${Math.round(cur.g)}, ${Math.round(cur.b)}, ${lineAlpha})`;
            ctx.lineWidth = nodes[i].z * 1.2;
            ctx.stroke();
          }
        }
      }

      // Draw nodes with bokeh effect
      for (const node of nodes) {
        const pulse = Math.sin(t * 1.5 + node.phase) * 0.5 + 0.5;
        const glow = node.z * (0.7 + pulse * 0.3);
        const r = node.radius * (0.8 + node.z * 0.6);
        const alphaScale = node.baseAlpha * cfg.alphaMult;

        // Bokeh: distant nodes are blurred (larger, more transparent)
        const blurRadius = node.z < 0.3 ? r * 3 : node.z < 0.6 ? r * 2 : r;
        const alpha = alphaScale * glow;

        // Outer glow
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, blurRadius * 3
        );
        gradient.addColorStop(0, `rgba(${Math.round(cur.r)}, ${Math.round(cur.g)}, ${Math.round(cur.b)}, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(${Math.round(cur.r)}, ${Math.round(cur.g)}, ${Math.round(cur.b)}, ${alpha * 0.3})`);
        gradient.addColorStop(1, `rgba(${Math.round(cur.r)}, ${Math.round(cur.g)}, ${Math.round(cur.b)}, 0)`);

        ctx.beginPath();
        ctx.arc(node.x, node.y, blurRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const coreAlpha = Math.min(1, alpha * 1.5);
        ctx.fillStyle = `rgba(${Math.min(255, Math.round(cur.r + 100))}, ${Math.min(255, Math.round(cur.g + 100))}, ${Math.min(255, Math.round(cur.b + 100))}, ${coreAlpha})`;
        ctx.fill();
      }

      if (!reduced) animFrameRef.current = requestAnimationFrame(draw);
    };

    // Single frame for reduced-motion; else keep looping.
    draw(performance.now());

    // Pause the rAF loop entirely while the tab is hidden — the canvas costs
    // nothing then and never competes with backgrounded charts.
    const onVisibility = () => {
      if (document.hidden) {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      } else if (!reduced) {
        lastTime = performance.now();
        draw(performance.now());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [initNodes, brainState]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}