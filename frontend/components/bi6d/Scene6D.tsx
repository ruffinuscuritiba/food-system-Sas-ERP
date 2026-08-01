"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls, Grid, Text, Billboard, Line, Environment, Lightformer, Sparkles,
  PerformanceMonitor,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import type { DataPoint6D, Scene6DData, DataLayer } from "./use6DData";
import { LAYER_META } from "./use6DData";

// ── Constantes de sensação/ritmo — únicas fontes da verdade pra timing ───────
const POP_IN_SECONDS   = 0.6;   // D-microanimação: nascimento de um ponto
const FADE_OUT_MS      = 550;   // duração da saída suave de um ponto removido
const IDLE_ROTATE_WAIT = 4.5;   // s parado até a câmera retomar auto-rotação
const DAMP_LAMBDA      = 6;     // suavidade padrão de easing (maior = mais rápido)
const FLOOR_Y          = -1.8;  // mesma altura do <Grid> — base das "hastes" de skyline
const HIGHLIGHT_COLOR  = "#fbbf24";

export interface PerfSample {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
}

type LifecyclePoint = DataPoint6D & { leaving?: boolean };

/**
 * Sem isso, um ponto que some (camada desligada, período trocado) some
 * INSTANTANEAMENTE — quebra a simetria com o pop-in suave que já existe pra
 * quando um ponto NASCE, e é a transição mais "seca" da cena inteira. Mantém
 * o ponto renderizando (marcado `leaving:true`) por FADE_OUT_MS depois de
 * sumir da fonte de dados real, aí sim remove de vez.
 */
function usePointLifecycle(points: DataPoint6D[], fadeOutMs = FADE_OUT_MS): LifecyclePoint[] {
  const prevMapRef = useRef(new Map<string, DataPoint6D>());
  const [leaving, setLeaving] = useState<DataPoint6D[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const currentIds = new Set(points.map(p => p.id));
    const prevMap = prevMapRef.current;

    const newlyGone: DataPoint6D[] = [];
    prevMap.forEach((p, id) => {
      if (!currentIds.has(id) && !timers.current.has(id)) {
        newlyGone.push(p);
        const t = setTimeout(() => {
          setLeaving(cur => cur.filter(x => x.id !== id));
          timers.current.delete(id);
        }, fadeOutMs);
        timers.current.set(id, t);
      }
    });
    if (newlyGone.length > 0) setLeaving(cur => [...cur, ...newlyGone]);

    // reapareceu antes do fade terminar (troca rápida de camada) — cancela a saída
    timers.current.forEach((t, id) => {
      if (currentIds.has(id)) {
        clearTimeout(t);
        timers.current.delete(id);
        setLeaving(cur => cur.filter(x => x.id !== id));
      }
    });

    const nextMap = new Map<string, DataPoint6D>();
    points.forEach(p => nextMap.set(p.id, p));
    prevMapRef.current = nextMap;
  }, [points, fadeOutMs]);

  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)); }, []);

  return useMemo(() => {
    const currentIds = new Set(points.map(p => p.id));
    const stillLeaving = leaving.filter(p => !currentIds.has(p.id));
    return [...points, ...stillLeaving.map(p => ({ ...p, leaving: true }))];
  }, [points, leaving]);
}

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

