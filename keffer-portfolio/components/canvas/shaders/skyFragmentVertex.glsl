// Sky Fragment Vertex Shader
// System Design §4.3 - Textured planes with parallax

uniform float uTime;
uniform float uScrollProgress;
uniform float uParallaxFactor;

varying vec2 vUv;
varying float vParallax;

void main() {
  vUv = uv;

  vec3 pos = position;

  // Parallax factor 0.2-0.5x scroll speed (§4.3)
  float parallaxOffset = uScrollProgress * uParallaxFactor * 2.0;
  pos.y += parallaxOffset;

  // Gentle oscillation animation (§4.3)
  float breathe = sin(uTime * 0.3) * 0.02;
  pos.x += breathe;
  pos.y += cos(uTime * 0.2) * 0.015;

  // Slow scale oscillation 0.98x-1.02x (§11.3)
  float scalePulse = 1.0 + sin(uTime * 0.15) * 0.02;
  pos.xy *= scalePulse;

  vParallax = parallaxOffset;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
