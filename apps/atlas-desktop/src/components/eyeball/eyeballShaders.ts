/**
 * GLSL shaders for advanced eyeball effects.
 *
 * The iris shader uses procedural radial fibre patterns and Fresnel rim
 * lighting to create a realistic, slightly luminous iris appearance.
 */

// ── Iris vertex shader ────────────────────────────────────────
export const irisVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-worldPos.xyz);
    gl_Position = projectionMatrix * worldPos;
  }
`;

// ── Iris fragment shader ──────────────────────────────────────
export const irisFragmentShader = /* glsl */ `
  uniform vec3 uIrisColor;
  uniform float uTime;
  uniform float uDilation;     // 0..1, pupil size
  uniform float uBrightness;   // ambient brightness factor

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  // Simple hash for pseudo-random fibres
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Pupil — hard circle in the center
    float pupilRadius = mix(0.08, 0.22, uDilation);
    float pupilEdge = smoothstep(pupilRadius - 0.01, pupilRadius + 0.01, dist);

    // Radial fibre pattern
    float fibres = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float a = angle + i * 1.047;
      fibres += 0.5 + 0.5 * sin(a * (12.0 + i * 3.0) + uTime * 0.3);
    }
    fibres /= 6.0;

    // Colour rings
    float ring = smoothstep(0.15, 0.35, dist) * smoothstep(0.48, 0.32, dist);
    vec3 irisCol = uIrisColor * (0.6 + 0.4 * fibres) * ring;

    // Fresnel rim glow
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
    vec3 rim = uIrisColor * fresnel * 0.8;

    // Limbal ring (dark outer edge)
    float limbal = smoothstep(0.42, 0.48, dist);
    irisCol *= (1.0 - limbal * 0.7);

    // Compose: pupil (black) → iris → rim
    vec3 col = mix(vec3(0.02), irisCol + rim, pupilEdge);

    // Outer mask — fade to transparent outside iris radius
    float outerMask = 1.0 - smoothstep(0.44, 0.50, dist);

    // Brightness modulation
    col *= mix(0.6, 1.0, uBrightness);

    gl_FragColor = vec4(col, outerMask);
  }
`;

// ── Corneal highlight vertex shader ───────────────────────────
export const cornealVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-worldPos.xyz);
    gl_Position = projectionMatrix * worldPos;
  }
`;

// ── Corneal highlight fragment shader ─────────────────────────
export const cornealFragmentShader = /* glsl */ `
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Specular highlight — Blinn-Phong
    vec3 halfDir = normalize(uLightDir + vViewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 128.0);

    // Fresnel additive for glassy cornea
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 4.0);

    float alpha = (spec * 0.9 + fresnel * 0.15);
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`;
