"use client";

/**
 * BrainVisual3D — procedural, fully self-hosted 3D brain hero visual.
 *
 * No external model files, no CDN hotlinks, no licensing risk: the brain is a
 * deliberately LOW-POLY "polygon brain" — a coarsely-triangulated, flat-shaded
 * faceted ovoid (the surface keeps its two hemispheres, central longitudinal
 * fissure, temporal lobes and cerebellum silhouette) with a per-facet color
 * gradient, a thin triangulated wireframe on top, a fresnel rim glow in the
 * Brainstorm palette, and additive neural "pathway" loops + scattered energy
 * particles. It is lazy-loaded (see CentralBrainVisual) so Three.js never blocks
 * first paint or bloats the bundle for non-splash pages.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

type BrainState = "focus" | "stress" | "sleep";

// `lo`/`hi` are the endpoints of the per-facet color ramp (the low-poly brain's
// panels steps through discrete shades between them so each facet reads as a
// distinct polygon). `rim` is the fresnel edge glow; `scatter` the particles.
const STATE_COLORS: Record<BrainState, { rim: string; scatter: string; lo: string; hi: string }> = {
  focus: { rim: "#0EA5C8", scatter: "#22D3EE", lo: "#123A5C", hi: "#3FD6E6" },
  stress: { rim: "#E8474D", scatter: "#F87171", lo: "#3A1424", hi: "#FF8A74" },
  sleep: { rim: "#7C5FEA", scatter: "#A78BFA", lo: "#2A1B5E", hi: "#AD94F7" },
};

/* -------------------------------------------------------------------------
 * Deterministic 3D Perlin noise (public-domain algorithm). The permutation
 * table is generated at module load from a fixed seed so it is stable and
 * needs no pasted constant tables.
 * ----------------------------------------------------------------------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM = (() => {
  const rand = mulberry32(20260816);
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 256; i < 512; i++) p[i] = p[i - 256];
  return p;
})();

function fadeF(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerpF(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function gradUM(h: number, x: number, y: number, z: number) {
  const w = h & 15;
  const u = w < 8 ? x : y;
  const v = w < 4 ? y : w === 12 || w === 14 ? x : z;
  return ((w & 1) ? -u : u) + ((w & 2) ? -v : v);
}
function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const Z = Math.floor(z);
  x -= X;
  y -= Y;
  z -= Z;
  const u = fadeF(x);
  const v = fadeF(y);
  const w = fadeF(z);
  const A = (PERM[X & 255] + (Y & 255)) & 255;
  const AA = (PERM[A] + (Z & 255)) & 255;
  const AB = (PERM[A + 1] + (Z & 255)) & 255;
  const B = (PERM[(X & 255) + 1] + (Y & 255)) & 255;
  const BA = (PERM[B] + (Z & 255)) & 255;
  const BB = (PERM[B + 1] + (Z & 255)) & 255;
  return lerpF(
    w,
    lerpF(
      v,
      lerpF(u, gradUM(PERM[AA], x, y, z), gradUM(PERM[BA], x - 1, y, z)),
      lerpF(u, gradUM(PERM[AB], x, y - 1, z), gradUM(PERM[BB], x - 1, y - 1, z))
    ),
    lerpF(
      v,
      lerpF(u, gradUM(PERM[AA + 1], x, y, z - 1), gradUM(PERM[BA + 1], x - 1, y, z - 1)),
      lerpF(u, gradUM(PERM[AB + 1], x, y - 1, z - 1), gradUM(PERM[BB + 1], x - 1, y - 1, z - 1))
    )
  );
}

/** Layered fBm so the surface gets both broad lobes and fine gyri. */
function fbm3(x: number, y: number, z: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / norm;
}

/* ---------------------------------------------------------------------------
 * Anisotropic fBm — samples each noise axis at a different frequency so the
 * features get *stretched* along one direction. Real gyri (the folding ridges)
 * run in loosely parallel front-to-back tracts rather than isotropic blobs,
 * so when we keep the z (anterior-posterior) frequency lower than x/y the
 * noise ridges elongate along z and read as directional sulci/gyri folds.
 * ------------------------------------------------------------------------- */
