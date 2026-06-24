"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Float, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { DataPoint6D, Scene6DData } from "./use6DData";

// ── Mapeamento D6 (saúde da margem) → cor espectral ──────────────────────────
function healthToColor(health: number): THREE.Color {
  // 0 = vermelho (#ef4444), 0.5 = amarelo (#f59e0b), 1 = verde (#22c55e)
  const r = new THREE.Color("#ef4444");
  const y = new THREE.Color("#f59e0b");
  const g = new THREE.Color("#22c55e");
  const color = new THREE.Color();
  if (health < 0.5) color.lerpColors(r, y, health * 2);
  else               color.lerpColors(y, g, (health - 0.5) * 2);
  return color;
}

// ── Esfera individual (D1–D6) ────────────────────────────────────────────────
function Sphere6D({
  point,
  timeFilter,
  selected,
  onSelect,
}: {
  point:      DataPoint6D;
  timeFilter: number;   // 0–1, filtra D4 (slider temporal)
  selected:   string | null;
  onSelect:   (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const color   = useMemo(() => healthToColor(point.health), [point.health]);
  const isSelected = selected === point.id;

  // D4: opacidade baseada na distância temporal do slider
  const timeDist = Math.abs(point.t - timeFilter);
  const opacity  = timeDist < 0.15 ? 1.0 : Math.max(0.08, 1.0 - timeDist * 3);

  // D1 (X): hora * 0.6   D2 (Y): receita * 4   D3 (Z): tipo de pedido * 1.5
  const px = (point.x - 12) * 0.5;   // centraliza em 0
  const py = point.y * 4 - 1;
  const pz = point.z;

  // D5: raio da esfera = peso
  const radius = point.weight * 0.35;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (isSelected) {
      meshRef.current.rotation.y += delta * 1.2;
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSelected ? null : point.id);
  }, [isSelected, point.id, onSelect]);

  return (
    <mesh
      ref={meshRef}
      position={[px, py, pz]}
      onClick={handleClick}
      castShadow
    >
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 0.8 : 0.25}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.4}
      />
      {/* Glow halo no selecionado */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[radius * 1.6, 16, 16]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.12}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </mesh>
  );
}

// ── Tooltip 3D flutuante ─────────────────────────────────────────────────────
function Tooltip3D({ point }: { point: DataPoint6D }) {
  const px = (point.x - 12) * 0.5;
  const py = point.y * 4 - 1 + point.weight * 0.35 + 0.4;
  const pz = point.z;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Billboard position={[px, py, pz]}>
      <Text
        fontSize={0.13}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.008}
        outlineColor="#000000"
        maxWidth={2.5}
      >
        {`${point.label}\n💰 ${fmt(point.revenue)}  📦 ${point.orders} pedidos\n📊 Margem ${(point.margin * 100).toFixed(1)}%`}
      </Text>
    </Billboard>
  );
}

// ── Eixos anotados ───────────────────────────────────────────────────────────
function Axes() {
  return (
    <group>
      {/* Eixo X — Tempo do dia */}
      {[0, 6, 12, 18, 23].map(h => (
        <Billboard key={h} position={[(h - 12) * 0.5, -1.3, 0]}>
          <Text fontSize={0.09} color="#ffffff55" anchorX="center">{h}h</Text>
        </Billboard>
      ))}
      {/* Label D1 */}
      <Billboard position={[0, -1.65, 0]}>
        <Text fontSize={0.1} color="#f97316aa" anchorX="center">← D1: Hora do dia →</Text>
      </Billboard>

      {/* Label D2 */}
      <Billboard position={[-6.5, 1.5, 0]}>
        <Text fontSize={0.1} color="#3b82f6aa" anchorX="center">D2: Receita ↑</Text>
      </Billboard>

      {/* Label D3 */}
      <Billboard position={[0, -1.65, -2]}>
        <Text fontSize={0.09} color="#8b5cf6aa" anchorX="center">D3: Delivery</Text>
      </Billboard>
      <Billboard position={[0, -1.65, 2]}>
        <Text fontSize={0.09} color="#06b6d4aa" anchorX="center">D3: Balcão</Text>
      </Billboard>
    </group>
  );
}

// ── Cena principal ───────────────────────────────────────────────────────────
function SceneContent({
  sceneData,
  timeFilter,
  selected,
  onSelect,
}: {
  sceneData:  Scene6DData;
  timeFilter: number;
  selected:   string | null;
  onSelect:   (id: string | null) => void;
}) {
  const selectedPoint = sceneData.points.find(p => p.id === selected) ?? null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <pointLight position={[-4, 4, -4]} intensity={0.6} color="#8b5cf6" />
      <pointLight position={[4, 2, 4]}  intensity={0.4} color="#f97316" />

      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#ffffff08"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#ffffff14"
        fadeDistance={18}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
        position={[0, -1.5, 0]}
      />

      <Axes />

      {sceneData.points.map(point => (
        <Sphere6D
          key={point.id}
          point={point}
          timeFilter={timeFilter}
          selected={selected}
          onSelect={onSelect}
        />
      ))}

      {selectedPoint && <Tooltip3D point={selectedPoint} />}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={22}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

// ── Componente exportado (envolve o Canvas) ──────────────────────────────────
export default function Scene6D({
  sceneData,
  timeFilter,
}: {
  sceneData:  Scene6DData;
  timeFilter: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 3, 10], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      onClick={(e) => {
        // clique no fundo limpa seleção
        if ((e.target as HTMLElement).tagName === "CANVAS") setSelected(null);
      }}
    >
      <SceneContent
        sceneData={sceneData}
        timeFilter={timeFilter}
        selected={selected}
        onSelect={setSelected}
      />
    </Canvas>
  );
}
