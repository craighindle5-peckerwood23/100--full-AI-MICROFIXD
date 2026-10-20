// Cinematic hologram: anatomical shading + procedural emissive detail.
// Runs on the existing CC BY 3.0 head geometry and preserves morph targets.
export const vertexShader = `
#include <common>
#include <morphtarget_pars_vertex>
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
uniform float time;
uniform float distortionLevel;
void main() {
  #include <morphinstance_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  transformed.x += sin(transformed.y * 24.0 + time * 2.0) * distortionLevel;
  vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
  vPosition = transformed;
  vNormal = normalize(normalMatrix * objectNormal);
  vView = -viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}`;

export const fragmentShader = `
precision highp float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
uniform float time;
uniform float flickerIntensity;
uniform float noiseLevel;
uniform float reveal;
uniform float minimal;
uniform float strictMode;
uniform float blink;
uniform float activity;
uniform vec3 profileColor;
uniform float tintMix;
uniform float opacity;
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453);
}
float strand(float p, float frequency) {
  float phase = p * frequency;
  float width = max(0.024, fwidth(phase) * 1.25);
  return 1.0 - smoothstep(0.0, width, abs(sin(phase * 3.14159265)));
}
void main() {
  vec3 n = normalize(vNormal);
  vec3 eye = normalize(vView);
  float rim = pow(1.0 - abs(dot(n, eye)), 2.7);
  float keyLight = max(dot(n, normalize(vec3(-0.48,0.65,0.58))), 0.0);
  float fillLight = max(dot(n, normalize(vec3(0.72,-0.05,0.5))), 0.0);
  float form = 0.08 + 0.66 * pow(keyLight, 1.1) + 0.18 * fillLight;

  // Retain the six-stage reveal and dissolve rather than swapping assets at boot.
  float height = (vPosition.y + 1.6) / 3.2;
  if (height > reveal * 1.25) discard;
  float forming = smoothstep(0.16, 0.85, reveal);
  if (reveal < 0.8 && hash(floor(vPosition * 95.0)) > forming) discard;

  vec3 cyan = vec3(0.018, 0.77, 1.0);
  vec3 violet = vec3(0.40, 0.16, 0.98);
  vec3 deep = vec3(0.006, 0.026, 0.068);
  vec3 tone = mix(cyan, violet, smoothstep(-1.0, 1.1, vPosition.x) * (1.0 - strictMode * 0.72));
  tone = mix(tone, profileColor, tintMix);

  // Anti-aliased fine circuitry follows the head surface; no flat screen overlay.
  float latitude = strand(vPosition.y + sin(vPosition.x * 6.0) * 0.018, 32.0);
  float longitude = strand(vPosition.x + sin(vPosition.y * 8.0) * 0.014, 23.0);
  float lattice = mix(max(latitude, longitude) * 0.20, 0.0, minimal);
  float signal = pow(0.5 + 0.5 * sin(vPosition.y * 14.0 + vPosition.x * 9.0 - time * (1.0 + activity * 2.0)), 10.0);
  float veins = strand(vPosition.x * 0.65 + vPosition.y * 0.35 + sin(vPosition.z * 7.0 + time * 0.55) * 0.07, 13.0);
  float neural = signal * veins * 0.28 * (0.45 + activity * 0.55);
  float scan = 0.91 + 0.09 * sin(vPosition.y * 155.0 - time * 1.6);
  float twinkle = step(0.996, hash(floor(vPosition * 76.0)));

  // The head remains anatomically legible under the glow.
  vec3 color = deep * (0.42 + form * 0.90);
  color += tone * (form * 0.31 + rim * 1.42 + lattice * 0.56 + neural);
  color += vec3(0.19,0.50,0.78) * pow(keyLight, 5.0) * 0.19;
  color += cyan * twinkle * (0.09 + 0.22 * activity);

  // Eye apertures are tied to the actual facial mesh, never detached sprites.
  float eyes = exp(-pow((abs(vPosition.x) - 0.245) / 0.13, 4.0)
                   -pow((vPosition.y - 0.70) / 0.039, 2.0));
  eyes *= smoothstep(0.25,0.6,vPosition.z) * (1.0 - blink * 0.9);
  color += vec3(0.20, 0.84, 1.0) * eyes * (0.7 + activity * 0.35);
  color += cyan * exp(-abs(height - reveal * 1.25) * 130.0) * 0.48;

  float flicker = 1.0 - max(0.0, sin(time * 3.0)) * flickerIntensity;
  color *= scan * flicker;
  color += tone * hash(floor(vPosition * 150.0) + floor(time * 5.0)) * noiseLevel * 0.12;

  float alpha = clamp(0.58 + 0.28 * form + rim * 0.24 + eyes * 0.11, 0.0, 0.97);
  alpha *= opacity * (0.08 + 0.92 * smoothstep(-1.6, -0.7, vPosition.y));
  gl_FragColor = vec4(color, alpha);
}`;

// A restrained additive back-shell creates silhouette depth without a second model.
export const auraFragmentShader = `
precision highp float;
varying vec3 vNormal;
varying vec3 vView;
uniform vec3 profileColor;
uniform float tintMix;
uniform float haloStrength;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.9);
  vec3 color = mix(vec3(0.04,0.48,0.91), profileColor, tintMix);
  gl_FragColor = vec4(color * (0.28 + rim * 1.15) * haloStrength, rim * 0.24);
}`;
