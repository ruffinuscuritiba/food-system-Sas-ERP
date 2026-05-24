"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { Pencil, Trash2, Check, X } from "lucide-react";

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

  function startEdit(category: any) {
    setEditingId(category.id);
    setEditName(category.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
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
    if (!confirm(`Excluir a categoria "${catName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Categoria excluída");
      fetchCategories();
    } catch {
      toast.error("Erro ao excluir categoria. Verifique se não há produtos vinculados.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold mb-10">Categorias</h1>

        {/* Form de criação */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-10">
          <div className="flex gap-4">
            <input
              placeholder="Nome da categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
              className="flex-1 bg-slate-800 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={createCategory}
              disabled={creating}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 transition px-6 rounded-2xl font-bold"
            >
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center text-slate-500 py-20">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="text-center text-slate-500 py-20">Nenhuma categoria cadastrada</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                {editingId === category.id ? (
                  /* Modo edição */
                  <div className="flex gap-2 items-center">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(category.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 bg-slate-800 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    />
                    <button onClick={() => saveEdit(category.id)} className="text-green-400 hover:text-green-300 transition">
                      <Check size={18} />
                    </button>
                    <button onClick={cancelEdit} className="text-slate-400 hover:text-white transition">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  /* Modo visualização */
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-bold truncate">{category.name}</h2>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(category)}
                        className="text-slate-400 hover:text-blue-400 transition"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id, category.name)}
                        className="text-slate-400 hover:text-red-400 transition"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
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
