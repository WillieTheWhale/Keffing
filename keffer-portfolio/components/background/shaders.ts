// Background — ALLOY. GLSL.
//
// Two materials in one scene, sharing one depth buffer:
//
// CHROME (from v2, three registers chosen per vertex, aData.z):
//   0  dark liquid chrome — the full sky env: cobalt sky, white-hot horizon,
//      near-black navy ground, softbox strips (e02 / r01)
//   1  white "ice" chrome — NEW in ALLOY: reflects its own structured
//      "white room" env (windows of sky, thin dark mullions, softboxes, one
//      dark horizon line) instead of a lifted copy of the sky (e12 / e06)
//   2  glass — blended pass; fresnel reflection over a frosted refraction
//
// PORCELAIN (v1 CONTOUR's language, in 3D): a flat paper-white body with one
// flat cool shade band (no gradient) and crisp black contours computed per
// pixel — a round tube's true silhouette is found analytically from its
// spine (constant ~1.4 CSS px whatever the distance), flat ribbons and
// plates draw their edges from an edge coordinate, all normalised with
// fwidth. Pressure varies along the run, the shadow side is heavier, the lit
// side has small light gaps, and a broken terminator stroke marks the shade
// band. Kind 3 = porcelain, 4 = solid ink (hairline wires, chips).
//
// The env equirects are composed from the site's sky photos
// (scripts/background/make_env.py, make_env_white.py). Values >= ~0.95
// are boosted into HDR; the bloom pass only ever sees that excess.

export const COMMON = /* glsl */ `
uniform sampler2D uEnv;
uniform sampler2D uEnvW;
uniform float uEnvYaw;
uniform float uTime;
uniform float uPresence;
uniform float uHaze;
uniform vec3 uPaper;
uniform float uHot;
uniform float uBloom;      // 1 = bloom-source pass (HDR excess only)
uniform float uRipple;

vec3 yaw(vec3 r, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * r.x + s * r.z, r.y, -s * r.x + c * r.z);
}
vec3 pitch(vec3 r, float a) {
  float c = cos(a), s = sin(a);
  return vec3(r.x, c * r.y + s * r.z, -s * r.y + c * r.z);
}
vec2 eqUV(vec3 r) {
  return vec2(0.5 + atan(r.x, r.z) * 0.15915494, 0.5 + asin(clamp(r.y, -1.0, 1.0)) * 0.31830989);
}
vec3 envLod(vec3 r, float lod) {
  return textureLod(uEnv, eqUV(yaw(r, uEnvYaw)), lod).rgb;
}
vec3 envWLod(vec3 r, float lod) {
  return textureLod(uEnvW, eqUV(yaw(r, uEnvYaw * 0.7)), lod).rgb;
}
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
                 mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                 mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// identity below 0.78, soft shoulder to 1
vec3 shoulder(vec3 c) {
  vec3 k = 0.78 + 0.22 * (1.0 - exp(-(c - 0.78) / 0.22));
  return mix(c, k, step(0.78, c));
}
float printGrain() {
  return fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}
`;

const MASKS = /* glsl */ `
uniform vec4 uMasks[4];  // text blocks in device px (x0, y0, x1, y1), gl_FragCoord space
uniform vec4 uMaskAmt;
uniform float uNameSoft; // falloff px
float boxMask(vec4 b) {
  vec2 p = gl_FragCoord.xy;
  vec2 c = 0.5 * (b.xy + b.zw);
  vec2 hs = 0.5 * (b.zw - b.xy);
  vec2 q = abs(p - c) - hs;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return 1.0 - smoothstep(-uNameSoft * 0.3, uNameSoft, d);
}
// anything passing behind the name / section headings is pulled toward white
float nameMask() {
  return max(max(boxMask(uMasks[0]) * uMaskAmt.x, boxMask(uMasks[1]) * uMaskAmt.y),
             max(boxMask(uMasks[2]) * uMaskAmt.z, boxMask(uMasks[3]) * uMaskAmt.w));
}
`;

