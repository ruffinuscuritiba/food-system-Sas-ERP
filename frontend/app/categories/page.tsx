"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { Pencil, Trash2, Check, X, FolderKanban, Plus, Beer, UtensilsCrossed } from "lucide-react";

const CATEGORY_TYPE_OPTS = [
  { value: "normal",  label: "Normal",  icon: "🍽️",  desc: "Cardápio padrão" },
  { value: "bebidas", label: "Bebidas", icon: "🥤",  desc: "Grid estilo conveniência + busca EAN" },
];

export default function CategoriesPage() {
  const [categories, setCategories]               = useState<any[]>([]);
  const [name, setName]                           = useState("");
  const [newAllowMulti, setNewAllowMulti]         = useState(false);
  const [newCategoryType, setNewCategoryType]     = useState("normal");
  const [loading, setLoading]                     = useState(true);
  const [creating, setCreating]                   = useState(false);
  const [editingId, setEditingId]                 = useState<string | null>(null);
  const [editName, setEditName]                   = useState("");
  const [editAllowMulti, setEditAllowMulti]       = useState(false);
  const [editCategoryType, setEditCategoryType]   = useState("normal");

  async function fetchCategories() {
    try {
      const response = await api.get("/categories");
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  async function createCategory() {
    if (!name.trim()) { toast.error("Digite o nome"); return; }
    setCreating(true);
    try {
      await api.post("/categories", {
        name: name.trim(),
        allowMultipleFlavors: newAllowMulti,
        categoryType: newCategoryType,
      });
      toast.success("Categoria criada");
      setName("");
      setNewAllowMulti(false);
      setNewCategoryType("normal");
      fetchCategories();
    } catch {
      toast.error("Erro ao criar categoria");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: any) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditAllowMulti(category.allowMultipleFlavors ?? false);
    setEditCategoryType(category.categoryType ?? "normal");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { toast.error("Nome não pode ser vazio"); return; }
    try {
      await api.patch(`/categories/${id}`, {
        name: editName.trim(),
        allowMultipleFlavors: editAllowMulti,
        categoryType: editCategoryType,
      });
      toast.success("Categoria atualizada");
      setEditingId(null);
      fetchCategories();
    } catch {
      toast.error("Erro ao atualizar categoria");
    }
  }

  async function deleteCategory(id: string, catName: string) {
    if (!confirm(`Excluir a categoria "${catName}"?`)) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Categoria excluída");
      fetchCategories();
    } catch {
      toast.error("Erro ao excluir. Verifique se não há produtos vinculados.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-primary p-2.5 rounded-xl">
            <FolderKanban size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Categorias</h1>
            <p className="text-gray-400 text-sm">
              {categories.length} categoria{categories.length !== 1 ? "s" : ""} cadastrada{categories.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Form de criação */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-bold text-gray-700 mb-3">Nova categoria</p>

          <div className="flex gap-3 mb-4">
            <input
              placeholder="Nome da categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
              className="flex-1 border border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100 transition px-4 py-3 rounded-xl outline-none text-sm text-gray-900"
            />
            <button
              onClick={createCategory}
              disabled={creating}
              className="bg-primary disabled:opacity-50 transition text-white px-5 rounded-xl font-bold text-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>

          {/* Tipo de categoria */}
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-500 mb-2">Tipo de categoria</p>
            <div className="flex gap-2">
              {CATEGORY_TYPE_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewCategoryType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                    newCategoryType === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {CATEGORY_TYPE_OPTS.find((o) => o.value === newCategoryType)?.desc}
            </p>
          </div>

          {/* Multi-sabores toggle (somente para normal) */}
          {newCategoryType === "normal" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <div
                onClick={() => setNewAllowMulti((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${newAllowMulti ? "bg-primary" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newAllowMulti ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs font-semibold text-gray-600">Permite múltiplos sabores (pizza)</span>
            </label>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Carregando...
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
            Nenhuma categoria cadastrada
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {editingId === category.id ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 items-center">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(category.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 border border-gray-200 focus:border-primary px-3 py-2 rounded-xl outline-none text-sm text-gray-900"
                      />
                      <button onClick={() => saveEdit(category.id)} className="text-green-500 hover:text-green-600 transition">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 transition">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Tipo de categoria */}
                    <div className="flex gap-1.5">
                      {CATEGORY_TYPE_OPTS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditCategoryType(opt.value)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                            editCategoryType === opt.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-gray-200 text-gray-500"
                          }`}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>

                    {editCategoryType === "normal" && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          onClick={() => setEditAllowMulti((v) => !v)}
                          className={`w-8 h-4 rounded-full transition-colors relative ${editAllowMulti ? "bg-primary" : "bg-gray-200"}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${editAllowMulti ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-xs text-gray-500">Multi-sabores</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base shrink-0">
                          {category.categoryType === "bebidas" ? "🥤" : "🍽️"}
                        </span>
                        <h2 className="text-sm font-bold text-gray-900 truncate">{category.name}</h2>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {category.categoryType === "bebidas" && (
                          <span className="text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                            🥤 Bebidas
                          </span>
                        )}
                        {category.allowMultipleFlavors && (
                          <span className="text-xs font-semibold bg-primary/5 text-primary border border-orange-100 px-2 py-0.5 rounded-full">
                            🍕 Multi-sabores
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(category)}
                        className="text-gray-400 hover:text-blue-500 transition p-1 rounded-lg hover:bg-blue-50"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id, category.name)}
                        className="text-gray-400 hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
