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
//    separados ou uma poluição de linhas sobrepostas. ─────────────────────────
function SkylineStem({ point, opacity }: { point: DataPoint6D; opacity: number }) {
  const [px, py, pz] = pointPosition(point);
  const { points, colors } = useMemo(() => {
    const color = new THREE.Color(LAYER_META[point.layer].color);
    const dim = color.clone().multiplyScalar(0.15);
    return {
      points: [[px, FLOOR_Y, pz], [px, py, pz]] as [number, number, number][],
      colors: [dim, color],
    };
  }, [px, py, pz, point.layer]);

  if (opacity <= 0.01) return null;
  return <Line points={points} vertexColors={colors} lineWidth={1} transparent opacity={opacity * 0.5} />;
}

function SkylineStems({ points, timeFilter }: { points: LifecyclePoint[]; timeFilter: number }) {
  return (
    <>
      {points.map(p => {
        const fade = Math.abs(p.t - timeFilter);
        const opacity = p.leaving ? 0 : (fade < 0.15 ? 1 : Math.max(0.07, 1 - fade * 3));
        return <SkylineStem key={`stem-${p.id}`} point={p} opacity={opacity} />;
      })}
    </>
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
  point, timeFilter, selected, onSelect, isHighlighted, segments,
}: {
  point: LifecyclePoint; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
  isHighlighted: boolean; segments: number;
}) {
  const groupRef  = useRef<THREE.Group>(null!);
  const meshRef   = useRef<THREE.Mesh>(null!);
  const haloRef   = useRef<THREE.Mesh>(null!);
  const reticleRef = useRef<THREE.Group>(null!);
  const color    = useMemo(() => resolveColor(point), [point]);
  const isSel    = selected === point.id;
  const [hovered, setHovered] = useState(false);

  const fade   = Math.abs(point.t - timeFilter);
  const targetOpacity = point.leaving ? 0 : (fade < 0.15 ? 1.0 : Math.max(0.07, 1.0 - fade * 3));
  const radius = point.weight * 0.32;
  const [px, py, pz] = pointPosition(point);

  // Microanimação de nascimento — escala 0→1 com easing suave nos primeiros
  // POP_IN_SECONDS de vida do ponto (não do app inteiro). Saída simétrica:
  // quando `leaving`, o alvo de escala/opacidade vira 0 e o damp cuida do
  // resto — nunca um "sumiço" instantâneo.
  const birthTime = useRef<number | null>(null);
  const currentOpacity = useRef(0);
  const currentScale   = useRef(0);
  const currentHalo    = useRef(0);

  useFrame(({ clock }, dt) => {
    if (birthTime.current === null) birthTime.current = clock.elapsedTime;
    const age = clock.elapsedTime - birthTime.current;
    const pop = point.leaving ? 1 : THREE.MathUtils.smoothstep(age, 0, POP_IN_SECONDS);

    // Transições suaves (damp) em vez de valores instantâneos — some/aparece
    // sem "saltar" ao mudar o slider de tempo, o hover ou ao ser removido.
    currentOpacity.current = THREE.MathUtils.damp(currentOpacity.current, targetOpacity, DAMP_LAMBDA, dt);
    const hoverBoost = hovered && !isSel ? 1.12 : 1;
    const targetScale = point.leaving ? 0 : pop * hoverBoost;
    currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScale, point.leaving ? DAMP_LAMBDA * 0.8 : DAMP_LAMBDA, dt);

    if (groupRef.current) groupRef.current.scale.setScalar(currentScale.current);
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
      mat.opacity = currentOpacity.current;
      const targetEmissive = isSel ? 1.1 : hovered ? 0.55 : isHighlighted ? 0.6 : 0.26;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetEmissive, DAMP_LAMBDA, dt);
      if (isSel) meshRef.current.rotation.y += dt * 1.2;
    }
    // Halo de seleção sempre montado — só sua opacidade anima, nunca um
    // pop/desaparecimento instantâneo ao selecionar/desselecionar.
    if (haloRef.current) {
      currentHalo.current = THREE.MathUtils.damp(currentHalo.current, isSel ? 0.12 : 0, DAMP_LAMBDA, dt);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = currentHalo.current;
      haloRef.current.visible = currentHalo.current > 0.002;
    }
    // Reticle dourado — "olhe aqui primeiro": só existe no ponto que responde
    // ao insight calculado, gira devagar, nunca compete com o halo de seleção
    // (cor e forma diferentes de propósito).
    if (reticleRef.current) {
      reticleRef.current.rotation.z += dt * 0.5;
      reticleRef.current.visible = isHighlighted && currentOpacity.current > 0.1;
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
      {/* "Olhe aqui primeiro" — só no ponto que evidencia o insight calculado */}
      <group ref={reticleRef} visible={false}>
        <mesh>
          <torusGeometry args={[radius * 2.1, 0.012, 8, 40]} />
          <meshBasicMaterial color={HIGHLIGHT_COLOR} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
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
  sceneData, timeFilter, selected, onSelect, highlightId, qualityFactor, onPerfSample,
}: {
  sceneData: Scene6DData; timeFilter: number;
  selected: string | null; onSelect: (id: string | null) => void;
  highlightId: string | null;
  qualityFactor: number; // 0..1, vindo do PerformanceMonitor — degrada efeitos, não a informação
  onPerfSample: (s: PerfSample) => void;
}) {
  // Ponto vivo (sem `leaving`) — usado pra câmera/tooltip, que não devem
  // seguir/mostrar um ponto que já está no meio da saída suave.
  const selPoint = sceneData.points.find(p => p.id === selected) ?? null;
  const cameraTarget = selPoint ? pointPosition(selPoint) : null;

  // Mantém pontos removidos renderizando (com fade-out) por um instante em
  // vez de sumirem instantaneamente — ver usePointLifecycle.
  const livingPoints = usePointLifecycle(sceneData.points);

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

      {livingPoints.map(p => (
        <Sphere6D
          key={p.id} point={p} timeFilter={timeFilter}
          selected={selected} onSelect={onSelect}
          isHighlighted={p.id === highlightId}
          segments={sphereSegments}
        />
      ))}

      <TooltipHost point={selPoint} />

      <CinematicControls target={cameraTarget} />

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
  sceneData, timeFilter, highlightId = null, onPerfSample,
}: {
  sceneData: Scene6DData; timeFilter: number;
  highlightId?: string | null;
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
          highlightId={highlightId} qualityFactor={qualityFactor} onPerfSample={handlePerfSample}
        />
      </Canvas>
    </div>
  );
}
