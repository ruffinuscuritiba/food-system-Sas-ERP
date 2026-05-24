"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { BookOpen, Plus, Trash2 } from "lucide-react";

export default function RecipesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [items, setItems] = useState<{ ingredientId: string; quantity: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function getCompanyId() {
    try { return JSON.parse(localStorage.getItem("user") || "{}").companyId || ""; } catch { return ""; }
  }

  async function load() {
    const companyId = getCompanyId();
    try {
      const [prodRes, ingRes] = await Promise.all([
        api.get("/products"),
        api.get(`/ingredients`),
      ]);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setIngredients(Array.isArray(ingRes.data) ? ingRes.data : []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function addItem() {
    setItems([...items, { ingredientId: "", quantity: "" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  const totalCost = items.reduce((total, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing || !item.quantity) return total;
    return total + Number(ing.cost) * Number(item.quantity);
  }, 0);

  async function saveRecipe() {
    if (!selectedProduct) { toast.error("Selecione um produto"); return; }
    if (items.length === 0) { toast.error("Adicione ao menos um ingrediente"); return; }
    setSaving(true);
    try {
      await api.post("/recipes", {
        productId: selectedProduct,
        items: items.map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })),
      });
      toast.success("Receita salva com sucesso");
      setItems([]);
      setSelectedProduct("");
    } catch {
      toast.error("Erro ao salvar receita");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen size={28} className="text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold">Ficha Técnica / Receitas</h1>
            <p className="text-slate-400 text-sm mt-0.5">Engenharia de cardápio e controle de CMV</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {/* Produto */}
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">Produto *</label>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
              <option value="">Selecione um produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Ingredientes da receita */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-slate-400">Ingredientes</label>
              <button onClick={addItem} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition">
                <Plus size={16} /> Adicionar ingrediente
              </button>
            </div>
            <div className="space-y-3">
              {items.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-700 rounded-xl">
                  Clique em "Adicionar ingrediente" para montar a receita
                </p>
              )}
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_150px_40px] gap-3 items-center">
                  <select value={item.ingredientId} onChange={(e) => updateItem(index, "ingredientId", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                    <option value="">Selecionar ingrediente...</option>
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input type="number" placeholder="Quantidade" value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
                  <button onClick={() => removeItem(index)} className="text-slate-500 hover:text-red-400 transition flex items-center justify-center">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CMV */}
          {items.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">CMV da Receita</span>
                <span className="text-2xl font-black text-green-400">R$ {totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <button onClick={saveRecipe} disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition py-3 rounded-xl font-semibold">
            {saving ? "Salvando..." : "Salvar Receita"}
          </button>
        </div>
      </div>
    </main>
  );
}
