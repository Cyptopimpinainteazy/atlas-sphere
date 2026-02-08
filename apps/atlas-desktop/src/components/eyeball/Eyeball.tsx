/**
 * Eyeball.tsx — Three.js scene wrapper component using @react-three/fiber.
 *
 * Renders a high-fidelity eyeball with:
 *  - Sclera (white of the eye) with subtle veining
 *  - Procedural iris with radial fibre GLSL shader
 *  - Animated pupil dilation driven by cursor distance
 *  - Corneal specular reflection following inferred light direction
 *  - Smooth quaternion SLERP gaze tracking toward cursor
 *
 * @example
 * ```tsx
 * <Eyeball />
 * ```
 */
import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  irisVertexShader,
  irisFragmentShader,
  cornealVertexShader,
  cornealFragmentShader,
} from "./eyeballShaders";
import { useEyeballTracking } from "./useEyeballTracking";

/* ── Configuration ─────────────────────────────────────────── */
const EYE_RADIUS = 1.6;
const IRIS_RADIUS = 0.62;
const SEGMENTS = 48;
const IRIS_COLOR = new THREE.Color("#d4740e"); // warm orange-amber

/* ── Inner scene rendered inside the R3F Canvas ────────────── */
function EyeballScene() {
  const tracking = useEyeballTracking({ easing: 0.08 });

  const groupRef = useRef<THREE.Group>(null!);
  const irisMatRef = useRef<THREE.ShaderMaterial>(null!);
  const cornealMatRef = useRef<THREE.ShaderMaterial>(null!);

  // ── Sclera (white of eye) ──────────────────────────────────
  const scleraMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xf5f0eb,
        roughness: 0.35,
        metalness: 0.0,
        envMapIntensity: 0.4,
      }),
    [],
  );

  // ── Iris shader material ───────────────────────────────────
  const irisUniforms = useMemo(
    () => ({
      uIrisColor: { value: IRIS_COLOR },
      uTime: { value: 0 },
      uDilation: { value: 0.7 },
      uBrightness: { value: 0.85 },
    }),
    [],
  );

  // ── Corneal reflection material ────────────────────────────
  const cornealUniforms = useMemo(
    () => ({
      uLightDir: { value: new THREE.Vector3(0.3, 0.5, 1).normalize() },
    }),
    [],
  );

  // ── Blood vessel texture (procedural canvas) ───────────────
  const scleraMap = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Base white
    ctx.fillStyle = "#f5f0eb";
    ctx.fillRect(0, 0, size, size);

    // Subtle veins at edges
    ctx.strokeStyle = "rgba(180, 50, 50, 0.12)";
    ctx.lineWidth = 1.2;
    const cx = size / 2;
    const cy = size / 2;

    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
      const r1 = size * 0.35;
      const r2 = size * 0.48;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      // Wiggly line outward
      for (let j = 0; j < 5; j++) {
        const t = (j + 1) / 5;
        const r = r1 + (r2 - r1) * t;
        const wiggle = (Math.random() - 0.5) * 12;
        ctx.lineTo(
          cx + Math.cos(angle + wiggle * 0.01) * r + wiggle,
          cy + Math.sin(angle + wiggle * 0.01) * r + wiggle,
        );
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Apply sclera map
  useEffect(() => {
    scleraMat.map = scleraMap;
    scleraMat.needsUpdate = true;
  }, [scleraMat, scleraMap]);

  // ── Per-frame update ───────────────────────────────────────
  useFrame((_state, delta) => {
    // Gaze rotation via quaternion (already interpolated in hook)
    if (groupRef.current) {
      groupRef.current.rotation.set(
        tracking.gazeAngle.x,
        tracking.gazeAngle.y,
        0,
        "YXZ",
      );
    }

    // Update iris shader uniforms
    if (irisMatRef.current) {
      irisMatRef.current.uniforms.uTime.value += delta;
      irisMatRef.current.uniforms.uDilation.value = tracking.pupilDilation;
    }

    // Light direction follows cursor (offset from camera)
    if (cornealMatRef.current) {
      const lx = tracking.screenX * 0.6 + 0.3;
      const ly = tracking.screenY * 0.4 + 0.5;
      cornealMatRef.current.uniforms.uLightDir.value
        .set(lx, ly, 1)
        .normalize();
    }
  });

  return (
    <group ref={groupRef}>
      {/* Sclera */}
      <mesh>
        <sphereGeometry args={[EYE_RADIUS, SEGMENTS, SEGMENTS]} />
        <primitive object={scleraMat} attach="material" />
      </mesh>

      {/* Iris — sits slightly forward */}
      <mesh position={[0, 0, EYE_RADIUS * 0.88]} scale={[1, 1, 0.15]}>
        <sphereGeometry args={[IRIS_RADIUS, SEGMENTS, SEGMENTS]} />
        <shaderMaterial
          ref={irisMatRef}
          vertexShader={irisVertexShader}
          fragmentShader={irisFragmentShader}
          uniforms={irisUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Corneal specular overlay — slightly larger than iris */}
      <mesh position={[0, 0, EYE_RADIUS * 0.92]}>
        <sphereGeometry args={[IRIS_RADIUS * 1.15, 32, 32]} />
        <shaderMaterial
          ref={cornealMatRef}
          vertexShader={cornealVertexShader}
          fragmentShader={cornealFragmentShader}
          uniforms={cornealUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer gloss shell — subtle reflection */}
      <mesh>
        <sphereGeometry args={[EYE_RADIUS * 1.005, SEGMENTS, SEGMENTS]} />
        <meshPhysicalMaterial
          color={0xffffff}
          transparent
          opacity={0.06}
          roughness={0}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}

/* ── Public Component ──────────────────────────────────────── */
export interface EyeballProps {
  /** CSS class applied to the canvas container */
  className?: string;
}

/**
 * Interactive 3D eyeball that tracks the user's cursor.
 *
 * Renders inside an R3F Canvas with a perspective camera at 60° FOV.
 * All gaze tracking is computed via SLERP in `useEyeballTracking`.
 */
const Eyeball: React.FC<EyeballProps> = ({ className }) => {
  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 50 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} color={0xffffff} />
        <directionalLight
          position={[2, 3, 5]}
          intensity={0.8}
          color={0xfff5e6}
        />
        <pointLight
          position={[-3, -1, 4]}
          intensity={0.3}
          color={0xff8c42}
          distance={15}
        />

        <EyeballScene />
      </Canvas>
    </div>
  );
};

export default Eyeball;