// ── Design de informação: "haste" ligando cada ponto ao chão do grid — sem
//    isso, esferas soltas no espaço não comunicam "valor" de jeito nenhum
//    (uma esfera flutuando não é maior ou menor de forma óbvia à distância).
//    Com a haste, cada ponto vira uma "coluna" — a cena inteira lê como um
//    skyline: mais alto = mais valor, e dá pra comparar as 6 camadas (lanes)
//    de uma olhada só, o que um gráfico 2D não consegue sem virar 6 gráficos
//    separados ou uma poluição de linhas sobrepostas.
//
//    JÁ NASCE "instanciada" — não existe conceito de opacidade animada por
//    frame aqui (o fade é recalculado só quando `points`/`timeFilter` mudam,
//    ou seja, em re-render, não a cada frame), então em vez de 1 <Line> por
//    ponto (o que já foi testado e chegava a ~400+ draw calls no pior caso),
//    é UM ÚNICO THREE.LineSegments com todas as hastes num buffer só — o
//    fade "por instância" é aproximado escurecendo a cor no próprio buffer
//    (linha fina de fundo — imperceptível a diferença de um alpha real).
//    Este componente é o exemplo de referência pra migrar Sphere6D/
//    ProbabilityRing pro mesmo padrão se algum dia N draw calls virar
//    gargalo real medido (ver comentário em usePointVisualState). ─────────────
function SkylineStems({ points, timeFilter }: { points: LifecyclePoint[]; timeFilter: number }) {
  const geomRef = useRef<THREE.BufferGeometry>(null!);

  const { positions, colors, count } = useMemo(() => {
    const n = points.length;
    const pos = new Float32Array(n * 2 * 3);
    const col = new Float32Array(n * 2 * 3);
    points.forEach((p, i) => {
      const [px, py, pz] = pointPosition(p);
      const fade = Math.abs(p.t - timeFilter);
      const opacity = p.leaving ? 0 : (fade < 0.15 ? 1 : Math.max(0.07, 1 - fade * 3));
      const base = new THREE.Color(LAYER_META[p.layer].color);
      const dim    = base.clone().multiplyScalar(0.15 * opacity * 0.5);
      const bright = base.clone().multiplyScalar(opacity * 0.5);

      const o = i * 6;
      pos[o]     = px; pos[o + 1] = FLOOR_Y; pos[o + 2] = pz;
      pos[o + 3] = px; pos[o + 4] = py;       pos[o + 5] = pz;
      col[o]     = dim.r;    col[o + 1] = dim.g;    col[o + 2] = dim.b;
      col[o + 3] = bright.r; col[o + 4] = bright.g; col[o + 5] = bright.b;
    });
    return { positions: pos, colors: col, count: n * 2 };
  }, [points, timeFilter]);

  if (count === 0) return null;
  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent={false} />
    </lineSegments>
  );
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

// ── SEAM DE MIGRAÇÃO — leia antes de mexer em Sphere6D/ProbabilityRing ───────
//
// Cada ponto hoje é 1 <mesh> (esfera) + 2 <mesh> (anéis) + eventualmente halo
// e reticle — no pior caso medido analiticamente (~417 pontos, 90 dias/6
// camadas) isso é ~1.250 draw calls só dessas duas peças. Se algum dia isso
// se confirmar um gargalo real (medido, não achismo — ver PerfHud), a troca
// pra InstancedMesh é possível SEM reescrever a lógica de animação, porque
// toda ela já está separada em duas metades:
//
//   1) CÁLCULO — os hooks usePointVisualState()/useRingPulseState() abaixo
//      fazem toda a matemática (damp/easing/breathing) e devolvem um objeto
//      de estado plano via callback `onUpdate`. Eles NUNCA tocam em nenhum
//      objeto Three.js — não sabem se existe um <mesh> ou um InstancedMesh.
//
//   2) APLICAÇÃO — quem CHAMA o hook decide o que fazer com o estado. Hoje
//      (Sphere6D/ProbabilityRing) escreve direto em `meshRef.current.material`.
//      Amanhã, um `InstancedSpheres` escreveria o MESMO objeto de estado num
//      Float32Array de atributo por instância (`instanceMatrix`/`instanceColor`
//      + um atributo custom pra opacidade/emissivo via onBeforeCompile) dentro
//      de UM loop, fora do React — o cálculo (metade 1) não muda uma linha.
//
// Ou seja: migrar = trocar a função de callback `onUpdate`, não os hooks.
// (SkylineStems já foi migrado de verdade pra esse padrão — é o exemplo
// funcionando de referência: um THREE.LineSegments só, sem estado por frame.)

export interface PointVisualState {
  scale: number;
  opacity: number;
  emissiveIntensity: number;
  haloOpacity: number;
  markerOpacity: number;
}

