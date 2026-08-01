"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls, Grid, Text, Billboard, Line, Environment, Lightformer, Sparkles,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import type { DataPoint6D, Scene6DData, DataLayer } from "./use6DData";
import { LAYER_META } from "./use6DData";

// ── Constantes de sensação/ritmo — únicas fontes da verdade pra timing ───────
const POP_IN_SECONDS   = 0.6;   // D-microanimação: nascimento de um ponto
const IDLE_ROTATE_WAIT = 4.5;   // s parado até a câmera retomar auto-rotação
const DAMP_LAMBDA      = 6;     // suavidade padrão de easing (maior = mais rápido)

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

// ── D1/D2/D3 → posição XYZ (fórmula única, reaproveitada em toda a cena) ─────
function pointPosition(point: DataPoint6D): [number, number, number] {
  return [(point.x - 12) * 0.45, point.y * 4.5 - 1.2, point.z];
}

// ── Curva compartilhada por linhas-de-hierarquia E partículas-de-fluxo — os
//    dois encodings desenham exatamente o mesmo arco, então visualmente lêem
//    como "a mesma aresta", só com tratamentos diferentes. ────────────────────
function buildEdgeCurve(parent: DataPoint6D, child: DataPoint6D): THREE.CatmullRomCurve3 {
  const a = new THREE.Vector3(...pointPosition(parent));
  const b = new THREE.Vector3(...pointPosition(child));
  const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.6, 0));
  return new THREE.CatmullRomCurve3([a, mid, b]);
}