const VARYINGS = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
centroid varying vec4 vData;
varying vec3 vWax;
varying vec3 vHax;
varying vec4 vProf;
varying vec3 vAxis;
varying float vHalf;
`;

/** Ribbons and tubes: static merged geometry, sway in the vertex shader. */
export const RIBBON_VERT = /* glsl */ `
attribute vec4 aData;
attribute float aSway;
attribute vec3 aW;
attribute vec3 aH;
attribute vec4 aProf;
attribute vec3 aAxis;
uniform float uTime;
uniform float uSwayAmp;
uniform float uSwayVel;
${VARYINGS}
vec3 swayOf(vec3 p, float w, float ph) {
  return w * vec3(
    sin(uTime * 0.37 + p.y * 0.9 + ph),
    sin(uTime * 0.29 + p.x * 0.7 + ph * 1.3),
    sin(uTime * 0.23 + p.z * 0.8 + ph * 0.7)) * 0.06;
}
void main() {
  float w = aSway * (uSwayAmp + uSwayVel);
  float ph = aData.w * 6.2831;
  vec3 p = position + swayOf(position, w, ph);
  vec3 ax = aAxis + swayOf(aAxis, w, ph);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vWax = mat3(modelMatrix) * aW;
  vHax = mat3(modelMatrix) * aH;
  vProf = aProf;
  vData = aData;
  vAxis = (modelMatrix * vec4(ax, 1.0)).xyz;
  vHalf = aProf.x * length(vWax);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Splinters / droplets: one small blade, many instances, slow tumble. */
export const SHARD_VERT = /* glsl */ `
attribute vec4 aData;
attribute vec3 iPos;
attribute vec4 iQuat;
attribute vec3 iScale;
attribute vec4 iMeta;   // kind, seed, spin, drift
uniform float uTime;
${VARYINGS}
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
void main() {
  float ang = iMeta.y * 6.2831 + uTime * iMeta.z;
  vec3 p = rotX(position * iScale, ang);
  vec3 n = rotX(normal / iScale, ang);
  p = qrot(iQuat, p);
  n = qrot(iQuat, n);
  vec3 drift = qrot(iQuat, vec3(1.0, 0.0, 0.0)) * sin(uTime * 0.11 + iMeta.y * 40.0) * iMeta.w;
  vec4 wp = modelMatrix * vec4(p + iPos + drift, 1.0);
  vW = wp.xyz;
  vObj = position * iScale + iPos;
  vN = normalize(mat3(modelMatrix) * n);
  vWax = vec3(0.0);
  vHax = vec3(0.0);
  vProf = vec4(0.0, 0.0, -3.0, 1.0);
  vData = vec4(aData.x, aData.y, iMeta.x, iMeta.y);
  vAxis = wp.xyz;
  vHalf = 0.0;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// slope f'(x) of the cross-section strip (see geometry.ts profileStrips)
const DPROF = /* glsl */ `
float dprof(float x, float id, float bow, float side) {
  float q = max(1.0 - x * x, 0.035);
  if (id < 0.5) return -2.0 * x * side;
  if (id < 1.5) return side > 0.0 ? -2.5 * x : 0.36 * x;
  if (id < 2.5) { float sq = sqrt(q); return side * 0.75 * ((-x / sq) * (1.0 - x) - sq); }
  if (id < 3.5) return -2.0 * bow * x - side * 1.6 * x * pow(q, -0.2);
  float c1 = 0.5 * bow * 2.890265 * cos(2.890265 * x) - 0.5 * bow * x;
  return c1 - side * 0.72 * x * pow(q, -0.4);
}
vec3 profNormal() {
  float side = vProf.w > 0.0 ? 1.0 : -1.0;
  float x = clamp(vData.y, -0.999, 0.999);
  float fp = dprof(x, vProf.z, vProf.y, side);
  vec2 nl = side * vec2(-fp * vProf.x, 1.0);
  return normalize(nl.x * normalize(vWax) + nl.y * normalize(vHax));
}
`;

export const CHROME_FRAG = /* glsl */ `
${COMMON}
${VARYINGS}
${MASKS}
${DPROF}
uniform float uTiltDark;
uniform float uTiltWhite;
uniform float uFrost;

// HDR boost mask from a blurred lookup: the boost never amplifies texel noise
float hotMask(vec3 rr) {
  vec3 b = envLod(rr, 2.2);
  return smoothstep(0.78, 0.95, max(b.r, max(b.g, b.b)));
}
vec3 darkChrome(vec3 r, float fres) {
  vec3 rr = pitch(r, uTiltDark);
  vec3 col = envLod(rr, 0.0);
  float m = max(col.r, max(col.g, col.b));
  col *= 1.0 + uHot * hotMask(rr) * smoothstep(0.6, 0.9, m);
  col = pow(col, vec3(1.12)) * vec3(0.95, 0.97, 1.0);
  return col * mix(0.78, 1.0, fres);
}
vec3 whiteChrome(vec3 r) {
  // ice chrome reflecting the white room: sky in the windows, thin dark
  // mullions, white-hot softboxes, one dark horizon line (e12 / e06)
  vec3 rr = pitch(r, uTiltWhite);
  vec3 col = envWLod(rr, 0.15);
  vec3 bl = envWLod(rr, 2.4);
  float hot = smoothstep(0.9, 0.975, max(bl.r, max(bl.g, bl.b)));
  return col * (1.0 + uHot * 0.4 * hot);
}
// behind type: a calm, nearly white reflection with only a hint of the sky
vec3 paleChrome(vec3 r) {
  vec3 rr = pitch(r, uTiltWhite);
  vec3 bl = envWLod(rr, 3.5);
  float l = dot(bl, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(0.93, 0.94, 0.955), bl, 0.18) + (l - 0.8) * 0.05;
}

void main() {
  vec3 n;
  if (vProf.z > -0.5) n = profNormal();
  else n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vW - cameraPosition);
  // liquid imperfection: low-frequency ripples stuck to the surface
  vec3 q = vObj * 2.3 + vec3(0.0, 0.0, vData.w * 13.0);
  vec3 rip = vec3(vnoise(q), vnoise(q + 17.3), vnoise(q + 31.7)) - 0.5;
  n = normalize(n + rip * uRipple);
  float ndv = clamp(dot(n, -v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0);
  vec3 r = reflect(v, n);
  float kind = vData.z;
  vec3 col;
  float alpha = 1.0;
  float nm = nameMask();

  if (kind < 1.5) {
    float w = kind;
    if (w < 0.01) col = darkChrome(r, fres);
    else if (w > 0.99) col = whiteChrome(r);
    else col = mix(darkChrome(r, fres), whiteChrome(r), w);
    if (nm > 0.001) col = mix(col, paleChrome(r), nm);
  } else {
    // glass: an almost clear body, fresnel rims that reflect the sky, and a
    // crisp contour line along the knife edges (e01 / e02 ghosted traces)
    vec3 refl = envLod(pitch(r, uTiltWhite), 0.4);
    vec3 tr = refract(v, n, 0.70);
    vec3 tg = refract(v, n, 0.68);
    vec3 tb = refract(v, n, 0.66);
    float lod = uFrost;
    vec3 j1 = vec3(0.006, 0.0, 0.0), j2 = vec3(0.0, 0.006, 0.0);
    vec3 refr = vec3(envLod(pitch(tr, 0.5), lod).r, envLod(pitch(tg, 0.5), lod).g, envLod(pitch(tb, 0.5), lod).b) * 0.4;
    refr += envLod(pitch(normalize(tg + j1), 0.5), lod) * 0.15;
    refr += envLod(pitch(normalize(tg - j1), 0.5), lod) * 0.15;
    refr += envLod(pitch(normalize(tg + j2), 0.5), lod) * 0.15;
    refr += envLod(pitch(normalize(tg - j2), 0.5), lod) * 0.15;
    refr = 0.78 + 0.26 * mix(vec3(dot(refr, vec3(0.33))), refr, 0.7);
    vec3 tint = vec3(0.90, 0.95, 1.0);
    float f = 0.05 + 0.95 * fres;
    col = mix(refr * tint, refl, f);
    float hot = hotMask(pitch(r, uTiltWhite)) * f;
    col *= 1.0 + uHot * 0.9 * hot;
    float e = 1.0 - abs(vData.y);
    float fw = max(fwidth(vData.y), 1e-4);
    float rim = 1.0 - smoothstep(fw * 0.8, fw * 2.6, e);
    col = mix(col, vec3(0.08, 0.11, 0.18), rim * 0.62 * (1.0 - 0.7 * nm));
    alpha = clamp(0.07 + 0.8 * f + 0.6 * rim + 0.3 * hot, 0.0, 1.0) * (1.0 - 0.5 * nm);
  }

  col = mix(col, uPaper, uHaze);
  alpha *= uPresence;

  if (uBloom > 0.5) {
    vec3 ex = max(col - 1.0, 0.0) * (1.0 - nm);
    gl_FragColor = vec4(ex * alpha, 0.0);
    return;
  }
  vec3 outc = toSRGB(shoulder(col));
  outc += printGrain() * 0.035;
  gl_FragColor = vec4(outc * alpha, alpha);
}
`;

export const PORCELAIN_FRAG = /* glsl */ `
${COMMON}
${VARYINGS}
${MASKS}
${DPROF}
uniform float uDpr;
uniform float uLineW;      // CSS px
uniform vec3 uLight;       // world light direction (toward the light)
uniform vec3 uPaperS;      // paper, sRGB

const vec3 BODY = vec3(0.988, 0.988, 0.981);
const vec3 SHADE = vec3(0.862, 0.872, 0.893);
const vec3 INK = vec3(0.066, 0.068, 0.078);

float lineCov(float d, float w) {
  return 1.0 - smoothstep(w - 0.55, w + 0.55, d);
}

void main() {
  float kind = vData.z;
  float nm = nameMask();
  vec3 v = normalize(vW - cameraPosition);
  if (uBloom > 0.5) { gl_FragColor = vec4(0.0); return; }

  if (kind > 3.5) {
    // solid ink: hairline wires, chips
    vec3 c = mix(INK, vec3(0.62, 0.63, 0.66), nm * 0.85);
    c = mix(c, uPaperS, uHaze);
    gl_FragColor = vec4(c * uPresence, uPresence);
    return;
  }

  float pid = vProf.z;
  vec3 n;
  float edgeD = 1e4;
  bool tubeBody = false;
  if (pid < -2.5) {
    // instanced splinter blade: lens profile along x, edge coordinate across
    n = normalize(vN);
    float x = vData.y;
    edgeD = (1.0 - abs(x)) / max(fwidth(x), 1e-5);
  } else if (pid < -1.5) {
    // plate / cap: flat, edge coordinate 0 at the centre .. 1 at the rim
    n = normalize(vN);
    float e = vData.y;
    edgeD = (1.0 - e) / max(fwidth(e), 1e-5);
  } else if (pid < -0.5) {
    // round / oval tube: the true silhouette, from the spine
    tubeBody = true;
    n = normalize(vN);
    vec3 Wa = normalize(vWax), Ha = normalize(vHax);
    vec3 T = normalize(cross(Wa, Ha));
    vec3 sd = cross(T, v);
    float sl = length(sd);
    if (sl > 1e-3) {
      sd /= sl;
      float a = dot(sd, Wa), b = dot(sd, Ha) * vProf.y;
      float sup = vHalf * sqrt(a * a + b * b);
      float s = dot(vW - vAxis, sd) / max(sup, 1e-6);
      edgeD = (1.0 - abs(s)) / max(fwidth(s), 1e-5);
    }
  } else {
    // flat porcelain ribbon: analytic profile normal, edges from the across coordinate
    n = profNormal();
    float x = vData.y;
    edgeD = (1.0 - abs(x)) / max(fwidth(x), 1e-5);
  }
  if (!gl_FrontFacing) n = -n;
  float ndv = dot(n, -v);
  // n·v silhouette as a second opinion (lens ribbons seen edge-on, caps)
  float silD = abs(ndv) / max(fwidth(ndv), 1e-5) * 0.5;
  if (!tubeBody) edgeD = min(edgeD, silD);

  // flat shade band (one tone, no gradient)
  float ndl = dot(n, normalize(uLight));
  float fwl = max(fwidth(ndl), 1e-4);
  const float SHADE_T = -0.08;
  // flat plates (shards) only take the shade tone when turned well away: most
  // read as white cut paper with a drawn edge (r04)
  float st = pid < -1.5 && pid > -2.5 ? -0.42 : SHADE_T;
  float band = smoothstep(-fwl, fwl, st - ndl);
  vec3 col = mix(BODY, SHADE, band * (1.0 - 0.75 * nm));

  // contour weight: pressure along the run, heavier in shadow, light gaps on the lit side
  float px = uLineW * uDpr;
  float pr = 0.78 + 0.44 * vnoise(vObj * 3.1 + vData.w * 17.0);
  float lit = smoothstep(-0.1, 0.35, ndl);
  float w = px * pr * mix(1.22, 0.86, lit);
  float gap = smoothstep(0.66, 0.74, vnoise(vObj * 7.3 + vData.w * 5.0)) * lit;
  w *= 1.0 - 0.85 * gap;
  float ink = lineCov(edgeD, w);

  // broken terminator stroke where the shade band begins (tubes only)
  if (tubeBody) {
    float td = abs(ndl - SHADE_T) / fwl;
    float gate = smoothstep(0.52, 0.6, vnoise(vObj * 4.2 + vData.w * 9.0 + 3.0));
    ink = max(ink, lineCov(td, px * 0.42) * gate * 0.85);
  }
  ink *= 1.0 - 0.82 * nm;
  col = mix(col, INK, ink);
  col = mix(col, uPaperS, uHaze);
  col += printGrain() * 0.022;
  gl_FragColor = vec4(col * uPresence, uPresence);
}
`;

/** Graphite smudge: a textured plane inside the mass (darkness texture). */
export const GRAPHITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GRAPHITE_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uPresence;
uniform float uBloom;
${MASKS}
varying vec2 vUv;
void main() {
  if (uBloom > 0.5) { gl_FragColor = vec4(0.0); return; }
  float d = texture2D(uTex, vUv).r;
  // pencil: light pressure stays grainy, heavy pressure goes near-solid
  d = clamp(pow(d, 0.82) * 1.12, 0.0, 1.0);
  float a = d * uAlpha * uPresence * (1.0 - 0.9 * nameMask());
  vec3 g = vec3(0.13, 0.135, 0.15);
  gl_FragColor = vec4(g * a, a);
}
`;

// ─── The mirror (Dive) ────────────────────────────────────
// A broad liquid-chrome sheet, ray-traced analytically in a full-screen pass:
// a plane with a crescent outline whose rim rolls away like the edge of a
// liquid drop, carrying travelling ripples. It writes depth, so it sits in
// the scene (blades in front of it occlude it). Its interior reflects the
// end-card sky as a planar reflection (distorted by the ripples and the
// sheet's curvature); its rim reflects the chrome env. As the sheet faces the
// camera, unfurls past the frame and the ripples settle, the canvas becomes
// exactly the end-card sky.

export const MIRROR_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uSky;
uniform float uSkyAspect;
uniform vec2 uRes;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uViewProj;
uniform mat4 uView;
uniform vec3 uCamPos;
uniform vec3 uMC;
uniform vec3 uMU;
uniform vec3 uMV;
uniform vec3 uMN;
uniform vec2 uMSize;
uniform float uWidth;
uniform float uBow;
uniform float uGrow;
uniform float uRippleAmp;
uniform float uMirror;
uniform float uCurv;
uniform float uTiltDark;
uniform float uFull;      // 1: nothing else drawn, skip depth
uniform float uMirTilt;   // the mirror looks up into the sky dome
uniform float uBreath;    // a breath on the glass behind the end card's type
uniform vec2 uDrift;
varying vec2 vUv;

float shapeF(vec2 q) {
  float x = q.x;
  float hw = uWidth * pow(max(1.0 - x * x, 0.0), 0.7);
  float yc = uBow * (1.0 - x * x);
  return abs(q.y - yc) - hw + max(abs(x) - 1.0, 0.0);
}
vec2 coverUV(vec2 s) {
  float ra = uRes.x / uRes.y;
  vec2 k = ra > uSkyAspect ? vec2(1.0, uSkyAspect / ra) : vec2(ra / uSkyAspect, 1.0);
  return (s - 0.5) * k + 0.5;
}
float hotMaskM(vec3 rr) {
  vec3 b = envLod(rr, 2.2);
  return smoothstep(0.78, 0.95, max(b.r, max(b.g, b.b)));
}

void main() {
  vec2 suv = gl_FragCoord.xy / uRes;
  vec2 ndc = suv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp /= vp.w;
  vec3 dir = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
  float den = dot(dir, uMN);
  if (abs(den) < 1e-5) discard;
  float t = dot(uMC - uCamPos, uMN) / den;
  if (t <= 0.0) discard;
  vec3 hit = uCamPos + dir * t;
  vec2 q = vec2(dot(hit - uMC, uMU), dot(hit - uMC, uMV)) / uMSize;
  q /= uGrow;
  float f = shapeF(q);
  float aa = max(fwidth(f), 1e-5);
  float cover = 1.0 - smoothstep(-aa, aa, f);
  if (cover < 0.002) discard;

  // rim: the surface rolls away toward the outline (liquid edge)
  float e = 0.004;
  vec2 g = vec2(shapeF(q + vec2(e, 0.0)) - shapeF(q - vec2(e, 0.0)), shapeF(q + vec2(0.0, e)) - shapeF(q - vec2(0.0, e)));
  vec2 gd = g / max(length(g), 1e-5);
  float rimW = 0.16 + 0.1 * uWidth;
  float rho = smoothstep(-rimW, 0.0, f);
  float tilt = 2.6 * pow(rho, 1.7);
  // gentle overall curvature + travelling ripples (decay as the sheet settles)
  vec2 qq = q * uGrow;
  vec2 rg = vec2(0.0);
  rg += vec2(0.8, 0.35) * cos(dot(qq, vec2(0.8, 0.35)) * 9.0 - uTime * 0.9);
  rg += vec2(-0.3, 0.9) * cos(dot(qq, vec2(-0.3, 0.9)) * 13.0 - uTime * 1.3 + 1.7);
  rg += vec2(0.55, -0.7) * cos(dot(qq, vec2(0.55, -0.7)) * 21.0 - uTime * 1.7 + 4.1) * 0.5;
  rg *= uRippleAmp;
  vec2 cv = qq * uCurv;
  vec3 n = normalize(uMN + (gd.x * uMU + gd.y * uMV) * tilt - (rg.x + cv.x) * uMU - (rg.y + cv.y) * uMV);
  if (dot(n, -dir) < 0.0) n = -n;

  vec3 r = reflect(dir, n);
  float ndv = clamp(dot(n, -dir), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0);
  vec3 rr = pitch(r, mix(uMirTilt, uTiltDark, rho));
  vec3 env = envLod(rr, 0.0);
  float m = max(env.r, max(env.g, env.b));
  env *= 1.0 + uHot * hotMaskM(rr) * smoothstep(0.6, 0.9, m);
  env = pow(env, vec3(1.12)) * vec3(0.95, 0.97, 1.0) * mix(0.78, 1.0, fres);

  // planar reflection of the end-card sky, displaced by the surface normal
  vec3 nv = mat3(uView) * n;
  vec3 nv0 = mat3(uView) * uMN;
  vec2 off = (nv.xy - nv0.xy) * 0.32;
  // (the sky texture is decoded to linear by the sampler; toSRGB restores
  // the image exactly, so the settled frame IS the end-card photograph)
  vec3 sky = toSRGB(textureLod(uSky, coverUV(suv + off + uDrift), 0.0).rgb);
  if (uBreath > 0.0) {
    vec2 bq = (suv - vec2(0.5, 0.5)) / vec2(0.36, 0.3);
    sky = mix(sky, vec3(0.93, 0.94, 0.955), uBreath * exp(-dot(bq, bq) * 1.6));
  }
  float ws = uMirror * (1.0 - rho) * (1.0 - fres * 0.6);
  vec3 outc = mix(toSRGB(shoulder(env)), sky, ws);
  outc += printGrain() * 0.03 * (1.0 - uFull * 0.4);
  if (uFull < 0.5) {
    vec4 clip = uViewProj * vec4(hit, 1.0);
    gl_FragDepth = clamp((clip.z / clip.w) * 0.5 + 0.5, 0.0, 1.0);
  } else {
    gl_FragDepth = 0.0;
  }
  gl_FragColor = vec4(outc * cover, cover);
}
`;

// ─── Bloom (speculars only) ───────────────────────────────

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const BLUR_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb * 0.2270270;
  c += texture2D(uSrc, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(uSrc, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(uSrc, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture2D(uSrc, vUv - uDir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec3 g = texture2D(uB, vUv).rgb * uStrength;
  g = 1.0 - exp(-g);
  float a = clamp(max(g.r, max(g.g, g.b)), 0.0, 1.0);
  gl_FragColor = vec4(g, a);
}
`;
