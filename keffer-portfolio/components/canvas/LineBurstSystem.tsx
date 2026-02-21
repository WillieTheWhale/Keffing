"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { generateLineConfigs, getDailySeed, mulberry32 } from "@/lib/generative";

import lineVertexShader from "./shaders/lineVertex.glsl";
import lineFragmentShader from "./shaders/lineFragment.glsl";

const MAX_LINES = 250;
const POINTS_PER_LINE = 64;

export default function LineBurstSystem() {
  const meshRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const scrollProgress = useStore((s) => s.scrollProgress);
  const focalPoint = useStore((s) => s.focalPoint);
  const mousePosition = useStore((s) => s.mousePosition);
  const transitionPhase = useStore((s) => s.transitionPhase);
  const lineParams = useStore((s) => s.lineParams);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const seed = useMemo(() => getDailySeed(), []);

  // Generate line geometry using CatmullRomCurve3 (§4.2.1)
  const { geometry, lineCount } = useMemo(() => {
    const configs = generateLineConfigs(
      focalPoint,
      Math.min(lineParams.count, MAX_LINES),
      lineParams.spread,
      lineParams.complexity,
      seed
    );

    const totalVertices = configs.length * POINTS_PER_LINE;
    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const phases = new Float32Array(totalVertices);
    const thicknesses = new Float32Array(totalVertices);
    const isCyanArr = new Float32Array(totalVertices);
    const curveTs = new Float32Array(totalVertices);
    const origins = new Float32Array(totalVertices * 3);
    const indices: number[] = [];

    configs.forEach((config, lineIdx) => {
      // Build CatmullRomCurve3 from control points
      const points = config.controlPoints.map(
        (p) => new THREE.Vector3(p[0], p[1], p[2])
      );
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
      const curvePoints = curve.getPoints(POINTS_PER_LINE - 1);
      const tangents = curvePoints.map((_, i) => {
        const t = i / (POINTS_PER_LINE - 1);
        return curve.getTangent(t);
      });

      for (let i = 0; i < POINTS_PER_LINE; i++) {
        const vertIdx = lineIdx * POINTS_PER_LINE + i;
        const t = i / (POINTS_PER_LINE - 1);
        const point = curvePoints[i];
        const tangent = tangents[i];

        // Create normal perpendicular to tangent for ribbon effect
        const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();

        positions[vertIdx * 3] = point.x;
        positions[vertIdx * 3 + 1] = point.y;
        positions[vertIdx * 3 + 2] = point.z;

        normals[vertIdx * 3] = normal.x;
        normals[vertIdx * 3 + 1] = normal.y;
        normals[vertIdx * 3 + 2] = normal.z;

        phases[vertIdx] = config.animationPhase;
        thicknesses[vertIdx] = config.thickness;
        isCyanArr[vertIdx] = config.isCyan ? 1.0 : 0.0;
        curveTs[vertIdx] = t;
        origins[vertIdx * 3] = config.origin[0];
        origins[vertIdx * 3 + 1] = config.origin[1];
        origins[vertIdx * 3 + 2] = config.origin[2];
      }

      // Build triangle strip indices for this line
      for (let i = 0; i < POINTS_PER_LINE - 1; i++) {
        const base = lineIdx * POINTS_PER_LINE + i;
        indices.push(base, base + 1);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aThickness", new THREE.BufferAttribute(thicknesses, 1));
    geo.setAttribute("aIsCyan", new THREE.BufferAttribute(isCyanArr, 1));
    geo.setAttribute("aCurveT", new THREE.BufferAttribute(curveTs, 1));
    geo.setAttribute("aOrigin", new THREE.BufferAttribute(origins, 3));

    // Use line segments for rendering
    geo.setIndex(indices);

    return { geometry: geo, lineCount: configs.length };
  }, [focalPoint, lineParams.count, lineParams.spread, lineParams.complexity, seed]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uFocalPoint: { value: new THREE.Vector2(0.7, 0.3) },
      uMousePosition: { value: new THREE.Vector2(0.5, 0.5) },
      uTransitionPhase: { value: 0 },
    }),
    []
  );

  // Animation loop
  useFrame((state) => {
    if (!materialRef.current) return;

    const time = reducedMotion ? 0 : state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uScrollProgress.value = scrollProgress;
    materialRef.current.uniforms.uFocalPoint.value.set(focalPoint[0], focalPoint[1]);
    materialRef.current.uniforms.uMousePosition.value.set(
      mousePosition[0],
      mousePosition[1]
    );
    materialRef.current.uniforms.uTransitionPhase.value = transitionPhase;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments ref={meshRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={lineVertexShader}
        fragmentShader={lineFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </lineSegments>
  );
}
