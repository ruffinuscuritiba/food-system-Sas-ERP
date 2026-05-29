"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Plus, FlaskConical, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight } from "lucide-react";

const emptyForm = { name: "", stock: "", minimumStock: "", unit: "kg", cost: "" };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [form, setForm]               = useState(emptyForm);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [editItem, setEditItem]       = useState<any | null>(null);
  const [editSaving, setEditSaving]   = useState(false);

  async function load() {
    try {
      const { data } = await api.get("/ingredients");
      setIngredients(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar ingredientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Criar ────────────────────────────────────────────────────────────────────
  async function save() {
    if (!form.name || !form.unit || !form.cost) {
      toast.error("Preencha nome, unidade e custo");
      return;
    }
    setSaving(true);
    try {
      await api.post("/ingredients", {
        name: form.name,
        stock: Number(form.stock) || 0,
        minimumStock: Number(form.minimumStock) || 0,
        unit: form.unit,
        cost: Number(form.cost),
      });
      toast.success("Ingrediente cadastrado");
      setForm(emptyForm);
      load();
    } catch {
      toast.error("Erro ao cadastrar ingrediente");
    } finally {
      setSaving(false);
    }
  }

  // ── Editar ───────────────────────────────────────────────────────────────────
  function openEdit(i: any) {
    setEditItem({
      id: i.id,
      name: i.name,
      stock: String(Number(i.stock).toFixed(2)),
      minimumStock: String(Number(i.minimumStock).toFixed(2)),
      unit: i.unit,
      cost: String(Number(i.cost).toFixed(2)),
      isActive: i.isActive !== false,
    });
  }

  async function saveEdit() {
    if (!editItem) return;
    setEditSaving(true);
    try {
      await api.patch(`/ingredients/${editItem.id}`, {
        name: editItem.name,
        stock: Number(editItem.stock),
        minimumStock: Number(editItem.minimumStock),
        unit: editItem.unit,
        cost: Number(editItem.cost),
        isActive: editItem.isActive,
      });
      toast.success("Ingrediente atualizado");
      setEditItem(null);
      load();
    } catch {
      toast.error("Erro ao atualizar ingrediente");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Excluir ──────────────────────────────────────────────────────────────────
  async function remove(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      await api.delete(`/ingredients/${id}`);
      toast.success("Ingrediente excluído");
      load();
    } catch {
      toast.error("Erro ao excluir ingrediente");
    }
  }

  // ── Ativo/Inativo ────────────────────────────────────────────────────────────
  async function toggleActive(i: any) {
    try {
      await api.patch(`/ingredients/${i.id}`, { isActive: !i.isActive });
      toast.success(i.isActive ? "Ingrediente inativado" : "Ingrediente ativado");
      load();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FlaskConical size={28} className="text-green-400" />
          <div>
            <h1 className="text-3xl font-bold">Ingredientes</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gestão de matéria-prima e estoque</p>
          </div>
        </div>

        {/* Form — novo ingrediente */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="font-semibold mb-4 text-gray-700">Novo Ingrediente</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: "name",         placeholder: "Nome *",           type: "text"   },
              { key: "stock",        placeholder: "Estoque inicial",  type: "number" },
              { key: "minimumStock", placeholder: "Estoque mínimo",   type: "number" },
              { key: "unit",         placeholder: "Unidade (kg, un)", type: "text"   },
              { key: "cost",         placeholder: "Custo unit. R$ *", type: "number" },
            ].map((f) => (
              <input
                key={f.key}
                type={f.type}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500"
              />
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 transition px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
          >
            <Plus size={18} /> {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                {["Nome", "Estoque", "Mínimo", "Unidade", "Custo unit.", "Status", "Ações"].map((h) => (
                  <th key={h} className="text-left px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : ingredients.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Nenhum ingrediente cadastrado</td></tr>
              ) : ingredients.map((i) => {
                const low = Number(i.stock) <= Number(i.minimumStock);
                const active = i.isActive !== false;
                return (
                  <tr key={i.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${!active ? "opacity-50" : ""}`}>
                    <td className="px-5 py-4 font-medium">{i.name}</td>
                    <td className="px-5 py-4">{Number(i.stock).toFixed(2)}</td>
                    <td className="px-5 py-4">{Number(i.minimumStock).toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-500">{i.unit}</td>
                    <td className="px-5 py-4">R$ {Number(i.cost).toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        !active
                          ? "bg-gray-100 text-gray-500"
                          : low
                          ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {!active ? "Inativo" : low ? "Estoque baixo" : "OK"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {/* Ativo/Inativo */}
                        <button
                          onClick={() => toggleActive(i)}
                          title={active ? "Inativar" : "Ativar"}
                          className="text-gray-400 hover:text-primary transition"
                        >
                          {active
                            ? <ToggleRight size={20} className="text-green-500" />
                            : <ToggleLeft size={20} />}
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => openEdit(i)}
                          title="Editar"
                          className="text-gray-400 hover:text-blue-500 transition"
                        >
                          <Pencil size={15} />
                        </button>
                        {/* Excluir */}
                        <button
                          onClick={() => remove(i.id, i.name)}
                          title="Excluir"
                          className="text-gray-400 hover:text-red-500 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edição */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Editar Ingrediente</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { key: "name",         label: "Nome",            type: "text"   },
                { key: "stock",        label: "Estoque",         type: "number" },
                { key: "minimumStock", label: "Estoque mínimo",  type: "number" },
                { key: "unit",         label: "Unidade",         type: "text"   },
                { key: "cost",         label: "Custo unitário",  type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={editItem[f.key]}
                    onChange={(e) => setEditItem({ ...editItem, [f.key]: e.target.value })}
                    className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                  />
                </div>
              ))}
              {/* Toggle ativo/inativo no modal */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-gray-700">Ativo</span>
                <button
                  onClick={() => setEditItem({ ...editItem, isActive: !editItem.isActive })}
                  className="transition"
                >
                  {editItem.isActive
                    ? <ToggleRight size={28} className="text-green-500" />
                    : <ToggleLeft size={28} className="text-gray-400" />}
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setEditItem(null)}
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Save size={14} /> {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
