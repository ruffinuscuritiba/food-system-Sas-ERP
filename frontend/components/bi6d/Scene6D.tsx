"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import type { DataPoint6D, Scene6DData, DataLayer } from "./use6DData";
import { LAYER_META } from "./use6DData";

// ── D6a: saúde → cor base da camada modulada pela margem ─────────────────────
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

// ── D1/D2/D3 → posição XYZ (mesma fórmula usada em todo o arquivo) ───────────
function pointPosition(point: DataPoint6D): [number, number, number] {
  return [(point.x - 12) * 0.45, point.y * 4.5 - 1.2, point.z];
}

// ── D6b: anel de probabilidade — pulso cuja frequência/nitidez escala com a
//    confiança real do dado (conversão, satisfação, estabilidade). Baixa
//    probabilidade = flicker lento e fraco; alta = pulso rápido e nítido. ────
function ProbabilityRing({ point, color }: { point: DataPoint6D; color: THREE.Color }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const radius = point.weight * 0.32;
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = 0.6 + point.probability * 3.2; // rad/s — mais confiança, pulso mais rápido

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const wave = (Math.sin(clock.elapsedTime * speed + phaseOffset) + 1) / 2; // 0..1
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.08 + wave * (0.1 + point.probability * 0.35);
    const scale = 1.3 + wave * 0.25;
    ringRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 1.25, radius * 1.45, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
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

  const [px, py, pz] = pointPosition(point);

  useFrame((_, dt) => {
    if (meshRef.current && isSel) meshRef.current.rotation.y += dt * 1.4;
  });

  const click = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSel ? null : point.id);
  }, [isSel, point.id, onSelect]);

  return (
    <group position={[px, py, pz]}>
      <mesh ref={meshRef} onClick={click} castShadow>
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
      {/* D6b — probabilidade real do ponto, sempre visível (não depende de seleção) */}
      <ProbabilityRing point={point} color={color} />
    </group>
  );
}

// ── D6c — Hierarquia: linha estrutural pai→filho (categoria/estágio) ─────────
function HierarchyEdges({ points }: { points: DataPoint6D[] }) {
  const byId = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);

  const edges = useMemo(() => {
    return points
      .filter(p => p.parentId && byId.has(p.parentId))
      .map(p => {
        const parent = byId.get(p.parentId!)!;
        return { child: p, parent };
      });
  }, [points, byId]);

  return (
    <>
      {edges.map(({ child, parent }) => {
        const a = pointPosition(parent);
        const b = pointPosition(child);
        const color = LAYER_META[child.layer].color;
        return (
          <Line
            key={`edge-${parent.id}-${child.id}`}
            points={[a, b]}
            color={color}
            lineWidth={1.1}
            transparent
            opacity={0.28}
            dashed={child.layer !== "funnel"}
            dashScale={8}
          />
        );
      })}
    </>
  );
}

// ── D6c — Fluxo de Rede: partículas viajando ao longo das arestas do funil —
//    UM único THREE.Points pra todas as arestas (1 draw call, independente de
//    quantas arestas/partículas existam — decisão de performance explícita).
const PARTICLES_PER_EDGE = 14;

function FlowParticles({ points }: { points: DataPoint6D[] }) {
  const byId = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);

  const edges = useMemo(() => {
    return points
      .filter(p => p.layer === "funnel" && p.parentId && byId.has(p.parentId))
      .map(p => {
        const parent = byId.get(p.parentId!)!;
        const a = new THREE.Vector3(...pointPosition(parent));
        const b = new THREE.Vector3(...pointPosition(p));
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.6, 0));
        const curve = new THREE.CatmullRomCurve3([a, mid, b]);
        // velocidade real ∝ taxa de conversão daquele passo do funil —
        // fluxo saudável "corre", gargalo "arrasta".
        const speed = 0.12 + p.probability * 0.55;
        return { curve, speed, color: new THREE.Color(LAYER_META.funnel.color) };
      });
  }, [points, byId]);

  const count = edges.length * PARTICLES_PER_EDGE;
  const geomRef = useRef<THREE.BufferGeometry>(null!);
  // fase (0..1) de cada partícula ao longo da curva da sua aresta, com offset
  // aleatório pra não nascerem todas grudadas — cria um fluxo contínuo.
  const phases = useMemo(
    () => Array.from({ length: count }, () => Math.random()),
    [count]
  );

  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((_, dt) => {
    if (!geomRef.current || count === 0) return;
    const posAttr = geomRef.current.attributes.position as THREE.BufferAttribute;
    let idx = 0;
    for (let e = 0; e < edges.length; e++) {
      const { curve, speed, color } = edges[e];
      for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
        phases[idx] = (phases[idx] + dt * speed) % 1;
        const pos = curve.getPointAt(phases[idx]);
        positions[idx * 3]     = pos.x;
        positions[idx * 3 + 1] = pos.y;
        positions[idx * 3 + 2] = pos.z;
        colors[idx * 3]     = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
        idx++;
      }
    }
    posAttr.array = positions;
    posAttr.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ── Tooltip 3D ────────────────────────────────────────────────────────────────
function Tooltip3D({ point }: { point: DataPoint6D }) {
  const [px, pyBase, pz] = pointPosition(point);
  const py = pyBase + point.weight * 0.32 + 0.45;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Billboard position={[px, py, pz]}>
      <Text
        fontSize={0.11} color="#ffffff" anchorX="center" anchorY="bottom"
        outlineWidth={0.007} outlineColor="#000000" maxWidth={2.8}
      >
        {`[${LAYER_META[point.layer].label}] ${point.label}\n${point.detail}\n💰 ${fmt(point.value)} · confiança ${(point.probability * 100).toFixed(0)}%`}
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

      {/* D6c — hierarquia (linhas) + fluxo de rede (partículas), sempre atrás
          das esferas em termos de leitura visual, mas desenhados primeiro
          pra não competir com o depthWrite das esferas opacas. */}
      <HierarchyEdges points={sceneData.points} />
      <FlowParticles points={sceneData.points} />

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
