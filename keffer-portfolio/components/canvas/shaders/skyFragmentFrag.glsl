// Sky Fragment Fragment Shader
// System Design §4.3 - SDF masking for geometric shapes

uniform sampler2D uTexture;
uniform float uOpacity;
uniform int uMaskType; // 0 = rectangle, 1 = parallelogram, 2 = rounded rect
uniform float uSkewAngle;
uniform float uCornerRadius;
uniform vec2 uMaskSize;

varying vec2 vUv;
varying float vParallax;

// SDF: Rectangle (§Appendix A)
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// SDF: Rounded Rectangle
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// SDF: Parallelogram
float sdParallelogram(vec2 p, float width, float height, float skew) {
  vec2 e = vec2(skew, height);
  vec2 q = (p.y < 0.0) ? -p : p;
  vec2 w = q - e;
  vec2 d = vec2(max(w.x, 0.0), w.y);
  float s = max(-w.x, 0.0);
  q.x -= clamp(q.x, -width, width);
  vec2 v = q - vec2(clamp(q.x, -width, width), e.y);
  float f = clamp((v.x * e.x + v.y * e.y) / dot(e, e), -1.0, 1.0);
  vec2 b = q - e * f;
  return sqrt(min(dot(d, d) + s * s, dot(b, b))) * sign(max(b.y, d.y));
}

void main() {
  // Center UV coordinates for SDF
  vec2 p = (vUv - 0.5) * 2.0;

  float dist;

  if (uMaskType == 0) {
    // Rectangle
    dist = sdBox(p, uMaskSize);
  } else if (uMaskType == 1) {
    // Parallelogram
    dist = sdParallelogram(p, uMaskSize.x, uMaskSize.y, uSkewAngle);
  } else {
    // Rounded rectangle
    dist = sdRoundedBox(p, uMaskSize, uCornerRadius);
  }

  // Sharp mask edge with subtle anti-aliasing
  float mask = 1.0 - smoothstep(-0.01, 0.01, dist);

  // Sample sky texture
  vec4 texColor = texture2D(uTexture, vUv);

  // Apply slight cyan tint overlay (§2.1 --accent-cyan as overlay tint)
  vec3 cyanTint = vec3(0.0, 0.6, 1.0);
  texColor.rgb = mix(texColor.rgb, cyanTint, 0.08);

  gl_FragColor = vec4(texColor.rgb, texColor.a * mask * uOpacity);
}
