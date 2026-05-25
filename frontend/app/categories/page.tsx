"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { Pencil, Trash2, Check, X, FolderKanban, Plus } from "lucide-react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
      await api.post("/categories", { name: name.trim() });
      toast.success("Categoria criada");
      setName("");
      fetchCategories();
    } catch {
      toast.error("Erro ao criar categoria");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { toast.error("Nome não pode ser vazio"); return; }
    try {
      await api.patch(`/categories/${id}`, { name: editName.trim() });
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
          <div className="bg-orange-500 p-2.5 rounded-xl">
            <FolderKanban size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Categorias</h1>
            <p className="text-gray-400 text-sm">{categories.length} categoria{categories.length !== 1 ? "s" : ""} cadastrada{categories.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Form de criação */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-bold text-gray-700 mb-3">Nova categoria</p>
          <div className="flex gap-3">
            <input
              placeholder="Nome da categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
              className="flex-1 border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition px-4 py-3 rounded-xl outline-none text-sm text-gray-900"
            />
            <button
              onClick={createCategory}
              disabled={creating}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition text-white px-5 rounded-xl font-bold text-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
                  <div className="flex gap-2 items-center">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(category.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 border border-gray-200 focus:border-orange-400 px-3 py-2 rounded-xl outline-none text-sm text-gray-900"
                    />
                    <button onClick={() => saveEdit(category.id)} className="text-green-500 hover:text-green-600 transition">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 transition">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2 h-2 bg-orange-400 rounded-full shrink-0" />
                      <h2 className="text-sm font-bold text-gray-900 truncate">{category.name}</h2>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditingId(category.id); setEditName(category.name); }}
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
