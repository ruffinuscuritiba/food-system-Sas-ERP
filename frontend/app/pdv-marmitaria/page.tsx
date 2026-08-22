"use client";

/**
 * Frente de Caixa — módulo Marmitaria.
 *
 * Identidade visual própria (paleta quente terracota sobre fundo marrom
 * escuro, bloco de marca, carrinho com foto por item) — referência exata
 * trazida pelo usuário. Produtos com grupos de Complementos configurados
 * (ex.: "Marmita Montada" com Proteína/Acompanhamentos/Salada/Sobremesa)
 * abrem o fluxo real de composição via ComplementsModal — mesmo componente
 * já usado e testado no /pdv clássico e no cardápio digital (item 24/50) —
 * em vez de inventar um wizard novo do zero. Caixa único (não multi-registro
 * como o Mercado) — marmitaria é tipicamente 1 terminal.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { DoorOpen, ChefHat, CheckCircle2, CreditCard, Bell, Minus, Plus, Check } from "lucide-react";
import { getCategoryColor } from "@/lib/categoryColors";
import { getProductPlaceholderImage } from "@/lib/productPlaceholder";
import { ComplementsModal, type ComplementGroup, type SelectedComplement } from "@/components/shared/ComplementsModal";

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
const TERRACOTA = "#D8622E";
const BROWN_DARK = "#2E1B12";
const BROWN_PANEL = "#241209";
const GREEN = "#3B7A3E";

function priceLabel(p: Product) {
  if (p.sizes && p.sizes.length > 0) {
    const prices = p.sizes.map((s) => Number(s.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt(Number(p.salePrice || 0));
}

const PLACEHOLDER_IMG = getProductPlaceholderImage("MARMITARIA");

export default function MarmitariaPdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sizePrompt, setSizePrompt] = useState<Product | null>(null);

  // Fluxo real de composição (Proteína/Acompanhamentos/Salada/Sobremesa) —
  // mesmo componente ComplementsModal do /pdv clássico, cache por produto
  // pra não rebuscar toda vez que o operador clicar de novo.
  const [buildProduct, setBuildProduct] = useState<Product | null>(null);
  const [buildGroups, setBuildGroups] = useState<ComplementGroup[]>([]);
  const [buildLoading, setBuildLoading] = useState(false);
  const complementsCacheRef = useRef<Map<string, ComplementGroup[]>>(new Map());

  const [companyName, setCompanyName] = useState<string>("Marmitaria");
  useEffect(() => {
    api.get("/company/settings")
      .then((r) => { if (r.data?.name) setCompanyName(r.data.name); })
      .catch(() => {});
  }, []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Número do PEDIDO ANTERIOR já fechado neste caixa (sequencial real do
  // backend, Order.number — item 95). Null = ainda não fechou nenhum pedido
  // nesta sessão de tela; nesse caso não exibimos nenhum número inventado.
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const loadCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/categories"), api.get("/products")]);
      const nextProducts = Array.isArray(pRes.data) ? pRes.data : [];
      const productCategoryIds = new Set(nextProducts.map((p) => p.categoryId).filter(Boolean));
      setCategories(
        (Array.isArray(cRes.data) ? cRes.data : [])
          .filter((category) => productCategoryIds.has(category.id)),
      );
      setProducts(nextProducts);
    } catch {
      toast.error("Erro ao carregar cardápio");
    }
  }, []);

  // A grade de produtos e o carrinho funcionam livremente sem caixa aberto —
  // só a finalização de venda exige (banner avisa, não bloqueia a navegação,
  // mesmo padrão do /pdv clássico, item 151/171). Sem isso, contas DEMO
  // (POST sempre bloqueado pro role DEMO) nunca conseguiam nem ver a tela,
  // travadas pra sempre na tela de abrir caixa.
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const checkCash = useCallback(async () => {
    setCheckingCash(true);
    try {
      const r = await api.get("/cash/current");
      const c = r.data;
      setCash(c && c.isOpen ? c : null);
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
    () => activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory],
  );

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "Monte seu pedido";
    return categories.find((c) => c.id === activeCategory)?.name ?? "Itens";
  }, [activeCategory, categories]);

  function addLine(product: Product, size: string | undefined, unitPrice: number, notes?: string) {
    setCart((prev) => {
      // Itens com composição (notes preenchido) nunca agrupam entre si — cada
      // "Marmita Montada" pode ter escolhas diferentes, então vira uma linha
      // própria mesmo repetindo o mesmo produto base.
      const key = notes ? `${product.id}-${Date.now()}` : (size ? `${product.id}-${size}` : product.id);
      if (!notes) {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => l.key === key
            ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice }
            : l);
        }
      }
      return [...prev, {
        key, productId: product.id, name: product.name, imageUrl: product.imageUrl, size, notes,
        qty: 1, unitPrice, lineTotal: unitPrice,
      }];
    });
  }

  async function handleProductClick(p: Product) {
    if (p.sizes && p.sizes.length > 1) { setSizePrompt(p); return; }

    const cached = complementsCacheRef.current.get(p.id);
    if (cached !== undefined) {
      if (cached.length === 0) {
        addLine(p, p.sizes?.[0]?.size, Number(p.salePrice || 0));
      } else {
        setBuildGroups(cached);
        setBuildProduct(p);
      }
      return;
    }

    setBuildLoading(true);
    try {
      const res = await api.get(`/complements/public/product/${p.id}`);
      const groups: ComplementGroup[] = Array.isArray(res.data) ? res.data : [];
      complementsCacheRef.current.set(p.id, groups);
      if (groups.length === 0) {
        addLine(p, p.sizes?.[0]?.size, Number(p.salePrice || 0));
      } else {
        setBuildGroups(groups);
        setBuildProduct(p);
      }
    } catch {
      addLine(p, p.sizes?.[0]?.size, Number(p.salePrice || 0));
    } finally {
      setBuildLoading(false);
    }
  }

  function confirmBuild(selections: SelectedComplement[]) {
    if (!buildProduct) return;
    const extras = selections.reduce((s, c) => s + Number(c.price) * c.quantity, 0);
    const unitPrice = Number(buildProduct.salePrice || 0) + extras;
    const notes = selections.map((s) => s.quantity > 1 ? `${s.quantity}x ${s.optionName}` : s.optionName).join(", ");
    addLine(buildProduct, undefined, unitPrice, notes);
    setBuildProduct(null);
    setBuildGroups([]);
  }

  function pickSize(size: ProductSize) {
    if (!sizePrompt) return;
    addLine(sizePrompt, size.size, Number(size.price));
    setSizePrompt(null);
  }

  function incLine(key: string) {
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice } : l));
  }

  function decLine(key: string) {
    setCart((prev) => prev
      .map((l) => l.key === key ? { ...l, qty: l.qty - 1, lineTotal: (l.qty - 1) * l.unitPrice } : l)
      .filter((l) => l.qty > 0));
  }

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0) return;
    if (!cash) { toast.error("Abra o caixa antes de finalizar a venda"); setPaymentOpen(false); return; }
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: "Cliente balcão",
        customerPhone: "",
        deliveryAddress: "BALCAO",
        orderType: "DINE_IN",
        channel: "PDV",
        cashId: cash.id,
        paymentMethod,
        notes: "",
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          notes: [l.size ? `Tamanho: ${l.size}` : "", l.notes ?? ""].filter(Boolean).join(" — "),
          unitPrice: l.unitPrice,
        })),
        subtotal: total,
        deliveryFee: 0,
        total,
      });
      if (orderRes.data?.id) {
        await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      }
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

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="h-screen flex flex-col font-sans overflow-hidden" style={{ background: BROWN_DARK }}>
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Carregando...</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar de marca */}
            <aside className="w-56 shrink-0 flex flex-col p-4" style={{ background: BROWN_PANEL }}>
              <div className="flex flex-col items-center text-center mb-6 mt-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white mb-3" style={{ background: TERRACOTA }}>
                  <ChefHat size={26} />
                </div>
                <h1 className="text-white font-extrabold text-sm uppercase leading-tight">{companyName}</h1>
                <p className="text-[11px] mt-1" style={{ color: TERRACOTA }}>— Sabor & Praticidade —</p>
              </div>

              <nav className="space-y-2">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`w-full px-4 py-2.5 rounded-full font-bold text-xs uppercase text-left transition ${
                    activeCategory === "all" ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                  style={activeCategory === "all" ? { background: TERRACOTA } : { background: "rgba(255,255,255,0.06)" }}
                >
                  Todos
                </button>
                {categories.map((c, i) => {
                  const isActive = activeCategory === c.id;
                  const color = getCategoryColor(c, i);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className={`w-full px-4 py-2.5 rounded-full font-bold text-xs uppercase text-left transition ${
                        isActive ? "text-white" : "text-white/60 hover:text-white"
                      }`}
                      style={isActive ? { background: color } : { background: "rgba(255,255,255,0.06)" }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </nav>

              {/* Preview: última composição montada nesta sessão */}
              {cart.some((l) => l.notes) && (
                <div className="relative mt-6 rounded-2xl overflow-hidden">
                  <img
                    src={cart.slice().reverse().find((l) => l.notes)?.imageUrl || PLACEHOLDER_IMG}
                    alt=""
                    className="w-full h-28 object-cover"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                  />
                  <span
                    className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center text-white"
                    style={{ background: GREEN }}
                  >
                    <Check size={18} strokeWidth={3} />
                  </span>
                </div>
              )}
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header superior — total ao vivo + operador */}
              <header className="flex items-center justify-end gap-2.5 px-5 py-3 shrink-0">
                <span className="text-sm font-extrabold px-3 py-1.5 rounded-full text-white" style={{ background: "rgba(255,255,255,0.08)" }}>
                  R$ {fmt(total)}
                </span>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  aria-label="Notificações"
                >
                  <Bell size={16} />
                </button>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: GREEN }}
                  title={user?.name ?? "Operador"}
                  aria-label={`Operador: ${user?.name ?? "desconhecido"}`}
                >
                  {(user?.name ?? "OP").slice(0, 2).toUpperCase()}
                </div>
              </header>

              {!cash && (
                <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "#F5D9A8" }}>
                  <span className="flex items-center gap-2"><DoorOpen size={14} />Caixa fechado — abra pra registrar vendas</span>
                  <button
                    onClick={() => document.getElementById("open-cash-inline")?.scrollIntoView({ behavior: "smooth" })}
                    className="underline decoration-dotted"
                  >
                    Abrir agora
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <div className="rounded-3xl p-5" style={{ background: "linear-gradient(160deg, #4A2E1E, #35200F)" }}>
                  <h2 className="text-white font-extrabold text-base uppercase mb-4">{activeCategoryLabel}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleProductClick(p)}
                        disabled={buildLoading}
                        className="bg-white rounded-2xl overflow-hidden text-left transition transform hover:scale-[1.03] hover:shadow-lg disabled:opacity-60"
                      >
                        <div className="h-24 bg-gray-50 overflow-hidden">
                          <img
                            src={p.imageUrl || PLACEHOLDER_IMG}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
                            }}
                          />
                        </div>
                        <div className="p-2.5">
                          <h3 className="font-bold text-gray-800 text-xs truncate">{p.name}</h3>
                          <p className="font-extrabold text-sm mt-0.5" style={{ color: TERRACOTA }}>
                            {Number(p.salePrice) > 0 ? `R$ ${priceLabel(p)}` : "Monte a sua"}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="col-span-full text-sm text-white/50 text-center py-10">Nenhum item nesta categoria</p>
                    )}
                  </div>
                </div>

                {!cash && (
                  <div id="open-cash-inline" className="mt-5 bg-white rounded-2xl p-5 max-w-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <DoorOpen size={18} style={{ color: TERRACOTA }} />
                      <h2 className="text-sm font-bold text-gray-900">Abrir caixa</h2>
                    </div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Valor de abertura</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={openingValue}
                      onChange={(e) => setOpeningValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-4 text-gray-900"
                    />
                    <button
                      onClick={openRegister}
                      className="w-full h-11 rounded-lg text-white font-bold transition"
                      style={{ background: TERRACOTA }}
                    >
                      Abrir Caixa
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Área direita: carrinho */}
            <aside className="w-96 bg-white flex flex-col justify-between p-4 shadow-lg shrink-0">
              <div className="flex flex-col min-h-0">
                <div className="flex justify-between items-center pb-3 mb-3 border-b" style={{ borderColor: "#F0DFC8" }}>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase" style={{ color: "#7A2E12" }}>Carrinho</h2>
                    {lastOrderNumber !== null && (
                      <p className="text-[11px] text-gray-400 mt-0.5">Último fechado: #{lastOrderNumber}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#EAF3E4", color: GREEN }}>Balcão</span>
                </div>

                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center mt-8">Clique num item pra começar</p>
                  ) : cart.map((l) => (
                    <div key={l.key} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "#FBF3E8" }}>
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white" style={{ border: "1px solid #F0DFC8" }}>
                        <img
                          src={l.imageUrl || PLACEHOLDER_IMG}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-gray-800 truncate">{l.name}</p>
                        {l.size && <span className="text-[11px] text-gray-500 block truncate">{l.size}</span>}
                        {l.notes && <span className="text-[11px] text-gray-500 block truncate">{l.notes}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-xs" style={{ color: TERRACOTA }}>R$ {fmt(l.lineTotal)}</p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <button
                            onClick={() => decLine(l.key)}
                            aria-label={`Diminuir quantidade de ${l.name}`}
                            className="bg-white w-5 h-5 rounded flex items-center justify-center text-gray-600"
                            style={{ border: "1px solid #F0DFC8" }}
                          >
                            <Minus size={11} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{l.qty}</span>
                          <button
                            onClick={() => incLine(l.key)}
                            aria-label={`Aumentar quantidade de ${l.name}`}
                            className="bg-white w-5 h-5 rounded flex items-center justify-center text-gray-600"
                            style={{ border: "1px solid #F0DFC8" }}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-2.5 border-t" style={{ borderColor: "#F0DFC8" }}>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Subtotal ({itemCount})</span>
                  <span>R$ {fmt(total)}</span>
                </div>
                <div className="flex justify-between text-lg font-extrabold" style={{ color: "#7A2E12" }}>
                  <span>Total</span>
                  <span>R$ {fmt(total)}</span>
                </div>

                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full py-3 rounded-xl font-extrabold uppercase text-sm text-white flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                  style={{ background: GREEN }}
                >
                  <CheckCircle2 size={16} />Finalizar pedido
                </button>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full py-3 rounded-xl font-extrabold uppercase text-sm text-white flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                  style={{ background: "#7A2E12" }}
                >
                  <CreditCard size={16} />Pagar agora
                </button>
              </div>
            </aside>
          </div>
        )}

        {sizePrompt && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSizePrompt(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-5 w-full max-w-xs">
              <p className="text-sm font-bold mb-3 text-gray-900">{sizePrompt.name}</p>
              <div className="space-y-2">
                {(sizePrompt.sizes || []).map((s) => (
                  <button
                    key={s.size}
                    onClick={() => pickSize(s)}
                    className="w-full h-11 rounded-lg border border-gray-300 hover:bg-orange-50 flex items-center justify-between px-4 text-sm font-semibold text-gray-800"
                  >
                    <span>{s.size}</span>
                    <span>R$ {fmt(Number(s.price))}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fluxo real de "monte sua marmita" — mesmo componente do /pdv clássico,
            só com --color-primary trocada pra terracota da Marmitaria. */}
        <div style={{ "--color-primary": TERRACOTA } as React.CSSProperties}>
          <ComplementsModal
            open={!!buildProduct}
            productName={buildProduct?.name ?? ""}
            productBasePrice={Number(buildProduct?.salePrice ?? 0)}
            groups={buildGroups}
            loading={buildLoading}
            theme="light"
            onClose={() => { setBuildProduct(null); setBuildGroups([]); }}
            onConfirm={confirmBuild}
          />
        </div>

        {paymentOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPaymentOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
              <p className="text-2xl font-bold mb-4 text-gray-900">R$ {fmt(total)}</p>
              <div className="space-y-2">
                {[
                  { m: "CASH", l: "Dinheiro" },
                  { m: "PIX", l: "PIX" },
                  { m: "CREDIT_CARD", l: "Cartão de crédito" },
                  { m: "DEBIT_CARD", l: "Cartão de débito" },
                ].map((p) => (
                  <button
                    key={p.m}
                    disabled={submitting}
                    onClick={() => finalizeSale(p.m)}
                    className="w-full h-11 rounded-lg border border-gray-300 hover:bg-orange-50 font-semibold text-sm text-gray-800 disabled:opacity-50"
                  >
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
