// Line Burst Fragment Shader
// System Design §4.2.2 - Color variation, opacity

uniform float uTime;

varying float vOpacity;
varying float vIsCyan;
varying float vCurveT;

void main() {
  // Most lines are black, 10-15% use cyan accent (#0099FF)
  vec3 black = vec3(0.0, 0.0, 0.0);
  vec3 cyan = vec3(0.0, 0.6, 1.0); // #0099FF

  vec3 color = mix(black, cyan, vIsCyan);

  // Subtle opacity variation along curve
  float opacity = vOpacity * (0.6 + 0.4 * sin(vCurveT * 3.14159));

  // Anti-aliasing at edges
  float edgeFade = smoothstep(0.0, 0.05, vCurveT) * smoothstep(1.0, 0.95, vCurveT);
  opacity *= edgeFade;

  gl_FragColor = vec4(color, opacity);
}
