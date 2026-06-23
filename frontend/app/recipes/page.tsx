"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { BookOpen, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

export default function RecipesPage() {
  useNavKeyGuard("recipes");
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [items, setItems] = useState<{ ingredientId: string; quantity: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [prodRes, ingRes] = await Promise.all([
        api.get("/products"),
        api.get("/ingredients"),
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowProductList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  function selectProduct(p: any) {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setShowProductList(false);
  }

  function clearProduct() {
    setSelectedProduct(null);
    setProductSearch("");
    setShowProductList(false);
  }

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
        productId: selectedProduct.id,
        items: items.map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })),
      });
      toast.success("Receita salva com sucesso");
      setItems([]);
      clearProduct();
    } catch {
      toast.error("Erro ao salvar receita");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen size={28} className="text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold">Ficha Técnica / Receitas</h1>
            <p className="text-gray-500 text-sm mt-0.5">Engenharia de cardápio e controle de CMV</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {/* Produto — searchable combobox */}
          <div className="mb-6" ref={searchRef}>
            <label className="block text-sm text-gray-600 mb-2">Produto *</label>

            {loading ? (
              <div className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-400 text-sm">
                Carregando produtos...
              </div>
            ) : products.length === 0 ? (
              <div className="w-full border border-dashed border-gray-300 rounded-xl px-4 py-4 text-sm text-gray-500 text-center">
                Nenhum produto cadastrado.{" "}
                <Link href="/products" className="text-purple-600 hover:underline font-medium">
                  Cadastrar produto →
                </Link>
              </div>
            ) : (
              <div className="relative">
                <div className="w-full flex items-center bg-white border border-gray-300 rounded-xl px-4 py-3 gap-3 focus-within:border-purple-500 transition">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowProductList(true); setSelectedProduct(null); }}
                    onFocus={() => setShowProductList(true)}
                    className="flex-1 bg-transparent outline-none text-gray-900 text-sm"
                  />
                  {productSearch && (
                    <button onClick={clearProduct} className="text-gray-400 hover:text-gray-600 transition">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {showProductList && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Nenhum produto encontrado</p>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectProduct(p)}
                          className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-purple-50 hover:text-purple-700 transition"
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedProduct && (
              <p className="mt-1.5 text-xs text-purple-600 font-medium">
                ✓ {selectedProduct.name} selecionado
              </p>
            )}
          </div>

          {/* Ingredientes da receita */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-600">Ingredientes</label>
              <button onClick={addItem} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition">
                <Plus size={16} /> Adicionar ingrediente
              </button>
            </div>
            <div className="space-y-3">
              {items.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-6 border border-dashed border-gray-300 rounded-xl">
                  Clique em "Adicionar ingrediente" para montar a receita
                </p>
              )}
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_150px_40px] gap-3 items-center">
                  <select value={item.ingredientId} onChange={(e) => updateItem(index, "ingredientId", e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-500">
                    <option value="">Selecionar ingrediente...</option>
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input type="number" placeholder="Quantidade" value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-500" />
                  <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 transition flex items-center justify-center">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CMV */}
          {items.length > 0 && (
            <div className="bg-gray-100 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">CMV da Receita</span>
                <span className="text-2xl font-black text-green-400">R$ {totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <button onClick={saveRecipe} disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition py-3 rounded-xl font-semibold text-white">
            {saving ? "Salvando..." : "Salvar Receita"}
          </button>
        </div>
      </div>
    </main>
  );
}
