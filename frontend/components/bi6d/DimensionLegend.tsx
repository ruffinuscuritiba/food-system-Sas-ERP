"use client";

import { Info } from "lucide-react";

const DIMENSIONS = [
  {
    id: "D1",
    color: "#f97316",
    label: "Hora do dia",
    desc: "Eixo horizontal — quando as vendas acontecem (0h–23h)",
  },
  {
    id: "D2",
    color: "#3b82f6",
    label: "Receita",
    desc: "Eixo vertical — quanto foi faturado naquele momento",
  },
  {
    id: "D3",
    color: "#8b5cf6",
    label: "Tipo de pedido",
    desc: "Profundidade 3D — Delivery (fundo) / Mesa (meio) / Balcão (frente)",
  },
  {
    id: "D4",
    color: "#06b6d4",
    label: "Tempo (slider)",
    desc: "Filtro temporal — deslize para navegar pelos dias do período",
  },
  {
    id: "D5",
    color: "#a3e635",
    label: "Volume de pedidos",
    desc: "Tamanho da esfera — mais pedidos = esfera maior",
  },
];

// D6 é um único "slot" dimensional que se expressa em 3 encodings visuais
// distintos e simultâneos — cor, anel pulsante e conexões/partículas.
const D6_VARIANTS = [
  {
    id: "D6a",
    color: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)",
    label: "Saúde da margem",
    desc: "Cor da esfera — Vermelho < 40% · Amarelo 40–60% · Verde > 60%",
    gradient: true,
  },
  {
    id: "D6b",
    color: "#f9a8d4",
    label: "Probabilidade / Confiança",
    desc: "Anel pulsante ao redor da esfera — pulso rápido e nítido = alta confiança real (conversão, satisfação, estabilidade); flicker lento = incerto",
    pulse: true,
  },
  {
    id: "D6c",
    color: "#eab308",
    label: "Hierarquia & Fluxo de Rede",
    desc: "Linhas conectam produto→dia e etapa→etapa do funil (hierarquia); partículas viajando pelas arestas do funil mostram o fluxo real de clientes — mais rápido = etapa saudável, arrastando = gargalo",
  },
];

export default function DimensionLegend() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Info size={13} className="text-white/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Mapa de Dimensões
        </span>
      </div>

      {DIMENSIONS.map((d) => (
        <div key={d.id} className="flex items-start gap-3">
          <div className="mt-0.5 w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
          <div>
            <p className="text-xs font-bold text-white/80">
              <span className="text-white/30 mr-1">{d.id}</span>
              {d.label}
            </p>
            <p className="text-[11px] text-white/40 leading-relaxed">{d.desc}</p>
          </div>
        </div>
      ))}

      <div className="mt-1 pt-3 border-t border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2.5">
          D6 — três encodings simultâneos
        </p>
        <div className="flex flex-col gap-3">
          {D6_VARIANTS.map((d) => (
            <div key={d.id} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${d.pulse ? "animate-pulse" : ""}`}
                style={{ background: d.color }}
              />
              <div>
                <p className="text-xs font-bold text-white/80">
                  <span className="text-white/30 mr-1">{d.id}</span>
                  {d.label}
                </p>
                <p className="text-[11px] text-white/40 leading-relaxed">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gradiente D6a visual */}
      <div className="mt-1 rounded-lg overflow-hidden h-2 w-full"
        style={{ background: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)" }} />
      <div className="flex justify-between text-[10px] text-white/30">
        <span>Margem baixa</span>
        <span>Margem ótima</span>
      </div>
    </div>
  );
}