function fbmAniso(
  x: number,
  y: number,
  z: number,
  octaves: number,
  sx: number,
  sy: number,
  sz: number
): number {
  let amp = 0.5;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x * freq * sx, y * freq * sy, z * freq * sz);
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / norm;
}

function smoothstepE(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Smooth falloff centred on a unit direction `c` on the sphere (dot≈cosθ). */
function gaussAround(
  dir: THREE.Vector3,
  cx: number,
  cy: number,
  cz: number,
  sharp: number
): number {
  const d = dir.x * cx + dir.y * cy + dir.z * cz;
  return Math.exp(-sharp * (1 - d));
}

/* A rough brain radius before lobe shaping / noise. */
const BASE_R = 1.62;
/*
 * Ellipsoid silhouette — the primitive is a unit icosphere, so these factors
 * define the gross ovoid. A real brain is LONGER anterior→posterior (front↔back)
 * than it is wide, and noticeably TALLER than a sphere at the same length —
 * i.e. an elongated ovoid, NOT a near-perfect ball. z is the front-back axis
 * here (longest + x lateral + y superior). Setting z longest and y shortest
 * means every rotation (front, 3/4, or side) reads as a slim ovoid, never a
 * round ball.
 */
const ELL = new THREE.Vector3(1.14, 0.88, 1.24);

/**
 * Lobe shaping — purely the *silhouette* of the brain before any surface
 * noise. Each term is a smooth gaussian-on-the-sphere falloff that nudges the
 * local radius up (bulge) or down (indent) so the outline reads as a brain
 * (frontal pole, two hanging temporal crops, occipital tip) not an egg.
 */
function lobeShape(dir: THREE.Vector3): number {
  let s = 0;

  // Frontal lobe — broad rounded anterior bulge (+z). Slightly up-biased.
  s += gaussAround(dir, 0, 0.06, 0.99, 3.2) * 0.09;

  // Temporal lobes — the single strongest "this is a brain" cue: an out-and-down
  // rounded crop on each hemisphere, ~1/3 up from the bottom, tapering to a
  // temporal pole (round tip). Centres are mirrored across the sagittal plane.
  // Sharpness 9 keeps the bump broad enough to read as a temporal bulge rather
  // than a narrow spike; amplitude is deliberately sizeable so the lobes are a
  // visible bump on the lower sides, not lost in noise.
  const wTR = gaussAround(dir, 0.9, -0.18, 0.28, 9);
  const wTL = gaussAround(dir, -0.9, -0.18, 0.28, 9);
  s += (wTR + wTL) * 0.2;

  // Occipital lobe — gentle posterior rounding/taper (-z), slightly low.
  s += gaussAround(dir, 0, -0.1, -0.99, 5.5) * 0.05;

  return s;
}

/**
 * Longitudinal fissure (interhemispheric groove): a narrow, sharp dent along
 * the sagittal plane (x=0) that is deep at the superior (top) surface and
 * tapers to shallow near the base — distinct, clearly separated hemispheres.
 */
function fissureDisp(nx: number, ny: number): number {
  const groove = Math.exp(-(nx * nx) / 0.02); // narrower/sharp cutting edge
  const taper = 0.12 + 0.88 * smoothstepE(-0.55, 1.0, ny); // deep top → shallow base
  return groove * taper * 0.34;
}

/**
 * Two-layer cortical folds applied AFTER lobe shaping:
 *   - low frequency (3 octaves): the broad valleys/ridges of the cerebrum
 *   - high frequency (2 octaves, small): fine wrinkle detail, kept subtle
 * Both are anisotropic (stretched along z) so folds read as directional gyri.
 */
function gyriNoise(dir: THREE.Vector3): number {
  const nx = dir.x;
  const ny = dir.y;
  const nz = dir.z;
  const low = fbmAniso(nx * 2.4, ny * 2.4, nz * 1.25, 3, 1, 1, 1);
  const high = fbmAniso(nx * 4.6, ny * 4.6, nz * 2.6, 2, 1, 1, 1);
  return low * 0.15 + high * 0.05;
}

/** Cerebrum surface point. `emb` receives the signed displacement (− = groove). */
function surfacePointWithEmboss(
  dir: THREE.Vector3,
  out: THREE.Vector3,
  emb: { v: number }
): THREE.Vector3 {
  const lx = dir.x;
  const ly = dir.y;
  const disp = lobeShape(dir) + gyriNoise(dir) - fissureDisp(lx, ly);
  emb.v = disp;
  const r = BASE_R + disp;
  return out.copy(dir).multiplyScalar(r).multiply(ELL);
}

/** Cerebrum surface point (wrapper for band/particle sampling). */
function surfacePoint(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const emb = { v: 0 };
  return surfacePointWithEmboss(dir, out, emb);
}

/* ---------------------------------------------------------------------- */
const BRAIN_VERTEX = /* glsl */ `
  attribute float aEmboss;
  attribute float aFacet;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vEmboss;
  varying float vFacet;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vEmboss = aEmboss;
    vFacet = aFacet;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BRAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uLo;
  uniform vec3 uHi;
  uniform vec3 uRim;
  uniform vec3 uLight;
  uniform float uRimPower;
  uniform float uRimAmount;
  uniform float uEmbossAmt;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vEmboss;
  varying float vFacet;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uLight);
    float diff = max(dot(N, L), 0.0);
    float fres = pow(1.0 - abs(dot(N, V)), uRimPower);
    // slow neural-energy pulse modulated into the rim
    float pulse = 1.0 + 0.22 * sin(uTime * 1.1);
    // per-facet colour ramp: each flat panel takes one discrete shade between
    // the low and high stops → the gradient "polygon brain" paint job
    vec3 base = mix(uLo, uHi, vFacet);
    // strong key light so every flat polygon panel is clearly separated from its
    // neighbours; keep a healthy ambient floor so back faces don't clip to black
    vec3 color = base * (0.6 + 0.9 * diff);
    // cheap ambient-occlusion cue: darken deep grooves (negative emboss) so
    // the folds have visible depth, not just normal-based shading
    float depth = clamp(-vEmboss, 0.0, 1.0);
    color *= 1.0 - depth * uEmbossAmt * 0.7;
    color += uRim * fres * uRimAmount * pulse;
    color += uRim * diff * 0.05;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const PARTICLE_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (2.2 / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.4 + aPhase));
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

type Disposals = Array<() => void>;

export function BrainVisual3D({
  brainState = "focus",
  className = "",
}: {
  brainState?: BrainState;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const disposals: Disposals = [];
    const dispose = () => {
      for (const d of disposals) d();
      disposals.length = 0;
    };

    let renderer: THREE.WebGLRenderer | null = null;
    // Prefer high-performance; some drivers / software renderers (e.g.
    // SwiftShader headless, low-end GPUs) reject that hint, so retry without
    // it before giving up and showing the static fallback.
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (e1) {
      console.error("[BrainVisual3D] WebGL high-performance ctx failed:", e1);
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch (e2) {
        console.error("[BrainVisual3D] WebGL fallback ctx failed:", e2);
        // WebGL unavailable (headless / very old browser) — static fallback.
        root.classList.add("brain-visual-fallback");
        return dispose;
      }
    }

    renderer = renderer as THREE.WebGLRenderer;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 768;
    // LOW-POLY: coarse triangulation so each facet is a large, readable polygon.
    // detail 3 (lobed cerebrum) ≈ 320 facets; detail 2 on mobile ≈ 180. We want
    // the triangle faces to be visibly flat panels (not a fine curved mesh).
    const detail = small ? 2 : 3;
    const cbDetail = small ? 2 : 3; // cerebellum matches the chunky facet scale
    const particleCount = small ? 150 : 300;
    const bandCount = small ? 5 : 8;

    const colors = STATE_COLORS[brainState];
    const rim = new THREE.Color(colors.rim);
    const scatter = new THREE.Color(colors.scatter);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    camera.position.set(0, 0, 5.6);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);

    const group = new THREE.Group();
    scene.add(group);

    /* ---------------- brain mesh (lobed cerebrum + cerebellum + stem) -- */
    // Cerebrum: lobed, fissured, folded icosahedron.
    const cerebrumGeo = new THREE.IcosahedronGeometry(1, detail);
    const cPos = cerebrumGeo.attributes.position as THREE.BufferAttribute;
    const surfaceSamples: THREE.Vector3[] = [];
    const tmp = new THREE.Vector3();
    const tmpOut = new THREE.Vector3();
    const emb = { v: 0 };
    const cerebrumPos = new Float32Array(cPos.count * 3);
    const embossVals: number[] = new Array(cPos.count);
    for (let i = 0; i < cPos.count; i++) {
      tmp.set(cPos.getX(i), cPos.getY(i), cPos.getZ(i)).normalize();
      surfacePointWithEmboss(tmp, tmpOut, emb);
      cerebrumPos[i * 3] = tmpOut.x;
      cerebrumPos[i * 3 + 1] = tmpOut.y;
      cerebrumPos[i * 3 + 2] = tmpOut.z;
      embossVals[i] = emb.v;
      surfaceSamples.push(tmpOut.clone());
    }

    // Cerebellum: a smaller, distinct, tightly-wrinkled round mass tucked under
    // the posterior-inferior cerebrum. It's a secondary displaced sphere merged
    // into the SAME single geometry, so it shares one material/normal pass.
    const cerebellumGeo = new THREE.IcosahedronGeometry(1, cbDetail);
    const cbP = cerebellumGeo.attributes.position as THREE.BufferAttribute;
    const cbN = cbP.count;
    const CB_SCALE = new THREE.Vector3(0.56, 0.4, 0.52);
    const CB_OFFSET = new THREE.Vector3(0, -1.18, -0.6);
    const cerebellumPos = new Float32Array(cbN * 3);
    const cbEmb = new Float32Array(cbN);
    for (let i = 0; i < cbN; i++) {
      tmp.set(cbP.getX(i), cbP.getY(i), cbP.getZ(i)).normalize();
      // tighter, smaller-amplitude wrinkles than the cerebrum
      const w = fbm3(tmp.x * 5.2, tmp.y * 5.2, tmp.z * 5.2, 3);
      const wr = 1.0 + w * 0.2;
      cerebellumPos[i * 3] = CB_OFFSET.x + tmp.x * CB_SCALE.x * wr;
      cerebellumPos[i * 3 + 1] = CB_OFFSET.y + tmp.y * CB_SCALE.y * wr;
      cerebellumPos[i * 3 + 2] = CB_OFFSET.z + tmp.z * CB_SCALE.z * wr;
      cbEmb[i] = w * 0.12; // small groove depth for AO
      surfaceSamples.push(
        new THREE.Vector3(
          cerebellumPos[i * 3],
          cerebellumPos[i * 3 + 1],
          cerebellumPos[i * 3 + 2]
        )
      );
    }

    // Brainstem/medulla: a short tapered shaft protruding from the underside
    // center — cheap merged geometry, mostly hidden behind the cerebellum.
    const stemGeo = new THREE.CylinderGeometry(0.13, 0.075, 0.55, 10, 1);
    stemGeo.translate(0, -1.82, 0);
    const sPos = stemGeo.attributes.position as THREE.BufferAttribute;
    const sN = sPos.count;
    const stemPos = new Float32Array(sN * 3);
    const stemEmb = new Float32Array(sN);
    for (let i = 0; i < sN; i++) {
      stemPos[i * 3] = sPos.getX(i);
      stemPos[i * 3 + 1] = sPos.getY(i);
      stemPos[i * 3 + 2] = sPos.getZ(i);
      stemEmb[i] = 0;
    }

    // Merge the three sub-meshes into one BufferGeometry so the brain is a
    // single draw call with one material (shared shading/AO pass).
    const totalVerts = cPos.count + cbN + sN;
    const mergedPos = new Float32Array(totalVerts * 3);
    mergedPos.set(cerebrumPos, 0);
    mergedPos.set(cerebellumPos, cPos.count * 3);
    mergedPos.set(stemPos, (cPos.count + cbN) * 3);
    const mergedEmb = new Float32Array(totalVerts);
    mergedEmb.set(embossVals as unknown as number[], 0);
    mergedEmb.set(cbEmb as unknown as number[], cPos.count);
    mergedEmb.set(stemEmb as unknown as number[], cPos.count + cbN);

    // LOW-POLY "POLYGON BRAIN": we deliberately WANT the faceted, flat-shaded
    // panels — this is a stylised aesthetic, not an artifact. So (unlike the Q3
    // smooth pass that deduped to averaged normals) we KEEP the geometry
    // non-indexed, so computeVertexNormals() yields a crisp flat per-face normal
    // for every triangle — each facet is a literal flat polygon. We give each
    // triangle a `aFacet` tint so the panels step through a gradient, then draw
    // the triangle edges as a fine wireframe on top to sell the polygon look.
    const aFacet = new Float32Array(totalVerts);
    // helper: non-indexed triangles live at (i, i+1, i+2) for i = 0,3,6,…
    for (let t = 0; t < totalVerts - 2; t += 3) {
      const ax = mergedPos[t * 3], ay = mergedPos[t * 3 + 1], az = mergedPos[t * 3 + 2];
      const bx = mergedPos[t * 3 + 3], by = mergedPos[t * 3 + 4], bz = mergedPos[t * 3 + 5];
      const cx = mergedPos[t * 3 + 6], cy = mergedPos[t * 3 + 7], cz = mergedPos[t * 3 + 8];
      // face normal via cross product
      const ex = bx - ax, ey = by - ay, ez = bz - az;
      const fx = cx - ax, fy = cy - ay, fz = cz - az;
      let nx = ey * fz - ez * fy;
      let ny = ez * fx - ex * fz;
      let nz = ex * fy - ey * fx;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      nx /= nlen; ny /= nlen; nz /= nlen;
      // gradient driven by panel facing (bottom→top bright), plus a small stable
      // per-face hash so neighbours read as distinct polygons.
      const h = (Math.sin(nx * 127.1 + ny * 311.7 + nz * 74.7) * 43758.5453) % 1;
      const v = Math.min(1, Math.max(0, 0.34 + 0.5 * (0.5 + 0.5 * ny) + 0.16 * (h < 0 ? h + 1 : h)));
      aFacet[t] = aFacet[t + 1] = aFacet[t + 2] = v;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
    geo.setAttribute("aEmboss", new THREE.BufferAttribute(mergedEmb, 1));
    geo.setAttribute("aFacet", new THREE.BufferAttribute(aFacet, 1));
    geo.computeVertexNormals(); // non-indexed → FLAT per-face normals → hard panels

    const mat = new THREE.ShaderMaterial({
      vertexShader: BRAIN_VERTEX,
      fragmentShader: BRAIN_FRAGMENT,
      uniforms: {
        uLo: { value: new THREE.Color(colors.lo) },
        uHi: { value: new THREE.Color(colors.hi) },
        uRim: { value: rim },
        // raking light from the upper-side rakes across the facets so each flat
        // polygon catches a slightly different tone, selling the low-poly planes
        uLight: { value: new THREE.Vector3(-0.7, 0.55, 0.3).normalize() },
        uRimPower: { value: 1.9 },
        uRimAmount: { value: 1.1 },
        uEmbossAmt: { value: 0.5 },
        uTime: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    /* ---------------- triangulated wireframe over the facets --------------- */
    // A fine edge overlay crisply outlines every low-poly triangle — the
    // signature "polygon brain" look. Built from the same vertex soup so its
    // edges land exactly on the facet borders.
    const wireGeo = new THREE.WireframeGeometry(geo);
    const wireMat = new THREE.LineBasicMaterial({
      color: scatter,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    group.add(wire);

    /* ---------------- neural pathway loops on the surface ---------------- */
    const bandVerts: Float32Array = new Float32Array(bandCount * 26 * 3);
    for (let b = 0; b < bandCount; b++) {
      // random orbit axis
      const ya = new THREE.Vector3().set(
        -1 + Math.random() * 2,
        -1 + Math.random() * 2,
        -1 + Math.random() * 2
      ).normalize();
      const base = new THREE.Vector3();
      // orthonormal basis perpendicular to axis
      if (Math.abs(ya.y) < 0.9) base.set(0, 1, 0);
      else base.set(1, 0, 0);
      base.crossVectors(base, ya).normalize();
      const up = new THREE.Vector3().crossVectors(ya, base).normalize();
      const angle = 0.4 + Math.random() * 0.75;
      const temp = new THREE.Vector3();
      for (let k = 0; k < 26; k++) {
        const t = (k / 26) * Math.PI * 2;
        temp
          .copy(ya)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(base, Math.sin(angle) * Math.cos(t))
          .addScaledVector(up, Math.sin(angle) * Math.sin(t));
        surfacePoint(temp.normalize(), temp);
        const idx = (b * 26 + k) * 3;
        bandVerts[idx] = temp.x;
        bandVerts[idx + 1] = temp.y;
        bandVerts[idx + 2] = temp.z;
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(bandVerts, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: scatter,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    // build segment indices to close each loop
    const segIdx: number[] = [];
    for (let b = 0; b < bandCount; b++) {
      for (let k = 0; k < 26; k++) {
        const a0 = b * 26 + k;
        const a1 = b * 26 + ((k + 1) % 26);
        segIdx.push(a0, a1);
      }
    }
    lineGeo.setIndex(segIdx);
    group.add(lineMesh);

    /* ---------------- energy particles hugging the surface --------------- */
    const rand = mulberry32(90210);
    const pPos = new Float32Array(particleCount * 3);
    const pSize = new Float32Array(particleCount);
    const pPhase = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      // resample from the full displaced pool (cerebrum + cerebellum) so the
      // particles hug the real, more complex lobe surface
      const pick = surfaceSamples[Math.floor(rand() * surfaceSamples.length)];
      pPos[i * 3] = pick.x + (rand() - 0.5) * 0.12;
      pPos[i * 3 + 1] = pick.y + (rand() - 0.5) * 0.12;
      pPos[i * 3 + 2] = pick.z + (rand() - 0.5) * 0.12;
      pSize[i] = 5 + rand() * 9;
      pPhase[i] = rand() * Math.PI * 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
    pGeo.setAttribute("aPhase", new THREE.BufferAttribute(pPhase, 1));
    const pMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: {
        uColor: { value: scatter },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    group.add(points);

    /* ---------------- sizing / resize ------------------------------------ */
    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(root);
    }

    /* ---------------- interaction (parallax, not drag) ------------------- */
    let targetX = 0; // pitch
    let targetY = 0; // yaw offset
    let curX = 0;
    let curY = 0;
    const onPointer = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetY = nx * 0.45;
      targetX = ny * 0.35;
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };
    root.addEventListener("pointermove", onPointer);
    root.addEventListener("pointerleave", onLeave);

    /* ---------------- render loop ---------------------------------------- */
    let raf = 0;
    let baseYaw = 0.6;
    const tick = (now: number) => {
      const elapsed = now / 1000;
      baseYaw += 0.0028;
      curX = THREE.MathUtils.lerp(curX, targetX, 0.05);
      curY = THREE.MathUtils.lerp(curY, targetY, 0.05);
      group.rotation.x = curX;
      group.rotation.y = baseYaw + curY;
      mat.uniforms.uTime.value = elapsed;
      pMat.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      // static frame — match reduced-motion accessibility (freeze rotation/pulse)
      group.rotation.set(0.15, 0.9, 0);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(tick);
    }

    disposals.push(() => {
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerleave", onLeave);
      ro?.disconnect();
      cerebrumGeo.dispose();
      cerebellumGeo.dispose();
      stemGeo.dispose();
      geo.dispose();
      mat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
      // NOTE: do NOT call forceContextLoss here. React StrictMode double-mounts
      // effects in dev (mount → cleanup → mount) on the SAME canvas; losing the
      // context poisons the canvas so the second mount's getContext returns null.
      // renderer.dispose() releases GPU resources without killing the canvas.
    });

    return dispose;
  }, [brainState]);

  return (
    <div
      ref={rootRef}
      className={"brain-visual-ink relative h-64 w-64 sm:h-80 sm:w-80 md:h-96 md:w-96 " + className}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full rounded-full" />
    </div>
  );
}