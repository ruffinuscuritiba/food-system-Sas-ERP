"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, X, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PizzaSize = "PEQUENA" | "MEDIA" | "GRANDE" | "FAMILIA";

interface BorderSize {
  size: PizzaSize;
  price: number | string;
}

interface PizzaBorder {
  id: string;
  name: string;
  isActive: boolean;
  sizes: { size: PizzaSize; price: number }[];
}

const SIZE_LABELS: Record<PizzaSize, string> = {
  PEQUENA: "Pequena",
  MEDIA:   "Média",
  GRANDE:  "Grande",
  FAMILIA: "Família",
};

const ALL_SIZES: PizzaSize[] = ["PEQUENA", "MEDIA", "GRANDE", "FAMILIA"];

const emptyForm = (): { name: string; sizes: BorderSize[] } => ({
  name: "",
  sizes: ALL_SIZES.map((s) => ({ size: s, price: "" })),
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function PizzaBordersPage() {
  const [borders, setBorders] = useState<PizzaBorder[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get("/pizza-borders");
      setBorders(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast.error("Erro ao carregar bordas");
    }
  }

  useEffect(() => { load(); }, []);

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
      sizes: prev.sizes.map((s) => s.size === size ? { ...s, price: value } : s),
    }));
  }

  async function save() {
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900">Bordas de Pizza</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cadastre bordas com preço por tamanho.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-orange-200"
        >
          <Plus size={16} /> Nova Borda
        </button>
      </div>

      {/* List */}
      {borders.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-3">🧀</p>
          <p className="text-gray-500 font-medium">Nenhuma borda cadastrada</p>
          <p className="text-sm text-gray-400 mt-1">Clique em "Nova Borda" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {borders.map((border) => (
            <div key={border.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition ${border.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🧀</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{border.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${border.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
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
                    className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium transition border border-orange-200"
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

              {/* Sizes table */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ALL_SIZES.map((size) => {
                  const bs = border.sizes.find((s) => s.size === size);
                  return (
                    <div key={size} className={`rounded-xl px-3 py-2 text-center ${bs ? "bg-orange-50 border border-orange-100" : "bg-gray-50 border border-gray-100"}`}>
                      <p className="text-xs font-bold text-gray-500">{SIZE_LABELS[size]}</p>
                      <p className={`text-sm font-black mt-0.5 ${bs ? "text-orange-600" : "text-gray-300"}`}>
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900">{editId ? "Editar Borda" : "Nova Borda"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Nome da borda</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="Ex: Catupiry, Cheddar..."
                />
              </div>

              {/* Sizes */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Preço por tamanho <span className="text-gray-400 font-normal">(deixe em branco para não oferecer)</span></label>
                <div className="space-y-2">
                  {form.sizes.map((s) => (
                    <div key={s.size} className="flex items-center gap-3">
                      <span className="w-20 text-sm font-semibold text-gray-700">{SIZE_LABELS[s.size]}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={s.price}
                          onChange={(e) => setSizePrice(s.size, e.target.value)}
                          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
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