/** Metade 1 (cálculo puro) do estado da esfera — ver nota de SEAM acima. */
function usePointVisualState(
  point: LifecyclePoint,
  opts: {
    timeFilter: number; isSelected: boolean; isHovered: boolean; isHighlighted: boolean;
    // Modo História: quando ativo, tudo que NÃO é a dupla da história recua —
    // não compete por atenção enquanto a câmera conta a história. O ponto em
    // si nunca some de vez (mantém contexto de "skyline"), só fica bem quieto.
    isDimmed: boolean;
  },
  onUpdate: (state: PointVisualState, dt: number, elapsed: number) => void,
) {
  const birthTime = useRef<number | null>(null);
  const state = useRef<PointVisualState>({
    scale: 0, opacity: 0, emissiveIntensity: 0.26, haloOpacity: 0, markerOpacity: 0,
  });

  useFrame(({ clock }, dt) => {
    const s = state.current;
    if (birthTime.current === null) birthTime.current = clock.elapsedTime;
    const age = clock.elapsedTime - birthTime.current;
    const pop = point.leaving ? 1 : THREE.MathUtils.smoothstep(age, 0, POP_IN_SECONDS);

    const fade = Math.abs(point.t - opts.timeFilter);
    const baseOpacity = point.leaving ? 0 : (fade < 0.15 ? 1.0 : Math.max(0.07, 1.0 - fade * 3));
    const dimMultiplier = opts.isDimmed ? 0.16 : 1;
    const targetOpacity = baseOpacity * dimMultiplier;
    const hoverBoost = opts.isHovered && !opts.isSelected ? 1.12 : 1;
    const targetScale = point.leaving ? 0 : pop * hoverBoost;

    s.opacity = THREE.MathUtils.damp(s.opacity, targetOpacity, DAMP_LAMBDA, dt);
    s.scale = THREE.MathUtils.damp(s.scale, targetScale, point.leaving ? DAMP_LAMBDA * 0.8 : DAMP_LAMBDA, dt);
    const targetEmissive = opts.isSelected ? 1.1 : opts.isHovered ? 0.55 : opts.isHighlighted ? 0.8 : opts.isDimmed ? 0.06 : 0.26;
    s.emissiveIntensity = THREE.MathUtils.damp(s.emissiveIntensity, targetEmissive, DAMP_LAMBDA, dt);
    s.haloOpacity = THREE.MathUtils.damp(s.haloOpacity, opts.isSelected ? 0.12 : 0, DAMP_LAMBDA, dt);
    s.markerOpacity = THREE.MathUtils.damp(s.markerOpacity, opts.isHighlighted ? 0.95 : 0, DAMP_LAMBDA, dt);

    onUpdate(s, dt, clock.elapsedTime);
  });
}

export interface RingPulseState {
  innerOpacity: number; innerScale: number;
  outerOpacity: number; outerScale: number;
}

/** Metade 1 (cálculo puro) do pulso de probabilidade — mesmo seam acima. */
function useRingPulseState(
  point: DataPoint6D,
  onUpdate: (state: RingPulseState) => void,
) {
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = 0.5 + point.probability * 2.6; // rad/s — mais confiança, pulso mais rápido
  const state = useRef<RingPulseState>({ innerOpacity: 0.15, innerScale: 1.25, outerOpacity: 0.05, outerScale: 1.6 });

  useFrame(({ clock }) => {
    const raw = (Math.sin(clock.elapsedTime * speed + phaseOffset) + 1) / 2;
    // easing assimétrico: sobe rápido, desce suave — "respiração", não onda mecânica
    const breathe = Math.pow(raw, 1.6);
    const s = state.current;
    s.innerOpacity = 0.12 + breathe * (0.15 + point.probability * 0.35);
    s.innerScale   = 1.25 + breathe * 0.18;
    s.outerOpacity = 0.04 + breathe * (0.05 + point.probability * 0.14);
    s.outerScale   = 1.6 + breathe * 0.4;
    onUpdate(s);
  });
}

