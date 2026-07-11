"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, X, Settings2, Pizza, Pencil, Check, ChevronUp, ChevronDown } from "lucide-react";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

// ── Types ─────────────────────────────────────────────────────────────────────

type PizzaSize = "PEQUENA" | "MEDIA" | "GRANDE" | "FAMILIA" | "EXTRA_GRANDE";

interface BorderSize {
  size: PizzaSize;
  price: number | string;
}

interface PizzaBorder {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  sizes: { size: PizzaSize; price: number }[];
}

interface SizeConfig {
  id: string;
  size: PizzaSize;
  label: string;
  slices: number;
  maxFlavors: number;
  isActive: boolean;
  sortOrder: number;
}

const SIZE_LABELS: Record<PizzaSize, string> = {
  PEQUENA:     "Pequena",
  MEDIA:       "Média",
  GRANDE:      "Grande",
  FAMILIA:     "Família",
  EXTRA_GRANDE:"Extra Grande",
};

const ALL_SIZES: PizzaSize[] = ["PEQUENA", "MEDIA", "GRANDE", "FAMILIA", "EXTRA_GRANDE"];

const DEFAULT_SIZE_CONFIGS: SizeConfig[] = [
  { id: "default-pequena",     size: "PEQUENA",     label: "Pequena",     slices: 4,  maxFlavors: 1, isActive: true, sortOrder: 0 },
  { id: "default-media",       size: "MEDIA",       label: "Média",       slices: 6,  maxFlavors: 2, isActive: true, sortOrder: 1 },
  { id: "default-grande",      size: "GRANDE",      label: "Grande",      slices: 8,  maxFlavors: 3, isActive: true, sortOrder: 2 },
  { id: "default-familia",     size: "FAMILIA",     label: "Família",     slices: 16, maxFlavors: 4, isActive: true, sortOrder: 3 },
  { id: "default-extra-grande",size: "EXTRA_GRANDE",label: "Extra Grande",slices: 12, maxFlavors: 4, isActive: true, sortOrder: 4 },
];

