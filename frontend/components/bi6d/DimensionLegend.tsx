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
  {
    id: "D6",
    color: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)",
    label: "Saúde da margem",
    desc: "Cor da esfera — Vermelho < 40% · Amarelo 40–60% · Verde > 60%",
    gradient: true,
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
          {/* indicador de cor */}
          {d.gradient ? (
            <div
              className="mt-0.5 w-3 h-3 rounded-full shrink-0"
              style={{ background: d.color }}
            />
          ) : (
            <div
              className="mt-0.5 w-3 h-3 rounded-full shrink-0"
              style={{ background: d.color }}
            />
          )}
          <div>
            <p className="text-xs font-bold text-white/80">
              <span className="text-white/30 mr-1">{d.id}</span>
              {d.label}
            </p>
            <p className="text-[11px] text-white/40 leading-relaxed">{d.desc}</p>
          </div>
        </div>
      ))}

      {/* Gradiente D6 visual */}
      <div className="mt-1 rounded-lg overflow-hidden h-2 w-full"
        style={{ background: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)" }} />
      <div className="flex justify-between text-[10px] text-white/30">
        <span>Margem baixa</span>
        <span>Margem ótima</span>
      </div>
    </div>
  );
}