// ── Sprite circular procedural (canvas) — partículas orgânicas com glow suave
//    em vez do quadrado padrão do PointsMaterial. Gerado 1x, reaproveitado. ───
function useSoftDotTexture(): THREE.Texture {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0,    "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

// ── D6b — Probabilidade: pulso elegante (breathing assimétrico, não seno cru)
//    + anel duplo (núcleo nítido + halo suave) — frequência/nitidez escalam
//    com a confiança real do dado. ─────────────────────────────────────────────
function ProbabilityRing({ point, color }: { point: DataPoint6D; color: THREE.Color }) {
  const innerRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const radius = point.weight * 0.32;
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = 0.5 + point.probability * 2.6; // rad/s — mais confiança, pulso mais rápido

  useFrame(({ clock }) => {
    const raw = (Math.sin(clock.elapsedTime * speed + phaseOffset) + 1) / 2;
    // easing assimétrico: sobe rápido, desce suave — "respiração", não onda mecânica
    const breathe = Math.pow(raw, 1.6);

    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + breathe * (0.15 + point.probability * 0.35);
      innerRef.current.scale.setScalar(1.25 + breathe * 0.18);
    }
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.04 + breathe * (0.05 + point.probability * 0.14);
      outerRef.current.scale.setScalar(1.6 + breathe * 0.4);
    }
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={innerRef}>
        <ringGeometry args={[radius * 1.2, radius * 1.4, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={outerRef}>
        <ringGeometry args={[radius * 1.5, radius * 2.0, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Esfera individual — material físico (clearcoat), pop-in, hover, easing ───
function Sphere6D({
  point, timeFilter, selected, onSelect,
}: {
  point: DataPoint6D; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef  = useRef<THREE.Mesh>(null!);
  const color    = useMemo(() => resolveColor(point), [point]);
  const isSel    = selected === point.id;
  const [hovered, setHovered] = useState(false);

  const fade   = Math.abs(point.t - timeFilter);
  const targetOpacity = fade < 0.15 ? 1.0 : Math.max(0.07, 1.0 - fade * 3);
  const radius = point.weight * 0.32;
  const [px, py, pz] = pointPosition(point);

  // Microanimação de nascimento — escala 0→1 com easing suave nos primeiros
  // POP_IN_SECONDS de vida do ponto (não do app inteiro).
  const birthTime = useRef<number | null>(null);
  const currentOpacity = useRef(0);
  const currentScale   = useRef(0);

  useFrame(({ clock }, dt) => {
    if (birthTime.current === null) birthTime.current = clock.elapsedTime;
    const age = clock.elapsedTime - birthTime.current;
    const pop = THREE.MathUtils.smoothstep(age, 0, POP_IN_SECONDS);

    // Transições suaves (damp) em vez de valores instantâneos — some/aparece
    // sem "saltar" ao mudar o slider de tempo ou o hover.
    currentOpacity.current = THREE.MathUtils.damp(currentOpacity.current, targetOpacity, DAMP_LAMBDA, dt);
    const hoverBoost = hovered && !isSel ? 1.12 : 1;
    currentScale.current = THREE.MathUtils.damp(currentScale.current, pop * hoverBoost, DAMP_LAMBDA, dt);

    if (groupRef.current) groupRef.current.scale.setScalar(currentScale.current);
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
      mat.opacity = currentOpacity.current;
      const targetEmissive = isSel ? 1.1 : hovered ? 0.55 : 0.26;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetEmissive, DAMP_LAMBDA, dt);
      if (isSel) meshRef.current.rotation.y += dt * 1.2;
    }
  });

  const click = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSel ? null : point.id);
  }, [isSel, point.id, onSelect]);

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      <mesh
        ref={meshRef}
        onClick={click}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
        castShadow
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.26}
          transparent
          opacity={0}
          roughness={0.2}
          metalness={0.35}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          envMapIntensity={1.1}
        />
      </mesh>
      {isSel && (
        <mesh>
          <sphereGeometry args={[radius * 1.7, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
      {/* D6b — probabilidade real do ponto, sempre visível */}
      <ProbabilityRing point={point} color={color} />
    </group>
  );
}

// ── D6c — Hierarquia: curva com gradiente de cor pai→filho (não linha reta
//    de cor única) — reaproveita o MESMO arco das partículas de fluxo. ───────
function GradientEdge({ parent, child }: { parent: DataPoint6D; child: DataPoint6D }) {
  const SEGMENTS = 24;
  const { points, colors } = useMemo(() => {
    const curve = buildEdgeCurve(parent, child);
    const colorA = new THREE.Color(LAYER_META[parent.layer].color);
    const colorB = new THREE.Color(LAYER_META[child.layer].color);
    const pts = curve.getPoints(SEGMENTS);
    const cols = pts.map((_, i) => colorA.clone().lerp(colorB, i / SEGMENTS));
    return { points: pts.map(p => [p.x, p.y, p.z] as [number, number, number]), colors: cols };
  }, [parent, child]);

  return (
    <Line
      points={points}
      vertexColors={colors}
      lineWidth={1.4}
      transparent
      opacity={0.4}
      dashed={child.layer !== "funnel"}
      dashScale={6}
    />
  );
}

function HierarchyEdges({ points }: { points: DataPoint6D[] }) {
  const byId = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);
  const edges = useMemo(
    () => points.filter(p => p.parentId && byId.has(p.parentId)).map(p => ({ child: p, parent: byId.get(p.parentId!)! })),
    [points, byId]
  );

  return (
    <>
      {edges.map(({ child, parent }) => (
        <GradientEdge key={`edge-${parent.id}-${child.id}`} parent={parent} child={child} />
      ))}
    </>
  );
}

// ── D6c — Fluxo de Rede: partículas orgânicas (jitter + variação individual)
//    viajando pelas arestas do funil — UM único THREE.Points compartilhado
//    (1 draw call, decisão de performance explícita). ────────────────────────
const PARTICLES_PER_EDGE = 16;

function FlowParticles({ points }: { points: DataPoint6D[] }) {
  const byId = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);
  const dotTexture = useSoftDotTexture();

  const edges = useMemo(() => {
    return points
      .filter(p => p.layer === "funnel" && p.parentId && byId.has(p.parentId))
      .map(p => {
        const parent = byId.get(p.parentId!)!;
        const curve = buildEdgeCurve(parent, p);
        // velocidade real ∝ taxa de conversão daquele passo — fluxo saudável
        // "corre", gargalo "arrasta".
        const speed = 0.1 + p.probability * 0.5;
        return { curve, speed, color: new THREE.Color(LAYER_META.funnel.color) };
      });
  }, [points, byId]);

  const count = edges.length * PARTICLES_PER_EDGE;

  // Variação orgânica por partícula: fase inicial, velocidade e amplitude de
  // jitter individuais — sem isso as partículas "marcham" em bloco, artificial.
  const particleMeta = useMemo(
    () => Array.from({ length: count }, () => ({
      phase:       Math.random(),
      speedMul:    0.75 + Math.random() * 0.5,
      jitterFreq:  1.5 + Math.random() * 2.5,
      jitterAmp:   0.025 + Math.random() * 0.05,
      jitterPhase: Math.random() * Math.PI * 2,
      sizeMul:     0.6 + Math.random() * 0.9,
    })),
    [count]
  );

  const geomRef   = useRef<THREE.BufferGeometry>(null!);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors    = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes     = useMemo(() => new Float32Array(count), [count]);

  useFrame(({ clock }, dt) => {
    if (!geomRef.current || count === 0) return;
    const posAttr  = geomRef.current.attributes.position as THREE.BufferAttribute;
    const sizeAttr = geomRef.current.attributes.size as THREE.BufferAttribute | undefined;
    const t = clock.elapsedTime;
    let idx = 0;
    for (let e = 0; e < edges.length; e++) {
      const { curve, speed, color } = edges[e];
      const tangentHelper = new THREE.Vector3();
      for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
        const meta = particleMeta[idx];
        meta.phase = (meta.phase + dt * speed * meta.speedMul) % 1;

        const pos = curve.getPointAt(meta.phase);
        // jitter orgânico perpendicular à direção do movimento — dá a
        // sensação de partícula "viva" em vez de trilho fixo.
        curve.getTangentAt(meta.phase, tangentHelper);
        const normal = new THREE.Vector3(-tangentHelper.y, tangentHelper.x, tangentHelper.z * 0.6).normalize();
        const wobble = Math.sin(t * meta.jitterFreq + meta.jitterPhase) * meta.jitterAmp;
        pos.addScaledVector(normal, wobble);

        positions[idx * 3]     = pos.x;
        positions[idx * 3 + 1] = pos.y;
        positions[idx * 3 + 2] = pos.z;
        colors[idx * 3]     = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
        // brilho pulsa suave por partícula + desvanece perto das pontas —
        // nasce e "dissolve" em vez de aparecer/sumir abruptamente.
        const edgeFade = Math.sin(meta.phase * Math.PI); // 0 nas pontas, 1 no meio
        sizes[idx] = meta.sizeMul * (0.5 + edgeFade * 0.5);
        idx++;
      }
    }
    posAttr.needsUpdate = true;
    if (sizeAttr) sizeAttr.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={count} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        map={dotTexture}
        size={0.16}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        alphaTest={0.01}
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

// ── Câmera cinematográfica — auto-rotação lenta que pausa na interação e
//    retoma após ficar parada; alvo desliza suavemente até o ponto
//    selecionado em vez de saltar (focus pull). ──────────────────────────────
function CinematicControls({ target }: { target: [number, number, number] | null }) {
  const controlsRef = useRef<any>(null);
  const lastInteraction = useRef(0);
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));

  const handleStart = useCallback(() => { lastInteraction.current = performance.now() / 1000; }, []);
  const handleEnd    = useCallback(() => { lastInteraction.current = performance.now() / 1000; }, []);

  useFrame(({ clock }, dt) => {
    if (!controlsRef.current) return;
    const idleFor = clock.elapsedTime - (lastInteraction.current || 0);
    controlsRef.current.autoRotate = idleFor > IDLE_ROTATE_WAIT;

    const desired = target ? new THREE.Vector3(...target) : new THREE.Vector3(0, 0, 0);
    currentTarget.current.x = THREE.MathUtils.damp(currentTarget.current.x, desired.x, DAMP_LAMBDA * 0.7, dt);
    currentTarget.current.y = THREE.MathUtils.damp(currentTarget.current.y, desired.y, DAMP_LAMBDA * 0.7, dt);
    currentTarget.current.z = THREE.MathUtils.damp(currentTarget.current.z, desired.z, DAMP_LAMBDA * 0.7, dt);
    controlsRef.current.target.copy(currentTarget.current);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan enableZoom enableRotate
      minDistance={3} maxDistance={24}
      dampingFactor={0.07} enableDamping
      autoRotateSpeed={0.35}
      onStart={handleStart}
      onEnd={handleEnd}
    />
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
  const cameraTarget = selPoint ? pointPosition(selPoint) : null;

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[5, 3,  5]} intensity={0.4} color="#f97316" />
      <pointLight position={[0, 8,  0]} intensity={0.3} color="#06b6d4" />

      {/* Reflexos sutis no clearcoat das esferas — ambiente 100% procedural
          (Lightformers), sem depender de HDRI externo via CDN: mais rápido,
          sem risco de rede, e sob nosso controle total de cor/mood. */}
      <Environment resolution={64} environmentIntensity={0.5}>
        <Lightformer intensity={2} color="#8b5cf6" position={[-4, 3, -4]} scale={6} />
        <Lightformer intensity={2} color="#06b6d4" position={[4, 2, 4]} scale={6} />
        <Lightformer intensity={1.4} color="#ffffff" position={[0, 6, 0]} scale={8} form="ring" />
      </Environment>

      {/* Poeira ambiente — profundidade imediata, 1 draw call */}
      <Sparkles count={80} scale={14} size={1.4} speed={0.15} opacity={0.25} color="#ffffff" />

      <Grid
        args={[22, 22]} cellSize={0.5} cellThickness={0.3}
        cellColor="#ffffff07" sectionSize={2} sectionThickness={0.7}
        sectionColor="#ffffff12" fadeDistance={20} fadeStrength={1}
        followCamera={false} infiniteGrid position={[0, -1.8, 0]}
      />

      <TimeAxis />
      <LayerLabels />

      <HierarchyEdges points={sceneData.points} />
      <FlowParticles points={sceneData.points} />

      {sceneData.points.map(p => (
        <Sphere6D
          key={p.id} point={p} timeFilter={timeFilter}
          selected={selected} onSelect={onSelect}
        />
      ))}

      {selPoint && <Tooltip3D point={selPoint} />}

      <CinematicControls target={cameraTarget} />

      {/* Bloom com mipmapBlur (mais suave e barato) + toque de grão/vinheta —
          sensação de dashboard premium, não só dados plotados. */}
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={0.9}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.35}
          radius={0.8}
        />
        <Vignette eskil={false} offset={0.15} darkness={0.6} />
        <Noise opacity={0.02} />
      </EffectComposer>
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