const emptyForm = (): { name: string; sizes: BorderSize[] } => ({
  name: "",
  sizes: ALL_SIZES.map((s) => ({ size: s, price: "" })),
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function PizzaBordersPage() {
  useNavKeyGuard("pizza-borders");
  const [borders, setBorders]         = useState<PizzaBorder[]>([]);
  const [sizeConfigs, setSizeConfigs] = useState<SizeConfig[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(emptyForm());
  const [editId, setEditId]           = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [savingSize, setSavingSize]   = useState<PizzaSize | null>(null);
  const [activeTab, setActiveTab]     = useState<"borders" | "sizes">("sizes");

  async function load() {
    const [bordersResult, sizesResult] = await Promise.allSettled([
      api.get("/pizza-borders"),
      api.get("/pizza-size-configs"),
    ]);

    if (bordersResult.status === "fulfilled") {
      setBorders(Array.isArray(bordersResult.value.data) ? bordersResult.value.data : []);
    } else {
      toast.error("Erro ao carregar bordas");
    }

    if (sizesResult.status === "fulfilled") {
      const data = sizesResult.value.data;
      setSizeConfigs(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SIZE_CONFIGS);
    } else {
      // Endpoint indisponível (ex: deploy em andamento) — usa defaults locais
      setSizeConfigs(DEFAULT_SIZE_CONFIGS);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Size configs ─────────────────────────────────────────────────────────────

  async function updateSizeConfig(size: PizzaSize, patch: Partial<SizeConfig>) {
    setSavingSize(size);
    try {
      const res = await api.patch(`/pizza-size-configs/${size}`, patch);
      setSizeConfigs((prev) =>
        prev.map((s) => (s.size === size ? { ...s, ...res.data } : s))
      );
      toast.success("Configuração salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSavingSize(null);
    }
  }

  // ── Borders ──────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(border: PizzaBorder) {
    setEditId(border.id);
    setForm({
      name: border.name,
      sizes: ALL_SIZES.map((s) => {
        const existing = border.sizes.find((bs) => bs.size === s);
        return { size: s, price: existing ? existing.price : "" };
      }),
    });
    setShowForm(true);
  }

  function setSizePrice(size: PizzaSize, value: string) {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.map((s) => (s.size === size ? { ...s, price: value } : s)),
    }));
  }

  async function saveBorder() {
    if (!form.name.trim()) { toast.error("Informe o nome da borda"); return; }
    const filledSizes = form.sizes.filter((s) => s.price !== "" && !isNaN(Number(s.price)));
    if (filledSizes.length === 0) { toast.error("Informe o preço de ao menos um tamanho"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sizes: filledSizes.map((s) => ({ size: s.size, price: Number(s.price) })),
    };
    try {
      if (editId) {
        await api.patch(`/pizza-borders/${editId}`, payload);
        toast.success("Borda atualizada!");
      } else {
        await api.post("/pizza-borders", payload);
        toast.success("Borda criada!");
      }
      setShowForm(false);
      load();
    } catch {
      toast.error("Erro ao salvar borda");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(border: PizzaBorder) {
    try {
      await api.patch(`/pizza-borders/${border.id}`, { isActive: !border.isActive });
      load();
    } catch {
      toast.error("Erro ao atualizar");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta borda?")) return;
    try {
      await api.delete(`/pizza-borders/${id}`);
      toast.success("Borda excluída");
      load();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  async function moveBorder(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= borders.length) return;

    const reordered = [...borders];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const previous = borders;
    setBorders(reordered); // otimista

    try {
      await api.patch("/pizza-borders/reorder", {
        items: reordered.map((b, i) => ({ id: b.id, sortOrder: i + 1 })),
      });
    } catch {
      toast.error("Erro ao reordenar");
      setBorders(previous); // rollback
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Pizza size={22} className="text-orange-500" /> Configuração de Pizza
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure tamanhos, sabores permitidos e bordas recheadas.
          </p>
        </div>
        {activeTab === "borders" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md shadow-primary/20"
          >
            <Plus size={16} /> Nova Borda
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab("sizes")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
            activeTab === "sizes"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🍕 Tamanhos & Sabores
        </button>
        <button
          onClick={() => setActiveTab("borders")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
            activeTab === "borders"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🧀 Bordas Recheadas
        </button>
      </div>

      {/* ── TAB: Tamanhos & Sabores ──────────────────────────────────────────── */}
      {activeTab === "sizes" && (
        <div className="space-y-3">
          {/* Legenda */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-2 flex items-start gap-3">
            <Settings2 size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div className="text-sm text-orange-700">
              <p className="font-bold mb-0.5">Como funciona</p>
              <p className="text-orange-600">
                Defina quantos sabores cada tamanho permite. No cardápio, o cliente não
                poderá selecionar mais do que o permitido.
              </p>
            </div>
          </div>

          {sizeConfigs.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Carregando tamanhos…</p>
            </div>
          ) : (
            sizeConfigs.map((cfg) => (
              <SizeConfigCard
                key={cfg.size}
                config={cfg}
                saving={savingSize === cfg.size}
                onSave={(patch) => updateSizeConfig(cfg.size, patch)}
              />
            ))
          )}
        </div>
      )}

      {/* ── TAB: Bordas ─────────────────────────────────────────────────────── */}
      {activeTab === "borders" && (
        <>
          {borders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-3">🧀</p>
              <p className="text-gray-500 font-medium">Nenhuma borda cadastrada</p>
              <p className="text-sm text-gray-400 mt-1">Clique em "Nova Borda" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {borders.map((border, index) => (
                <div
                  key={border.id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm transition ${
                    border.isActive ? "border-gray-100" : "border-gray-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Mover para cima/baixo */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveBorder(index, -1)}
                          disabled={index === 0}
                          title="Mover para cima"
                          className="w-6 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent transition"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveBorder(index, 1)}
                          disabled={index === borders.length - 1}
                          title="Mover para baixo"
                          className="w-6 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent transition"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <span className="text-xl">🧀</span>
                      <div>
                        <h3 className="font-bold text-gray-900">{border.name}</h3>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            border.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {border.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(border)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium transition"
                      >
                        {border.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => openEdit(border)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary font-medium transition border border-primary/20"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(border.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {ALL_SIZES.map((size) => {
                      const bs = border.sizes.find((s) => s.size === size);
                      return (
                        <div
                          key={size}
                          className={`rounded-xl px-3 py-2 text-center ${
                            bs
                              ? "bg-primary/5 border border-orange-100"
                              : "bg-gray-50 border border-gray-100"
                          }`}
                        >
                          <p className="text-xs font-bold text-gray-500">{SIZE_LABELS[size]}</p>
                          <p className={`text-sm font-black mt-0.5 ${bs ? "text-primary" : "text-gray-300"}`}>
                            {bs ? `R$ ${Number(bs.price).toFixed(2)}` : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal de borda ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900">{editId ? "Editar Borda" : "Nova Borda"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Nome da borda</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary text-gray-900"
                  placeholder="Ex: Catupiry, Cheddar..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Preço por tamanho{" "}
                  <span className="text-gray-400 font-normal">(deixe em branco para não oferecer)</span>
                </label>
                <div className="space-y-2">
                  {form.sizes.map((s) => (
                    <div key={s.size} className="flex items-center gap-3">
                      <span className="w-24 text-sm font-semibold text-gray-700">{SIZE_LABELS[s.size]}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.price}
                          onChange={(e) => setSizePrice(s.size, e.target.value)}
                          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary text-gray-900"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveBorder}
                disabled={saving}
                className="flex-1 bg-primary disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
              >
                <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SizeConfigCard ─────────────────────────────────────────────────────────────

function SizeConfigCard({
  config,
  saving,
  onSave,
}: {
  config: SizeConfig;
  saving: boolean;
  onSave: (patch: Partial<SizeConfig>) => void;
}) {
  const [maxFlavors, setMaxFlavors] = useState(config.maxFlavors);
  const [slices, setSlices]         = useState(config.slices);
  const [isActive, setIsActive]     = useState(config.isActive);
  const [label, setLabel]           = useState(config.label);
  const [editingLabel, setEditingLabel] = useState(false);
  const [dirty, setDirty]           = useState(false);

  function change<K extends keyof SizeConfig>(key: K, val: SizeConfig[K]) {
    if (key === "maxFlavors") setMaxFlavors(val as number);
    if (key === "slices")     setSlices(val as number);
    if (key === "isActive")   setIsActive(val as boolean);
    if (key === "label")      setLabel(val as string);
    setDirty(true);
  }

  function confirmLabel() {
    setEditingLabel(false);
    if (label.trim() && label !== config.label) setDirty(true);
  }

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-sm transition ${
        isActive ? "border-gray-100" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Pizza size={18} className="text-orange-500" />
          </div>
          <div>
            {editingLabel ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={confirmLabel}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmLabel(); if (e.key === "Escape") { setLabel(config.label); setEditingLabel(false); }}}
                  className="border border-primary rounded-lg px-2 py-1 text-sm font-bold text-gray-900 outline-none w-32"
                />
                <button onClick={confirmLabel} className="text-primary">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-gray-900">{label}</h3>
                <button
                  onClick={() => setEditingLabel(true)}
                  className="text-gray-400 hover:text-primary transition"
                  title="Editar nome do tamanho"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {isActive ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => change("isActive", !isActive)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium transition"
          >
            {isActive ? "Desativar" : "Ativar"}
          </button>
          {dirty && (
            <button
              onClick={() => { onSave({ maxFlavors, slices, isActive, label: label.trim() || config.label }); setDirty(false); }}
              disabled={saving}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
            >
              <Save size={13} /> {saving ? "…" : "Salvar"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Fatias */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">
            🍕 Fatias
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => change("slices", Math.max(1, slices - 1))}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 transition"
            >
              −
            </button>
            <span className="w-10 text-center font-black text-gray-900 text-lg">{slices}</span>
            <button
              onClick={() => change("slices", Math.min(32, slices + 1))}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 transition"
            >
              +
            </button>
          </div>
        </div>

        {/* Máx. sabores */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">
            🎨 Máx. sabores permitidos
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => change("maxFlavors", n)}
                className={`w-9 h-9 rounded-xl text-sm font-black transition ${
                  maxFlavors === n
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-500"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {maxFlavors === 1
              ? "Apenas 1 sabor (pizza tradicional)"
              : `Até ${maxFlavors} sabores (meio a meio)`}
          </p>
        </div>
      </div>
    </div>
  );
}