// ── D6b — Probabilidade: pulso elegante (breathing assimétrico, não seno cru)
//    + anel duplo (núcleo nítido + halo suave) — frequência/nitidez escalam
//    com a confiança real do dado. Metade 2 (aplicação) do seam acima. ────────
function ProbabilityRing({ point, color }: { point: DataPoint6D; color: THREE.Color }) {
  const innerRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const radius = point.weight * 0.32;

  useRingPulseState(point, (s) => {
    if (innerRef.current) {
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = s.innerOpacity;
      innerRef.current.scale.setScalar(s.innerScale);
    }
    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = s.outerOpacity;
      outerRef.current.scale.setScalar(s.outerScale);
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

// ── Esfera individual — material físico (clearcoat), pop-in, hover, easing.
//    Metade 2 (aplicação) do seam de migração documentado acima de
//    usePointVisualState — se um dia isso virar InstancedMesh, só a função
//    passada pro hook muda, não a matemática. ─────────────────────────────────
function Sphere6D({
  point, timeFilter, selected, onSelect, isHighlighted, isDimmed, segments,
}: {
  point: LifecyclePoint; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
  isHighlighted: boolean; isDimmed: boolean; segments: number;
}) {
  const groupRef  = useRef<THREE.Group>(null!);
  const meshRef   = useRef<THREE.Mesh>(null!);
  const haloRef   = useRef<THREE.Mesh>(null!);
  const markerRef = useRef<THREE.Group>(null!);
  const markerMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const color    = useMemo(() => resolveColor(point), [point]);
  const isSel    = selected === point.id;
  const [hovered, setHovered] = useState(false);
  const radius = point.weight * 0.32;
  const [px, py, pz] = pointPosition(point);

  usePointVisualState(
    point,
    { timeFilter, isSelected: isSel, isHovered: hovered, isHighlighted, isDimmed },
    (s, dt, elapsed) => {
      if (groupRef.current) groupRef.current.scale.setScalar(s.scale);
      if (meshRef.current) {
        const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
        mat.opacity = s.opacity;
        mat.emissiveIntensity = s.emissiveIntensity;
        if (isSel) meshRef.current.rotation.y += dt * 1.2;
      }
      // Halo de seleção sempre montado — só sua opacidade anima, nunca um
      // pop/desaparecimento instantâneo ao selecionar/desselecionar.
      if (haloRef.current) {
        (haloRef.current.material as THREE.MeshBasicMaterial).opacity = s.haloOpacity;
        haloRef.current.visible = s.haloOpacity > 0.002;
      }
      // Marcador "olhe aqui" — só no(s) ponto(s) que a história atual está
      // contando. Bob suave (nunca giro raso feito reticle antigo — a ideia
      // é ler como uma seta apontando pro ponto, visível de qualquer ângulo).
      if (markerRef.current) {
        markerRef.current.visible = s.markerOpacity > 0.01;
        markerRef.current.position.y = radius * 2.4 + 0.22 + Math.sin(elapsed * 2.2) * 0.06;
      }
      if (markerMatRef.current) markerMatRef.current.opacity = s.markerOpacity;
    },
  );

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
        <sphereGeometry args={[radius, segments, segments]} />
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
      <mesh ref={haloRef} visible={false}>
        <sphereGeometry args={[radius * 1.7, Math.max(10, segments - 8), Math.max(10, segments - 8)]} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* D6b — probabilidade real do ponto, sempre visível */}
      <ProbabilityRing point={point} color={color} />
      {/* Seta "olhe aqui" — só no(s) ponto(s) que a história calculada aponta.
          Substitui o antigo anel fino (fácil de perder em qualquer ângulo de
          câmera) por uma forma que lê como seta de qualquer lado. */}
      <group ref={markerRef} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.19, 4]} />
          <meshBasicMaterial ref={markerMatRef} color={HIGHLIGHT_COLOR} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ── Modo História: coluna de luz translúcida ligando o chão à altura do
//    ponto — a cena literalmente aponta pro horário/camada em vez do
//    usuário ter que procurar. Some sozinha quando a história termina. ────
function StoryBeam({ x, z, active }: { x: number; z: number; active: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const height = 5.6;
  useFrame((_, dt) => {
    if (matRef.current) {
      // Sobe suave até um teto discreto (nunca compete com as esferas) e
      // desce do mesmo jeito quando a história termina — sem sumiço seco.
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, active ? 0.16 : 0, DAMP_LAMBDA * 0.6, dt);
    }
  });
  return (
    <mesh position={[x, FLOOR_Y + height / 2, z]}>
      <cylinderGeometry args={[0.045, 0.07, height, 12, 1, true]} />
      <meshBasicMaterial
        ref={matRef} color={HIGHLIGHT_COLOR} transparent opacity={0}
        side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── D6c — Hierarquia: curva com gradiente de cor pai→filho (não linha reta
//    de cor única) — reaproveita o MESMO arco das partículas de fluxo.
//    AINDA NÃO migrado pro padrão de SkylineStems (1 <Line> por aresta —
//    até ~184 draw calls no pior caso medido). É o próximo candidato óbvio
//    se a fusão em buffer único algum dia for necessária: teria só que lidar
//    com o `dashed` condicional (funil vs. hierarquia) via um atributo extra
//    por vértice em vez do prop do drei — não fiz agora pra não migrar o que
//    ninguém pediu ainda, mas o caminho é o mesmo do SkylineStems. ───────────
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

// ── Tooltip 3D — pop suave de entrada/saída (nunca corte seco) ───────────────
function Tooltip3D({ point, visible }: { point: DataPoint6D; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const current  = useRef(0);
  const [px, pyBase, pz] = pointPosition(point);
  const py = pyBase + point.weight * 0.32 + 0.45;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useFrame((_, dt) => {
    current.current = THREE.MathUtils.damp(current.current, visible ? 1 : 0, DAMP_LAMBDA * 1.6, dt);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(0.82 + current.current * 0.18);
      groupRef.current.visible = current.current > 0.015;
    }
  });

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      <Billboard>
        <Text
          fontSize={0.11} color="#ffffff" anchorX="center" anchorY="bottom"
          outlineWidth={0.007} outlineColor="#000000" maxWidth={2.8}
        >
          {`[${LAYER_META[point.layer].label}] ${point.label}\n${point.detail}\n💰 ${fmt(point.value)} · confiança ${(point.probability * 100).toFixed(0)}%`}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Host que mantém o ÚLTIMO ponto selecionado renderizando por um instante
 * mesmo depois de `selected` virar null — sem isso, desselecionar (clicar em
 * outra esfera vazia, ou na mesma de novo) cortava o tooltip instantaneamente
 * no meio de qualquer transição.
 */
function TooltipHost({ point }: { point: DataPoint6D | null }) {
  const [displayed, setDisplayed] = useState(point);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (point) {
      if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
      setDisplayed(point);
    } else if (displayed) {
      clearTimer.current = setTimeout(() => setDisplayed(null), 400);
    }
    return () => { if (clearTimer.current) clearTimeout(clearTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);

  if (!displayed) return null;
  return <Tooltip3D point={displayed} visible={!!point} />;
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
function CinematicControls({
  target, onUserInteract,
}: {
  target: [number, number, number] | null;
  /** Disparado ao 1º toque/arrasto do usuário — cancela o Modo História na
      hora: se a pessoa já está explorando por conta própria, a câmera não
      deve continuar "puxando" pra história calculada. */
  onUserInteract?: () => void;
}) {
  const controlsRef = useRef<any>(null);
  const lastInteraction = useRef(0);
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));

  const handleStart = useCallback(() => {
    lastInteraction.current = performance.now() / 1000;
    onUserInteract?.();
  }, [onUserInteract]);
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

// ── HUD de performance — amostra FPS real + info do renderer (draw calls,
//    triângulos) direto do three.js, sem custo extra (renderer.info já é
//    mantido pelo próprio WebGL). Throttlado pra não causar re-render da UI
//    a 60fps — a MEDIÇÃO roda a cada frame, o CALLBACK só a cada ~500ms. ─────
function PerfHud({ onSample }: { onSample: (s: PerfSample) => void }) {
  const frames = useRef(0);
  const acc = useRef(0);
  const lastReport = useRef(0);

  useFrame(({ gl, clock }, dt) => {
    frames.current++;
    acc.current += dt;
    if (clock.elapsedTime - lastReport.current >= 0.5) {
      const fps = acc.current > 0 ? frames.current / acc.current : 0;
      onSample({
        fps: Math.round(fps),
        frameMs: acc.current > 0 ? (acc.current / frames.current) * 1000 : 0,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      frames.current = 0;
      acc.current = 0;
      lastReport.current = clock.elapsedTime;
    }
  });
  return null;
}

// ── Conteúdo da cena ──────────────────────────────────────────────────────────
function SceneContent({
  sceneData, timeFilter, selected, onSelect, highlightId, correlatedId, replayToken, qualityFactor, onPerfSample,
}: {
  sceneData: Scene6DData; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
  highlightId: string | null;
  correlatedId: string | null;
  /** Incrementa a cada clique em "Reproduzir Insight" — força o Modo
      História a rodar de novo mesmo sem o insight ter mudado. */
  replayToken: number;
  qualityFactor: number; // 0..1, vindo do PerformanceMonitor — degrada efeitos, não a informação
  onPerfSample: (s: PerfSample) => void;
}) {
  // Ponto vivo (sem `leaving`) — usado pra câmera/tooltip, que não devem
  // seguir/mostrar um ponto que já está no meio da saída suave.
  const selPoint = sceneData.points.find(p => p.id === selected) ?? null;

  // Mantém pontos removidos renderizando (com fade-out) por um instante em
  // vez de sumirem instantaneamente — ver usePointLifecycle.
  const livingPoints = usePointLifecycle(sceneData.points);

  // ── Modo História — a cena leva o olho até o insight calculado em vez do
  //    gerente ter que procurar. Ativa sozinha quando um novo insight chega
  //    (nova janela de datas/preset), dura ~5s, e cede na hora pro primeiro
  //    toque/arrasto do usuário (ninguém gosta de câmera "roubada" da mão). ──
  const storyPoints = useMemo(() => {
    const ids = [highlightId, correlatedId].filter((id): id is string => !!id);
    return ids
      .map(id => livingPoints.find(p => p.id === id))
      .filter((p): p is LifecyclePoint => !!p);
  }, [highlightId, correlatedId, livingPoints]);

  const [storyActive, setStoryActive] = useState(false);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!highlightId) { setStoryActive(false); return; }
    setStoryActive(true);
    if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
    storyTimerRef.current = setTimeout(() => setStoryActive(false), 5200);
    return () => { if (storyTimerRef.current) clearTimeout(storyTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, correlatedId, replayToken]);

  const endStoryEarly = useCallback(() => {
    if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
    setStoryActive(false);
  }, []);

  // Clique explícito num ponto sempre vence — o usuário já disse o que quer
  // olhar. Sem seleção, a história (se ativa) enquadra os 2 pontos juntos
  // (ponto médio) em vez de exigir que o gerente ache os dois sozinho.
  const cameraTarget = useMemo<[number, number, number] | null>(() => {
    if (selPoint) return pointPosition(selPoint);
    if (storyActive && storyPoints.length > 0) {
      if (storyPoints.length === 1) return pointPosition(storyPoints[0]);
      const positions = storyPoints.map(pointPosition);
      const mx = positions.reduce((s, p) => s + p[0], 0) / positions.length;
      const my = positions.reduce((s, p) => s + p[1], 0) / positions.length;
      const mz = positions.reduce((s, p) => s + p[2], 0) / positions.length;
      return [mx, my, mz];
    }
    return null;
  }, [selPoint, storyActive, storyPoints]);

  // Degradação adaptativa — a PRIMEIRA coisa a cair é o que é puramente
  // decorativo (bloom, grão, poeira, segmentos da esfera), NUNCA a
  // informação em si (posição/cor/tamanho continuam sempre corretos).
  const sphereSegments = qualityFactor > 0.6 ? 24 : qualityFactor > 0.3 ? 16 : 10;
  const sparklesCount  = Math.round(20 + qualityFactor * 60);
  const bloomEnabled   = qualityFactor > 0.25;

  return (
    <>
      <PerfHud onSample={onPerfSample} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow={qualityFactor > 0.4} />
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

      {/* Poeira ambiente — profundidade imediata, 1 draw call (contagem cai
          em hardware fraco antes de qualquer coisa que carregue informação) */}
      <Sparkles count={sparklesCount} scale={14} size={1.4} speed={0.15} opacity={0.25} color="#ffffff" />

      <Grid
        args={[22, 22]} cellSize={0.5} cellThickness={0.3}
        cellColor="#ffffff07" sectionSize={2} sectionThickness={0.7}
        sectionColor="#ffffff12" fadeDistance={20} fadeStrength={1}
        followCamera={false} infiniteGrid position={[0, -1.8, 0]}
      />

      <TimeAxis />
      <LayerLabels />

      {/* Hastes de skyline — leitura de "valor = altura" à primeira vista */}
      <SkylineStems points={livingPoints} timeFilter={timeFilter} />
      <HierarchyEdges points={livingPoints} />
      <FlowParticles points={livingPoints} />

      {/* Feixes de luz do Modo História — ligam o chão à altura de cada ponto
          da dupla que compõe o insight, sempre montados (fade próprio) pra
          nunca cortar seco quando a história liga/desliga. */}
      {storyPoints.map(p => {
        const [x, , z] = pointPosition(p);
        return <StoryBeam key={`beam-${p.id}`} x={x} z={z} active={storyActive} />;
      })}

      {livingPoints.map(p => {
        const isStoryPoint = p.id === highlightId || p.id === correlatedId;
        return (
          <Sphere6D
            key={p.id} point={p} timeFilter={timeFilter}
            selected={selected} onSelect={onSelect}
            isHighlighted={isStoryPoint}
            isDimmed={storyActive && !isStoryPoint && p.id !== selected}
            segments={sphereSegments}
          />
        );
      })}

      <TooltipHost point={selPoint} />

      <CinematicControls target={cameraTarget} onUserInteract={endStoryEarly} />

      {/* Bloom com mipmapBlur (mais suave e barato) + toque de grão/vinheta —
          primeiro efeito a desligar se o hardware não aguentar; a cena
          continua 100% legível sem ele, só menos "brilhante". */}
      {bloomEnabled && (
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
      )}
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Scene6D({
  sceneData, timeFilter, highlightId = null, correlatedId = null, replayToken = 0, onPerfSample,
}: {
  sceneData: Scene6DData; timeFilter: number;
  highlightId?: string | null;
  /** Ponto da outra camada que evidencia o insight — junto com `highlightId`
      forma a dupla que o Modo História enquadra/ilumina. */
  correlatedId?: string | null;
  /** Incremente pra forçar o Modo História a tocar de novo sob demanda
      (botão "Reproduzir Insight") — roda sozinho na 1ª vez de qualquer forma. */
  replayToken?: number;
  onPerfSample?: (s: PerfSample) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Suaviza a entrada do canvas — sem isso, o primeiro frame do WebGL "estala"
  // na tela assim que o import dinâmico termina, um corte seco logo na
  // primeira impressão da experiência.
  const [ready, setReady] = useState(false);

  // Degradação adaptativa de qualidade — PerformanceMonitor (drei) mede o
  // FPS real do dispositivo e devolve um fator 0..1; usamos isso pra baixar
  // dpr e desligar efeitos decorativos ANTES da experiência engasgar, em vez
  // de simplesmente torcer pra todo notebook aguentar a config "de vitrine".
  const [dpr, setDpr] = useState(1.5);
  const [qualityFactor, setQualityFactor] = useState(1);
  const handlePerfChange = useCallback((api: { factor: number }) => {
    setQualityFactor(api.factor);
    setDpr(Math.min(1.6, Math.max(0.75, 1 + api.factor * 0.8)));
  }, []);

  const handlePerfSample = useCallback((s: PerfSample) => { onPerfSample?.(s); }, [onPerfSample]);

  return (
    <div style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0, transition: "opacity 0.5s ease-out" }}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 4, 12], fov: 52 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        onCreated={() => requestAnimationFrame(() => setReady(true))}
      >
        <PerformanceMonitor onIncline={handlePerfChange} onDecline={handlePerfChange} onChange={handlePerfChange} />
        <SceneContent
          sceneData={sceneData} timeFilter={timeFilter}
          selected={selected} onSelect={setSelected}
          highlightId={highlightId} correlatedId={correlatedId} replayToken={replayToken}
          qualityFactor={qualityFactor} onPerfSample={handlePerfSample}
        />
      </Canvas>
    </div>
  );
}
