"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { Pencil, Trash2, Check, X, FolderKanban, Plus, GripVertical, Image as ImageIcon } from "lucide-react";
import { ImageUploaderPreview } from "@/components/ui/ImageUploaderPreview";

// @hello-pangea/dnd é pesado e incompatível com SSR — carregamento dinâmico
const DragDropContext = dynamic(() => import("@hello-pangea/dnd").then((m) => m.DragDropContext), { ssr: false });
const Droppable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Droppable),       { ssr: false }) as any;
const Draggable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Draggable),       { ssr: false }) as any;

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
  // Fase 5 White Label — banner por categoria
  const [newBannerImage, setNewBannerImage]       = useState<string | null>(null);
  const [editBannerImage, setEditBannerImage]     = useState<string | null>(null);

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
        bannerImage: newBannerImage,
      });
      toast.success("Categoria criada");
      setName("");
      setNewAllowMulti(false);
      setNewCategoryType("normal");
      setNewBannerImage(null);
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
    setEditBannerImage(category.bannerImage ?? null);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { toast.error("Nome não pode ser vazio"); return; }
    try {
      await api.patch(`/categories/${id}`, {
        name: editName.trim(),
        allowMultipleFlavors: editAllowMulti,
        categoryType: editCategoryType,
        bannerImage: editBannerImage,  // pode ser null (remoção)
      });
      toast.success("Categoria atualizada");
      setEditingId(null);
      fetchCategories();
    } catch {
      toast.error("Erro ao atualizar categoria");
    }
  }

  async function handleDragEnd(result: any) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const next = Array.from(categories);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);

    // atualiza visualmente já — rollback se a API falhar
    const previous = categories;
    setCategories(next);

    const payload = next.map((c, i) => ({ id: c.id, sortOrder: i + 1 }));
    try {
      await api.patch("/categories/reorder", { items: payload });
    } catch {
      setCategories(previous);
      toast.error("Erro ao reordenar");
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

          {/* Banner (Fase 5 White Label) — aparece no topo do PDV ao trocar para esta categoria */}
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
              <ImageIcon size={13} className="text-gray-400" />
              Banner do PDV (opcional)
            </p>
            <p className="text-[11px] text-gray-400 mb-2">JPG, PNG ou WebP até 2 MB. Aparece no topo do PDV ao selecionar esta categoria.</p>
            <ImageUploaderPreview
              value={newBannerImage ?? undefined}
              onChange={setNewBannerImage}
              maxFileSizeMB={2}
            />
          </div>
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="categories-list">
              {(dropProvided: any) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className="grid sm:grid-cols-2 md:grid-cols-3 gap-4"
                >
                  {categories.map((category, index) => (
                    <Draggable key={category.id} draggableId={category.id} index={index}>
                      {(dragProvided: any, snapshot: any) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`bg-white rounded-2xl border shadow-sm p-5 transition ${
                            snapshot.isDragging ? "border-primary shadow-lg ring-2 ring-orange-100" : "border-gray-100"
                          }`}
                        >
                          {/* Drag handle */}
                          <div
                            {...dragProvided.dragHandleProps}
                            className="flex items-center justify-end -mt-2 -mr-2 mb-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                            title="Arrastar para reordenar"
                          >
                            <GripVertical size={16} />
                          </div>
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

                    {/* Banner (Fase 5) — upload / trocar / remover */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                        <ImageIcon size={12} className="text-gray-400" />
                        Banner do PDV
                      </p>
                      <ImageUploaderPreview
                        value={editBannerImage ?? undefined}
                        onChange={setEditBannerImage}
                        maxFileSizeMB={2}
                      />
                      {editBannerImage && (
                        <button
                          type="button"
                          onClick={() => setEditBannerImage(null)}
                          className="mt-2 text-[11px] text-red-500 hover:text-red-600 underline flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Remover banner
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Banner thumbnail — visível somente quando categoria tem banner */}
                    {category.bannerImage && (
                      <div className="relative -mt-3 -mx-3 mb-3 rounded-xl overflow-hidden border border-gray-100">
                        <img
                          src={category.bannerImage}
                          alt={`Banner ${category.name}`}
                          className="w-full h-20 object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <ImageIcon size={9} /> Banner ativo
                        </div>
                      </div>
                    )}
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
                        {!category.bannerImage && (
                          <span className="text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ImageIcon size={10} /> Sem banner
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
                  </div>
                )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </main>
  );
}
