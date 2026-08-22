"use client";

/**
 * Frente de Caixa — Marmitaria & Restaurante.
 *
 * Interface própria, construída do zero (não é o /pdv genérico de pizzaria
 * com cor trocada, nem o /pdv-marmitaria anterior — esse arquivo aposenta
 * os dois pra esses 2 segmentos). Paleta e regra de negócio vieram de uma
 * especificação real trazida pelo usuário (design.md + catalog.ts de um
 * protótipo React Native descartado — o app em si não rodava aqui, mas a
 * paleta de cor e os limites por categoria são fiéis a ele):
 *   Laranja #F97316 · Verde #16A34A · Cacau #43220F · Creme #FFF7ED ·
 *   Vinho #9F1239 · Grafite #292524.
 *
 * O construtor de composição ("monte sua marmita") fica EMBUTIDO no painel
 * principal (não é um modal por cima) — grupos de Complementos reais da
 * empresa (item 24), renderizados por FORMATO do grupo, não por nome fixo:
 *   - obrigatório + escolha única      → linha "hero" (Proteína)
 *   - obrigatório + múltipla escolha   → linha com contador "Faltam N" +
 *                                         setas de rolagem (Acompanhamentos)
 *   - opcional                          → cards lado a lado (Salada/Sobremesa)
 * Isso funciona pra qualquer configuração real de Complementos da loja, não
 * só pro exemplo específico da referência.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import {
  DoorOpen, ChefHat, CheckCircle2, CreditCard, Bell, Minus, Plus,
  Check, ChevronLeft, ChevronRight, ArrowLeft,
} from "lucide-react";
import { getProductPlaceholderImage } from "@/lib/productPlaceholder";

// ── Paleta (design.md) ───────────────────────────────────────────────────
const LARANJA = "#F97316";
const VERDE = "#16A34A";
const CACAU = "#43220F";
const CACAU_ESCURO = "#2E1709";
const CREME = "#FFF7ED";
const VINHO = "#9F1239";
const GRAFITE = "#292524";

type ProductSize = { size: string; price: number };
type Product = {
  id: string;
  name: string;
  salePrice: number;
  imageUrl?: string | null;
  description?: string | null;
  sizes?: ProductSize[];
  categoryId?: string;
};
type Category = { id: string; name: string; color?: string | null };

type ComplementOption = { id: string; name: string; price: number; isActive?: boolean; imageUrl?: string | null };
type ComplementGroup = {
  id: string; name: string; required: boolean; chargesExtra: boolean;
  multipleChoice: boolean; minOptions: number; maxOptions: number; options: ComplementOption[];
};
type Selection = { complementOptionId: string; complementName: string; optionName: string; price: number; imageUrl?: string | null };

type CartLine = {
  key: string;
  productId: string;
  name: string;
  imageUrl?: string | null;
  size?: string;
  notes?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
type Cash = { id: string; registerNumber?: number | null; balance: number; isOpen: boolean };

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PLACEHOLDER_IMG = getProductPlaceholderImage("MARMITARIA");

function priceLabel(p: Product) {
  if (p.sizes && p.sizes.length > 0) {
    const prices = p.sizes.map((s) => Number(s.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt(Number(p.salePrice || 0));
}

export default function MarmitariaRestaurantePdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [companyName, setCompanyName] = useState<string>("Restaurante");
  useEffect(() => {
    api.get("/company/settings").then((r) => { if (r.data?.name) setCompanyName(r.data.name); }).catch(() => {});
  }, []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const loadCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/categories"), api.get("/products")]);
      const nextProducts: Product[] = Array.isArray(pRes.data) ? pRes.data : [];
      const productCategoryIds = new Set(nextProducts.map((p) => p.categoryId).filter(Boolean));
      setCategories((Array.isArray(cRes.data) ? cRes.data : []).filter((c) => productCategoryIds.has(c.id)));
      setProducts(nextProducts);
    } catch {
      toast.error("Erro ao carregar cardápio");
    }
  }, []);

  // Grade e carrinho funcionam sem caixa aberto — só a finalização exige
  // (banner avisa, não bloqueia; mesmo padrão do /pdv clássico, item 151).
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // Tela inicial já abre no construtor (igual referência) quando existe um
  // produto de composição (preço R$0 sem tamanho — convenção "Monte a sua",
  // ver priceLabel/badge abaixo). Sem produto assim, cai pra grade normal.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || products.length === 0) return;
    autoOpenedRef.current = true;
    const composeProduct = products.find((p) => Number(p.salePrice) === 0 && (!p.sizes || p.sizes.length === 0));
    if (composeProduct) openBuilder(composeProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const checkCash = useCallback(async () => {
    setCheckingCash(true);
    try {
      const r = await api.get("/cash/current");
      setCash(r.data && r.data.isOpen ? r.data : null);
    } catch {
      /* silent */
    } finally {
      setCheckingCash(false);
    }
  }, []);
  useEffect(() => { checkCash(); }, [checkCash]);

  async function openRegister() {
    const value = Number(openingValue.replace(",", "."));
    if (!openingValue || isNaN(value) || value < 0) { toast.error("Informe o valor de abertura"); return; }
    try {
      const r = await api.post("/cash/open", { openingValue: value });
      setCash(r.data);
      toast.success("Caixa aberto");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao abrir caixa");
    }
  }

  const filteredProducts = useMemo(
    () => (activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory)),
    [products, activeCategory],
  );
  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "Cardápio";
    return categories.find((c) => c.id === activeCategory)?.name ?? "Itens";
  }, [activeCategory, categories]);

  function addLine(product: Product, size: string | undefined, unitPrice: number, notes?: string) {
    setCart((prev) => {
      const key = notes ? `${product.id}-${Date.now()}` : size ? `${product.id}-${size}` : product.id;
      if (!notes) {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice } : l));
        }
      }
      return [...prev, { key, productId: product.id, name: product.name, imageUrl: product.imageUrl, size, notes, qty: 1, unitPrice, lineTotal: unitPrice }];
    });
  }

  // ── Construtor embutido ("monte sua marmita") ──────────────────────────
  const [buildProduct, setBuildProduct] = useState<Product | null>(null);
  const [buildSize, setBuildSize] = useState<ProductSize | null>(null);
  const [buildGroups, setBuildGroups] = useState<ComplementGroup[]>([]);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildSelections, setBuildSelections] = useState<Record<string, Selection[]>>({});
  const complementsCacheRef = useRef<Map<string, ComplementGroup[]>>(new Map());

  async function openBuilder(p: Product) {
    if (p.sizes && p.sizes.length > 1) {
      setBuildProduct(p);
      setBuildSize(null);
      setBuildGroups([]);
      setBuildSelections({});
      return;
    }
    await fetchGroupsAndOpen(p, p.sizes?.[0] ?? null);
  }

  async function fetchGroupsAndOpen(p: Product, size: ProductSize | null) {
    setBuildProduct(p);
    setBuildSize(size);
    setBuildSelections({});
    const cached = complementsCacheRef.current.get(p.id);
    if (cached !== undefined) {
      if (cached.length === 0) { finishBuildDirect(p, size); return; }
      setBuildGroups(cached);
      return;
    }
    setBuildLoading(true);
    try {
      const res = await api.get(`/complements/public/product/${p.id}`);
      const groups: ComplementGroup[] = Array.isArray(res.data) ? res.data : [];
      complementsCacheRef.current.set(p.id, groups);
      if (groups.length === 0) { finishBuildDirect(p, size); return; }
      setBuildGroups(groups);
    } catch {
      finishBuildDirect(p, size);
    } finally {
      setBuildLoading(false);
    }
  }

  // Produto sem nenhum complemento configurado — vai direto pro carrinho,
  // sem passar pelo construtor (ex.: bebida avulsa).
  function finishBuildDirect(p: Product, size: ProductSize | null) {
    addLine(p, size?.size, size ? Number(size.price) : Number(p.salePrice || 0));
    closeBuilder();
  }

  function closeBuilder() {
    setBuildProduct(null);
    setBuildSize(null);
    setBuildGroups([]);
    setBuildSelections({});
  }

  function groupQty(groupId: string) {
    return (buildSelections[groupId] || []).length;
  }

  function toggleSingle(group: ComplementGroup, option: ComplementOption) {
    const current = buildSelections[group.id] || [];
    const already = current.some((s) => s.complementOptionId === option.id);
    setBuildSelections((prev) => ({
      ...prev,
      [group.id]: already ? [] : [{ complementOptionId: option.id, complementName: group.name, optionName: option.name, price: group.chargesExtra ? Number(option.price) : 0, imageUrl: option.imageUrl }],
    }));
  }

  function toggleMulti(group: ComplementGroup, option: ComplementOption) {
    const current = buildSelections[group.id] || [];
    const already = current.some((s) => s.complementOptionId === option.id);
    if (already) {
      setBuildSelections((prev) => ({ ...prev, [group.id]: current.filter((s) => s.complementOptionId !== option.id) }));
      return;
    }
    if (group.maxOptions > 0 && current.length >= group.maxOptions) {
      toast.error(`Máximo ${group.maxOptions} em "${group.name}"`);
      return;
    }
    setBuildSelections((prev) => ({
      ...prev,
      [group.id]: [...current, { complementOptionId: option.id, complementName: group.name, optionName: option.name, price: group.chargesExtra ? Number(option.price) : 0, imageUrl: option.imageUrl }],
    }));
  }

  const buildExtras = Object.values(buildSelections).flat().reduce((s, x) => s + Number(x.price), 0);
  const buildBasePrice = buildSize ? Number(buildSize.price) : Number(buildProduct?.salePrice || 0);
  const buildTotal = buildBasePrice + buildExtras;
  const requiredGroups = buildGroups.filter((g) => g.required);
  const requiredFilled = requiredGroups.filter((g) => groupQty(g.id) >= (g.minOptions || 1)).length;
  const buildReady = requiredGroups.every((g) => groupQty(g.id) >= (g.minOptions || 1));

  function confirmBuild() {
    if (!buildProduct) return;
    if (!buildReady) { toast.error("Complete os itens obrigatórios antes de adicionar"); return; }
    const selections = Object.values(buildSelections).flat();
    const notes = selections.map((s) => s.optionName).join(", ");
    addLine(buildProduct, buildSize?.size, buildTotal, notes || undefined);
    closeBuilder();
  }

  function incLine(key: string) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice } : l)));
  }
  function decLine(key: string) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty - 1, lineTotal: (l.qty - 1) * l.unitPrice } : l)).filter((l) => l.qty > 0));
  }

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0) return;
    if (!cash) { toast.error("Abra o caixa antes de finalizar a venda"); setPaymentOpen(false); return; }
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: "Cliente balcão", customerPhone: "", deliveryAddress: "BALCAO",
        orderType: "DINE_IN", channel: "PDV", cashId: cash.id, paymentMethod, notes: "",
        items: cart.map((l) => ({
          productId: l.productId, quantity: l.qty,
          notes: [l.size ? `Tamanho: ${l.size}` : "", l.notes ?? ""].filter(Boolean).join(" — "),
          unitPrice: l.unitPrice,
        })),
        subtotal: total, deliveryFee: 0, total,
      });
      if (orderRes.data?.id) await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      toast.success(`Pedido #${orderRes.data?.number ?? "—"} fechado — R$ ${fmt(total)}`);
      setCart([]);
      setPaymentOpen(false);
      if (orderRes.data?.number) setLastOrderNumber(orderRes.data.number);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao fechar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  function scrollGroup(groupId: string, dir: -1 | 1) {
    scrollRefs.current[groupId]?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  // Seções de cada grupo obrigatório dentro do construtor — os botões
  // "Proteína"/"Acompanhamentos" da sidebar pulam pra cá (igual referência),
  // em vez de filtrar categoria de produto.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  function jumpToGroup(groupId: string) {
    sectionRefs.current[groupId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="h-screen flex flex-col font-sans overflow-hidden" style={{ background: CREME }}>
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Carregando...</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar de marca */}
            <aside className="w-56 shrink-0 flex flex-col p-4" style={{ background: CACAU }}>
              <div className="flex flex-col items-center text-center mb-6 mt-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white mb-3" style={{ background: LARANJA }}>
                  <ChefHat size={26} />
                </div>
                <h1 className="text-white font-extrabold text-sm uppercase leading-tight">{companyName}</h1>
                <p className="text-[11px] mt-1" style={{ color: LARANJA }}>— Sabor & Praticidade —</p>
              </div>

              <nav className="space-y-2">
                {buildProduct ? (
                  // Construtor aberto: atalhos pulam pra cada seção obrigatória
                  // (Proteína/Acompanhamentos), igual referência — não filtram
                  // categoria de produto, que não faz sentido aqui dentro.
                  requiredGroups.map((g, i) => (
                    <button
                      key={g.id}
                      onClick={() => jumpToGroup(g.id)}
                      className="w-full px-4 py-2.5 rounded-full font-bold text-xs uppercase text-left transition text-white"
                      style={{ background: i % 2 === 0 ? LARANJA : VERDE }}
                    >
                      {g.name}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => setActiveCategory("all")}
                    className="w-full px-4 py-2.5 rounded-full font-bold text-xs uppercase text-left transition text-white"
                    style={{ background: LARANJA }}
                  >
                    Cardápio
                  </button>
                )}
              </nav>

              {cart.some((l) => l.notes) && (
                <div className="relative mt-6 rounded-2xl overflow-hidden">
                  <img
                    src={cart.slice().reverse().find((l) => l.notes)?.imageUrl || PLACEHOLDER_IMG}
                    alt=""
                    className="w-full h-28 object-cover"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                  />
                  <span className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: VERDE }}>
                    <Check size={18} strokeWidth={3} />
                  </span>
                </div>
              )}
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="flex items-center justify-between gap-2.5 px-5 py-3 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  <button
                    onClick={() => { closeBuilder(); setActiveCategory("all"); }}
                    className="shrink-0 px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition text-white"
                    style={{ background: !buildProduct && activeCategory === "all" ? CACAU : `${CACAU}b3` }}
                  >
                    Todos
                  </button>
                  {categories.map((c, i) => {
                    const isActive = !buildProduct && activeCategory === c.id;
                    const color = i % 3 === 0 ? LARANJA : i % 3 === 1 ? VERDE : VINHO;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { closeBuilder(); setActiveCategory(c.id); }}
                        className="shrink-0 px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition text-white"
                        style={{ background: isActive ? color : `${color}b3` }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-sm font-extrabold px-3 py-1.5 rounded-full" style={{ background: `${CACAU}14`, color: CACAU }}>
                  R$ {fmt(buildProduct ? buildTotal : total)}
                </span>
                <button className="w-9 h-9 rounded-full flex items-center justify-center transition" style={{ background: `${CACAU}14`, color: CACAU }} aria-label="Notificações">
                  <Bell size={16} />
                </button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: VERDE }} title={user?.name ?? "Operador"} aria-label={`Operador: ${user?.name ?? "desconhecido"}`}>
                  {(user?.name ?? "OP").slice(0, 2).toUpperCase()}
                </div>
                </div>
              </header>

              {!cash && (
                <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold shrink-0" style={{ background: `${VINHO}12`, color: VINHO }}>
                  <span className="flex items-center gap-2"><DoorOpen size={14} />Caixa fechado — abra pra registrar vendas</span>
                  <button onClick={() => document.getElementById("open-cash-inline")?.scrollIntoView({ behavior: "smooth" })} className="underline decoration-dotted">
                    Abrir agora
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <div className="rounded-3xl p-5" style={{ background: `linear-gradient(160deg, ${LARANJA}dd, ${CACAU})` }}>
                  {buildProduct ? (
                    // ── Construtor embutido ──────────────────────────────
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <button onClick={closeBuilder} className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "rgba(0,0,0,0.2)" }} aria-label="Voltar ao cardápio">
                          <ArrowLeft size={16} />
                        </button>
                        <div>
                          <h2 className="text-white font-extrabold text-base uppercase">Montar {buildProduct.name}</h2>
                          {requiredGroups.length > 0 && (
                            <p className="text-white/70 text-xs mt-0.5">{requiredFilled}/{requiredGroups.length} obrigatórios preenchidos</p>
                          )}
                        </div>
                      </div>

                      {buildProduct.sizes && buildProduct.sizes.length > 1 && !buildSize ? (
                        <div className="bg-white rounded-2xl p-5 max-w-sm">
                          <p className="text-sm font-bold mb-3" style={{ color: GRAFITE }}>Escolha o tamanho</p>
                          <div className="space-y-2">
                            {buildProduct.sizes.map((s) => (
                              <button
                                key={s.size}
                                onClick={() => fetchGroupsAndOpen(buildProduct, s)}
                                className="w-full h-12 rounded-lg border flex items-center justify-between px-4 text-sm font-semibold transition"
                                style={{ borderColor: "#F1E6D8", color: GRAFITE }}
                              >
                                <span>{s.size}</span>
                                <span style={{ color: LARANJA }}>R$ {fmt(Number(s.price))}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : buildLoading ? (
                        <p className="text-white/70 text-sm py-10 text-center">Carregando...</p>
                      ) : (
                        <div className="space-y-5">
                          {/* Grupo obrigatório de escolha única — linha "hero" (Proteína) */}
                          {buildGroups.filter((g) => g.required && !g.multipleChoice).map((g) => (
                            <div key={g.id}>
                              <p className="text-white font-bold text-sm uppercase mb-2">{g.name}</p>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                {g.options.map((opt) => {
                                  const selected = (buildSelections[g.id] || []).some((s) => s.complementOptionId === opt.id);
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => toggleSingle(g, opt)}
                                      className="bg-white rounded-2xl overflow-hidden text-left transition"
                                      style={selected ? { boxShadow: `0 0 0 3px ${VERDE}` } : undefined}
                                    >
                                      <div className="h-16 bg-gray-50 relative">
                                        <img src={opt.imageUrl || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                        {selected && (
                                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: VERDE }}>
                                            <Check size={12} strokeWidth={3} />
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] font-bold px-1.5 py-1.5 truncate" style={{ color: GRAFITE }}>{opt.name}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {/* Grupos de múltipla escolha — linha com contador + rolagem (Acompanhamentos) */}
                          {buildGroups.filter((g) => g.required && g.multipleChoice).map((g) => {
                            const remaining = g.maxOptions > 0 ? Math.max(0, g.maxOptions - groupQty(g.id)) : null;
                            return (
                              <div key={g.id}>
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-white font-bold text-sm uppercase">{g.name}</p>
                                  {remaining !== null && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: remaining === 0 ? VERDE : "rgba(255,255,255,0.2)" }}>
                                      {remaining === 0 ? "✓ Completo" : `Faltam ${remaining}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => scrollGroup(g.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} aria-label={`Rolar ${g.name} pra esquerda`}>
                                    <ChevronLeft size={15} />
                                  </button>
                                  <div ref={(el) => { scrollRefs.current[g.id] = el; }} className="flex gap-2.5 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: "none" }}>
                                    {g.options.map((opt) => {
                                      const selected = (buildSelections[g.id] || []).some((s) => s.complementOptionId === opt.id);
                                      return (
                                        <button key={opt.id} onClick={() => toggleMulti(g, opt)} className="bg-white rounded-2xl overflow-hidden text-left shrink-0 w-24 transition" style={selected ? { boxShadow: `0 0 0 3px ${VERDE}` } : undefined}>
                                          <div className="h-16 bg-gray-50 relative">
                                            <img src={opt.imageUrl || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                            {selected && (
                                              <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: VERDE }}>
                                                <Check size={12} strokeWidth={3} />
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] font-bold px-1.5 py-1.5 truncate" style={{ color: GRAFITE }}>{opt.name}</p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button onClick={() => scrollGroup(g.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} aria-label={`Rolar ${g.name} pra direita`}>
                                    <ChevronRight size={15} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Grupos opcionais — tiles lado a lado (Salada/Sobremesa) */}
                          {buildGroups.some((g) => !g.required) && (
                            <div className="grid grid-cols-2 gap-3">
                              {buildGroups.filter((g) => !g.required).map((g, gi) => {
                                const tileColor = gi % 2 === 0 ? VERDE : VINHO;
                                return (
                                  <div key={g.id} className="rounded-2xl overflow-hidden" style={{ background: tileColor }}>
                                    <p className="text-white font-bold text-xs uppercase px-3 pt-2.5">{g.name}</p>
                                    <div className="flex gap-2 p-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                                      {g.options.map((opt) => {
                                        const selected = (buildSelections[g.id] || []).some((s) => s.complementOptionId === opt.id);
                                        return (
                                          <button
                                            key={opt.id}
                                            onClick={() => (g.multipleChoice ? toggleMulti(g, opt) : toggleSingle(g, opt))}
                                            className="rounded-xl overflow-hidden shrink-0 w-16 transition"
                                            style={{ boxShadow: selected ? "0 0 0 3px rgba(255,255,255,0.8)" : undefined }}
                                          >
                                            <img src={opt.imageUrl || PLACEHOLDER_IMG} alt="" className="w-full h-12 object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                            <p className="text-[10px] font-bold text-white bg-black/20 px-1 py-0.5 truncate">{opt.name}</p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <button
                            onClick={confirmBuild}
                            disabled={!buildReady}
                            className="w-full py-3 rounded-xl font-extrabold uppercase text-sm text-white transition disabled:opacity-40"
                            style={{ background: VERDE }}
                          >
                            Adicionar ao Carrinho — R$ {fmt(buildTotal)}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // ── Grade de produtos ─────────────────────────────────
                    <>
                      <h2 className="text-white font-extrabold text-base uppercase mb-4">{activeCategoryLabel}</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.map((p) => (
                          <button key={p.id} onClick={() => openBuilder(p)} className="bg-white rounded-2xl overflow-hidden text-left transition transform hover:scale-[1.03] hover:shadow-lg">
                            <div className="h-24 bg-gray-50 overflow-hidden">
                              <img src={p.imageUrl || PLACEHOLDER_IMG} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { const img = e.currentTarget; if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG; }} />
                            </div>
                            <div className="p-2.5">
                              <h3 className="font-bold text-gray-800 text-xs truncate">{p.name}</h3>
                              <p className="font-extrabold text-sm mt-0.5" style={{ color: LARANJA }}>
                                {Number(p.salePrice) > 0 || (p.sizes && p.sizes.length) ? `R$ ${priceLabel(p)}` : "Monte a sua"}
                              </p>
                            </div>
                          </button>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="col-span-full text-sm text-white/60 text-center py-10">Nenhum item nesta categoria</p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {!cash && (
                  <div id="open-cash-inline" className="mt-5 bg-white rounded-2xl p-5 max-w-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <DoorOpen size={18} style={{ color: LARANJA }} />
                      <h2 className="text-sm font-bold" style={{ color: GRAFITE }}>Abrir caixa</h2>
                    </div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Valor de abertura</label>
                    <input
                      type="text" inputMode="decimal" placeholder="0,00" value={openingValue}
                      onChange={(e) => setOpeningValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-4"
                      style={{ color: GRAFITE }}
                    />
                    <button onClick={openRegister} className="w-full h-11 rounded-lg text-white font-bold transition" style={{ background: LARANJA }}>
                      Abrir Caixa
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Carrinho — paleta e estrutura do cart.tsx real do protótipo */}
            <aside className="w-96 flex flex-col justify-between p-4 shrink-0" style={{ background: CREME }}>
              <div className="flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-black" style={{ color: GRAFITE }}>Carrinho</h2>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: LARANJA }}>{itemCount} item(ns)</span>
                </div>

                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center mt-8">Clique num item pra começar</p>
                  ) : cart.map((l) => (
                    <div key={l.key} className="bg-white rounded-2xl p-3.5" style={{ border: "1px solid #F1E6D8" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gray-50">
                            <img src={l.imageUrl || PLACEHOLDER_IMG} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[13px] truncate" style={{ color: GRAFITE }}>{l.name}</p>
                            {l.size && <p className="text-[11px] text-gray-400 mt-0.5">Porção {l.size.toLowerCase()}</p>}
                          </div>
                        </div>
                      </div>
                      {l.notes && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {l.notes.split(", ").map((tag, i) => (
                            <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: CREME, color: "#57534E" }}>{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid #F5F5F4" }}>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => decLine(l.key)} aria-label={`Diminuir quantidade de ${l.name}`} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${LARANJA}1a`, color: "#9A3412" }}>
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-black w-4 text-center" style={{ color: GRAFITE }}>{l.qty}</span>
                          <button onClick={() => incLine(l.key)} aria-label={`Aumentar quantidade de ${l.name}`} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${LARANJA}1a`, color: "#9A3412" }}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="font-black text-sm" style={{ color: "#C2410C" }}>R$ {fmt(l.lineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-4 mt-3" style={{ background: CACAU }}>
                {lastOrderNumber !== null && (
                  <p className="text-[11px] mb-2" style={{ color: LARANJA }}>Último fechado: #{lastOrderNumber}</p>
                )}
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span style={{ color: "#FED7AA" }}>Subtotal</span>
                  <span className="font-extrabold" style={{ color: CREME }}>R$ {fmt(total)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 mt-1" style={{ borderTop: `1px solid ${CACAU_ESCURO}` }}>
                  <span className="font-black text-[13px] text-white">TOTAL</span>
                  <span className="font-black text-2xl text-white">R$ {fmt(total)}</span>
                </div>

                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full py-3 rounded-xl font-extrabold uppercase text-sm text-white flex items-center justify-center gap-1.5 transition disabled:opacity-40 mt-3.5"
                  style={{ background: VERDE }}
                >
                  <CheckCircle2 size={16} />Finalizar pedido
                </button>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full py-3 rounded-xl font-extrabold uppercase text-sm text-white flex items-center justify-center gap-1.5 transition disabled:opacity-40 mt-2"
                  style={{ background: VERDE, opacity: cart.length ? 0.9 : undefined }}
                >
                  <CreditCard size={16} />Pagar agora
                </button>
              </div>
            </aside>
          </div>
        )}

        {paymentOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPaymentOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
              <p className="text-2xl font-bold mb-4" style={{ color: GRAFITE }}>R$ {fmt(total)}</p>
              <div className="space-y-2">
                {[
                  { m: "CASH", l: "Dinheiro" }, { m: "PIX", l: "PIX" },
                  { m: "CREDIT_CARD", l: "Cartão de crédito" }, { m: "DEBIT_CARD", l: "Cartão de débito" },
                ].map((p) => (
                  <button key={p.m} disabled={submitting} onClick={() => finalizeSale(p.m)} className="w-full h-11 rounded-lg border font-semibold text-sm disabled:opacity-50 transition" style={{ borderColor: "#e5e7eb", color: GRAFITE }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}
