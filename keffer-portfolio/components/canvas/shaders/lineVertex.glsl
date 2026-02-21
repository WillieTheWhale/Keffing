// Line Burst Vertex Shader
// System Design §4.2 - Variable thickness, taper at endpoints, scroll-driven animation

uniform float uTime;
uniform float uScrollProgress;
uniform vec2 uFocalPoint;
uniform vec2 uMousePosition;
uniform float uTransitionPhase;

attribute float aPhase;
attribute float aThickness;
attribute float aIsCyan;
attribute float aCurveT;
attribute vec3 aOrigin;

varying float vOpacity;
varying float vIsCyan;
varying float vCurveT;

// Simplex noise 2D
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec3 pos = position;

  // Taper thickness at endpoints (§4.2.2)
  float taper = sin(aCurveT * 3.14159);
  float thickness = aThickness * taper * 0.003;

  // Apply thickness as normal offset
  pos += normal * thickness;

  // Simplex noise drift animation (§5.4)
  float noiseX = snoise(vec2(pos.x * 2.0, uTime * 0.1 + aPhase)) * 0.02;
  float noiseY = snoise(vec2(pos.y * 2.0, uTime * 0.1 + aPhase + 100.0)) * 0.02;
  pos.x += noiseX;
  pos.y += noiseY;

  // Mouse parallax - shift focal point 5-10% toward cursor (§11.1)
  vec2 mouseOffset = (uMousePosition - vec2(0.5)) * 0.07;
  pos.xy += mouseOffset;

  // Scroll-driven line extension/retraction (§4.2.2)
  float scrollAnim = smoothstep(0.0, 0.3, uScrollProgress + aPhase * 0.1);
  pos = mix(aOrigin, pos, scrollAnim);

  // Transition convergence/explosion (§6.3.2)
  if (uTransitionPhase > 0.0) {
    vec3 convergencePoint = vec3(uFocalPoint, 0.0);
    float converge = smoothstep(0.0, 0.5, uTransitionPhase);
    float explode = smoothstep(0.5, 1.0, uTransitionPhase);
    pos = mix(pos, convergencePoint, converge * (1.0 - explode));
    pos = mix(convergencePoint, pos, explode);
  }

  // Opacity falloff from focal point (§4.2.2)
  float dist = distance(pos.xy, uFocalPoint);
  vOpacity = smoothstep(3.0, 0.0, dist) * taper;
  vOpacity *= scrollAnim;

  vIsCyan = aIsCyan;
  vCurveT = aCurveT;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
