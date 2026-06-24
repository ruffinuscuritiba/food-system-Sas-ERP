"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { DataPoint6D, Scene6DData, DataLayer } from "./use6DData";
import { LAYER_META } from "./use6DData";

// ── D6: saúde → cor base da camada modulada pela margem ──────────────────────
function resolveColor(point: DataPoint6D): THREE.Color {
  const base  = new THREE.Color(LAYER_META[point.layer].color);
  const red   = new THREE.Color("#ef4444");
  const amber = new THREE.Color("#f59e0b");
  const color = new THREE.Color();

  // health 0=vermelho, 0.5=cor da camada escurecida, 1=cor da camada pura
  if (point.health < 0.4) {
    color.lerpColors(red, amber, point.health / 0.4);
  } else {
    color.lerpColors(amber, base, (point.health - 0.4) / 0.6);
  }
  return color;
}

// ── Esfera individual ─────────────────────────────────────────────────────────
function Sphere6D({
  point, timeFilter, selected, onSelect,
}: {
  point: DataPoint6D; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const color   = useMemo(() => resolveColor(point), [point]);
  const isSel   = selected === point.id;

  // D4: fade por distância temporal ao slider
  const fade    = Math.abs(point.t - timeFilter);
  const opacity = fade < 0.15 ? 1.0 : Math.max(0.07, 1.0 - fade * 3);
  const radius  = point.weight * 0.32;

  // D1/D2/D3 → posição XYZ
  const px = (point.x - 12) * 0.45;
  const py = point.y * 4.5 - 1.2;
  const pz = point.z;

  useFrame((_, dt) => {
    if (meshRef.current && isSel) meshRef.current.rotation.y += dt * 1.4;
  });

  const click = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSel ? null : point.id);
  }, [isSel, point.id, onSelect]);

  return (
    <mesh ref={meshRef} position={[px, py, pz]} onClick={click} castShadow>
      <sphereGeometry args={[radius, 18, 18]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSel ? 0.9 : 0.22}
        transparent
        opacity={opacity}
        roughness={0.25}
        metalness={0.45}
      />
      {isSel && (
        <mesh>
          <sphereGeometry args={[radius * 1.7, 14, 14]} />
          <meshStandardMaterial
            color={color} transparent opacity={0.1} side={THREE.BackSide} />
        </mesh>
      )}
    </mesh>
  );
}

// ── Tooltip 3D ────────────────────────────────────────────────────────────────
function Tooltip3D({ point }: { point: DataPoint6D }) {
  const px = (point.x - 12) * 0.45;
  const py = point.y * 4.5 - 1.2 + point.weight * 0.32 + 0.45;
  const pz = point.z;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Billboard position={[px, py, pz]}>
      <Text
        fontSize={0.11} color="#ffffff" anchorX="center" anchorY="bottom"
        outlineWidth={0.007} outlineColor="#000000" maxWidth={2.8}
      >
        {`[${LAYER_META[point.layer].label}] ${point.label}\n${point.detail}\n💰 ${fmt(point.value)}`}
      </Text>
    </Billboard>
  );
}

// ── Etiquetas das camadas no eixo Z ──────────────────────────────────────────
function LayerLabels() {
  return (
    <>
      {(Object.entries(LAYER_META) as [DataLayer, typeof LAYER_META[DataLayer]][]).map(([key, meta]) => (
        <Billboard key={key} position={[7.5, -1.6, meta.zOffset]}>
          <Text fontSize={0.09} color={meta.color + "bb"} anchorX="right">
            {meta.label}
          </Text>
        </Billboard>
      ))}
    </>
  );
}

// ── Eixo X — horas ───────────────────────────────────────────────────────────
function TimeAxis() {
  return (
    <>
      {[0, 6, 12, 18, 23].map(h => (
        <Billboard key={h} position={[(h - 12) * 0.45, -1.7, 0]}>
          <Text fontSize={0.085} color="#ffffff44" anchorX="center">{h}h</Text>
        </Billboard>
      ))}
      <Billboard position={[0, -2.0, 0]}>
        <Text fontSize={0.09} color="#f97316aa" anchorX="center">← hora do dia →</Text>
      </Billboard>
    </>
  );
}

// ── Conteúdo da cena ──────────────────────────────────────────────────────────
function SceneContent({
  sceneData, timeFilter, selected, onSelect,
}: {
  sceneData: Scene6DData; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
}) {
  const selPoint = sceneData.points.find(p => p.id === selected) ?? null;

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[5, 3,  5]} intensity={0.4} color="#f97316" />
      <pointLight position={[0, 8,  0]} intensity={0.3} color="#06b6d4" />

      <Grid
        args={[22, 22]} cellSize={0.5} cellThickness={0.3}
        cellColor="#ffffff07" sectionSize={2} sectionThickness={0.7}
        sectionColor="#ffffff12" fadeDistance={20} fadeStrength={1}
        followCamera={false} infiniteGrid position={[0, -1.8, 0]}
      />

      <TimeAxis />
      <LayerLabels />

      {sceneData.points.map(p => (
        <Sphere6D
          key={p.id} point={p} timeFilter={timeFilter}
          selected={selected} onSelect={onSelect}
        />
      ))}

      {selPoint && <Tooltip3D point={selPoint} />}

      <OrbitControls
        enablePan enableZoom enableRotate
        minDistance={3} maxDistance={24}
        dampingFactor={0.07} enableDamping
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Scene6D({
  sceneData, timeFilter,
}: {
  sceneData: Scene6DData; timeFilter: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 4, 12], fov: 52 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <SceneContent
        sceneData={sceneData} timeFilter={timeFilter}
        selected={selected} onSelect={setSelected}
      />
    </Canvas>
  );
}
