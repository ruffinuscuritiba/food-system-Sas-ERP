"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Plus, FlaskConical } from "lucide-react";

const emptyForm = { name: "", stock: "", minimumStock: "", unit: "kg", cost: "" };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function getCompanyId() {
    try { return JSON.parse(localStorage.getItem("user") || "{}").companyId || ""; } catch { return ""; }
  }

  async function load() {
    const companyId = getCompanyId();
    if (!companyId) { setLoading(false); return; }
    try {
      const { data } = await api.get(`/ingredients`);
      setIngredients(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar ingredientes");
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name || !form.unit || !form.cost) { toast.error("Preencha nome, unidade e custo"); return; }
    setSaving(true);
    try {
      await api.post("/ingredients", {
        name: form.name,
        stock: Number(form.stock) || 0,
        minimumStock: Number(form.minimumStock) || 0,
        unit: form.unit,
        cost: Number(form.cost),
        companyId: getCompanyId(),
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

        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="font-semibold mb-4 text-gray-700">Novo Ingrediente</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: "name",         placeholder: "Nome *",           type: "text" },
              { key: "stock",        placeholder: "Estoque inicial",  type: "number" },
              { key: "minimumStock", placeholder: "Estoque mínimo",   type: "number" },
              { key: "unit",         placeholder: "Unidade (kg, un)", type: "text" },
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
          <button onClick={save} disabled={saving}
            className="mt-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 transition px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
            <Plus size={18} /> {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                {["Nome", "Estoque", "Mínimo", "Unidade", "Custo unit.", "Status"].map((h) => (
                  <th key={h} className="text-left px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : ingredients.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Nenhum ingrediente cadastrado</td></tr>
              ) : ingredients.map((i) => {
                const low = Number(i.stock) <= Number(i.minimumStock);
                return (
                  <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-medium">{i.name}</td>
                    <td className="px-5 py-4">{Number(i.stock).toFixed(2)}</td>
                    <td className="px-5 py-4">{Number(i.minimumStock).toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-500">{i.unit}</td>
                    <td className="px-5 py-4">R$ {Number(i.cost).toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${low ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                        {low ? "Estoque baixo" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
