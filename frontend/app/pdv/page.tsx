"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Plus, Minus, Trash2, Phone, Users, Bike,
  DollarSign, CreditCard, Smartphone, Banknote, X,
  Search, Package, ChevronRight, AlertCircle,
  ShoppingCart, UtensilsCrossed, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductSize = { size: string; price: number };
type Product     = { id: string; name: string; description?: string; salePrice: number; imageUrl?: string; categoryId?: string; sizes?: ProductSize[] };
type Category    = { id: string; name: string; imageUrl?: string; allowMultipleFlavors?: boolean };
type PizzaBorder = { id: string; name: string; isActive: boolean; sizes: ProductSize[] };
type CartItem    = { cartKey: string; product: Product; quantity: number; notes: string; flavors?: Product[]; pizzaSize?: string; pizzaBorderId?: string; borderPrice?: number };
type OrderType   = "DINE_IN" | "PHONE" | "DELIVERY";
type PayMethod   = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
type SplitEntry  = { method: PayMethod; amount: string };

const PAY_OPTIONS: { key: PayMethod; label: string; icon: React.ReactNode }[] = [
  { key: "PIX",         label: "PIX",      icon: <Smartphone size={13} /> },
  { key: "CASH",        label: "Dinheiro", icon: <Banknote size={13} /> },
  { key: "CREDIT_CARD", label: "Crédito",  icon: <CreditCard size={13} /> },
  { key: "DEBIT_CARD",  label: "Débito",   icon: <CreditCard size={13} /> },
];
const ORDER_TYPES = [
  { key: "DINE_IN"  as OrderType, label: "Mesa",     icon: <Users size={14} />  },
  { key: "PHONE"    as OrderType, label: "Telefone", icon: <Phone size={14} />  },
  { key: "DELIVERY" as OrderType, label: "Delivery", icon: <Bike size={14} />   },
];
const PAY_LABELS: Record<PayMethod, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};
const PIZZA_SIZES = [
  { key: "PEQUENA", label: "P",   sub: "Pequena" },
  { key: "MEDIA",   label: "M",   sub: "Média"   },
  { key: "GRANDE",  label: "G",   sub: "Grande"  },
  { key: "FAMILIA", label: "Fam", sub: "Família" },
];

function getPriceForSize(p: Product, size: string) {
  const s = p.sizes?.find((x) => x.size === size);
  return s ? Number(s.price) : Number(p.salePrice);
}
function fmt(n: number) { return `R$ ${n.toFixed(2)}`; }

// ─────────────────────────────────────────────────────────────────────────────
export default function PDVPage() {
  /* cash */
  const [cash, setCash]                     = useState<any>(null);
  const [openingValue, setOpeningValue]     = useState("");
  const [showCashModal, setShowCashModal]   = useState(false);
  const [movType, setMovType]               = useState("SUPPLY");
  const [movValue, setMovValue]             = useState("");

  /* catalog */
  const [categories, setCategories]         = useState<Category[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [borders, setBorders]               = useState<PizzaBorder[]>([]);
  const [activeCat, setActiveCat]           = useState("ALL");
  const [search, setSearch]                 = useState("");
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(false);

  /* cart */
  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]             = useState(false);
  const [orderType, setOrderType]           = useState<OrderType>("DINE_IN");
  const [payMethod, setPayMethod]           = useState<PayMethod>("PIX");
  const [customerName, setCustomerName]     = useState("");
  const [customerPhone, setCustomerPhone]   = useState("");
  const [tableNumber, setTableNumber]       = useState("");
  const [address, setAddress]               = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [orderDone, setOrderDone]           = useState<string | null>(null);

  /* pizza */
  const [showPizzaModal, setShowPizzaModal] = useState(false);
  const [flavorParts, setFlavorParts]       = useState(2);
  const [flavorSlots, setFlavorSlots]       = useState<(Product | null)[]>([null, null]);
  const [flavorFilter, setFlavorFilter]     = useState("");
  const [pizzaSize, setPizzaSize]           = useState("MEDIA");
  const [pizzaBorder, setPizzaBorder]       = useState<PizzaBorder | null>(null);
  const [pizzaSlot, setPizzaSlot]           = useState(0);

  /* split */
  const [splitMode, setSplitMode]           = useState(false);
  const [splits, setSplits]                 = useState<SplitEntry[]>([
    { method: "PIX", amount: "" }, { method: "CASH", amount: "" },
  ]);

  // ── load ──────────────────────────────────────────────────────────────────
  const loadCash = useCallback(async () => {
    try { setCash((await api.get("/cash/current")).data); } catch {}
  }, []);
  const loadCatalog = useCallback(async () => {
    setLoadError(false); setLoading(true);
    try {
      const [cR, pR] = await Promise.all([api.get("/categories"), api.get("/products")]);
      setCategories(Array.isArray(cR.data) ? cR.data : []);
      setProducts(Array.isArray(pR.data) ? pR.data : []);
    } catch { setLoadError(true); toast.error("Erro ao carregar"); }
    finally { setLoading(false); }
    try { const bR = await api.get("/pizza-borders"); setBorders(Array.isArray(bR.data) ? bR.data : []); } catch {}
  }, []);
  useEffect(() => { loadCash(); loadCatalog(); }, []);

  // ── cash ──────────────────────────────────────────────────────────────────
  async function openCash() {
    const v = Number(openingValue);
    if (!openingValue || isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    try { await api.post("/cash/open", { openingValue: v }); setOpeningValue(""); loadCash(); toast.success("Caixa aberto!"); setShowCashModal(false); } catch { toast.error("Erro"); }
  }
  async function movement() {
    const v = Number(movValue);
    if (!movValue || isNaN(v) || v <= 0) { toast.error("Valor inválido"); return; }
    try { await api.post("/cash/movement", { type: movType, value: v }); setMovValue(""); loadCash(); toast.success("Registrado"); } catch { toast.error("Erro"); }
  }
  async function closeCash() {
    if (!confirm("Fechar o caixa?")) return;
    try { await api.patch("/cash/close"); loadCash(); toast.success("Fechado"); } catch { toast.error("Erro"); }
  }

  // ── cart ──────────────────────────────────────────────────────────────────
  function addToCart(product: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.cartKey === product.id);
      if (ex) return prev.map((i) => i.cartKey === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartKey: product.id, product, quantity: 1, notes: "" }];
    });
  }
  function updateQty(key: string, delta: number) {
    setCart((p) => p.map((i) => i.cartKey !== key ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }
  function removeItem(key: string) { setCart((p) => p.filter((i) => i.cartKey !== key)); }
  function clearCart() { setCart([]); setCustomerName(""); setCustomerPhone(""); setTableNumber(""); setAddress(""); }
  const cartTotal = cart.reduce((a, i) => a + Number(i.product.salePrice) * i.quantity, 0);
  const cartCount = cart.reduce((a, i) => a + i.quantity, 0);

  // ── pizza ──────────────────────────────────────────────────────────────────
  function openPizzaModal(product?: Product) {
    setFlavorParts(2); setFlavorSlots(product ? [product, null] : [null, null]);
    setFlavorFilter(""); setPizzaSize("MEDIA"); setPizzaBorder(null);
    setPizzaSlot(product ? 1 : 0); setShowPizzaModal(true);
  }
  function changeFlavorParts(n: number) {
    setFlavorParts(n); setPizzaSlot(0);
    setFlavorSlots(Array(n).fill(null).map((_, i) => flavorSlots[i] ?? null));
  }
  function setSlot(i: number, v: Product | null) { setFlavorSlots((p) => p.map((s, x) => x === i ? v : s)); }
  function pickFlavor(product: Product) {
    setFlavorSlots((p) => {
      const next = [...p]; next[pizzaSlot] = product;
      const ne = next.findIndex((s, i) => i > pizzaSlot && !s);
      if (ne !== -1) setPizzaSlot(ne);
      return next;
    });
  }
  function confirmFlavors() {
    const chosen = flavorSlots.filter(Boolean) as Product[];
    if (!chosen.length) { toast.error("Selecione ao menos 1 sabor"); return; }
    if (flavorParts > 1 && chosen.length < 2) { toast.error("Selecione ao menos 2 sabores"); return; }
    const unit = Math.max(...chosen.map((f) => getPriceForSize(f, pizzaSize)));
    const bp   = pizzaBorder ? Number(pizzaBorder.sizes.find((s) => s.size === pizzaSize)?.price || 0) : 0;
    const fracs = ["", "½ ", "⅓ ", "¼ "];
    const sl    = PIZZA_SIZES.find((s) => s.key === pizzaSize)?.label || pizzaSize;
    const note  = `Tam: ${sl}${pizzaBorder ? ` | Borda: ${pizzaBorder.name}` : ""} | ${chosen.map((f) => `${fracs[flavorParts - 1] || ""}${f.name}`).join(" | ")}`;
    const name  = `🍕 Pizza ${sl}${chosen.length > 1 ? ` ${chosen.length} sabores` : ""}: ${chosen.map((f) => f.name).join(" + ")}`;
    setCart((p) => [...p, {
      cartKey: `pizza-${Date.now()}`,
      product: { ...chosen[0], name, salePrice: unit + bp },
      quantity: 1, notes: note, flavors: chosen, pizzaSize,
      pizzaBorderId: pizzaBorder?.id,
      borderPrice: bp > 0 ? bp : undefined,
    }]);
    setShowPizzaModal(false); setCartOpen(true); toast.success("Pizza adicionada!");
  }
  const flavorCatIds = new Set(categories.filter((c) => c.allowMultipleFlavors).map((c) => c.id));
  const flavorPool   = flavorCatIds.size > 0 ? products.filter((p) => flavorCatIds.has(p.categoryId || "")) : products;
  const forFlavor    = flavorPool.filter((p) => !flavorFilter || p.name.toLowerCase().includes(flavorFilter.toLowerCase()));
  const chosen       = flavorSlots.filter(Boolean) as Product[];
  const previewUnit  = chosen.length ? Math.max(...chosen.map((f) => getPriceForSize(f, pizzaSize))) : 0;
  const previewBp    = pizzaBorder ? Number(pizzaBorder.sizes.find((s) => s.size === pizzaSize)?.price || 0) : 0;

  // ── split ──────────────────────────────────────────────────────────────────
  const splitSum  = splits.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0);
  const splitRem  = cartTotal - splitSum;
  const splitOk   = Math.abs(splitRem) < 0.02;
  function addSplit() { if (splits.length < 4) setSplits((p) => [...p, { method: "PIX", amount: "" }]); }
  function removeSplit(i: number) { setSplits((p) => p.filter((_, x) => x !== i)); }
  function updateSplit(i: number, f: keyof SplitEntry, v: string) { setSplits((p) => p.map((s, x) => x === i ? { ...s, [f]: v } : s)); }

  // ── submit ─────────────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!cart.length) { toast.error("Adicione produtos"); return; }
    if (orderType === "PHONE" && !customerPhone) { toast.error("Informe o telefone"); return; }
    if (orderType === "DELIVERY" && !address) { toast.error("Informe o endereço"); return; }
    if (splitMode && !splitOk) { toast.error("Pagamentos não fecham"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        customerName: customerName || (orderType === "DINE_IN" ? `Mesa ${tableNumber || "—"}` : "Cliente"),
        customerPhone: customerPhone || "PDV",
        deliveryAddress: address || "INTERNO",
        orderType,
        paymentMethod: splitMode ? splits[0].method : payMethod,
        notes: splitMode ? `Pag. dividido: ${splits.map((s) => `${PAY_LABELS[s.method]} R$${parseFloat(s.amount || "0").toFixed(2)}`).join(" | ")}` : undefined,
        items: cart.map((i) => ({
          productId: i.flavors ? i.flavors[0].id : i.product.id,
          quantity: i.quantity, unitPrice: i.product.salePrice,
          subtotal: Number(i.product.salePrice) * i.quantity,
          productName: i.product.name, notes: i.notes,
          ...(i.pizzaSize    && { pizzaSize: i.pizzaSize }),
          ...(i.pizzaBorderId && { pizzaBorderId: i.pizzaBorderId }),
          ...(i.borderPrice  && { borderPrice: i.borderPrice }),
          ...(i.flavors?.length && { flavors: i.flavors.map((f, x) => ({ productId: f.id, position: x + 1 })) }),
        })),
        subtotal: cartTotal, total: cartTotal, deliveryFee: 0,
      });
      setOrderDone(`#${res.data?.id?.slice(-6)?.toUpperCase() || "OK"}`);
      clearCart(); setCartOpen(false); setSplitMode(false);
      setSplits([{ method: "PIX", amount: "" }, { method: "CASH", amount: "" }]);
      loadCash();
    } catch { toast.error("Erro ao finalizar"); }
    finally { setSubmitting(false); }
  }

  // ── filters ────────────────────────────────────────────────────────────────
  const filtered     = products.filter((p) =>
    (activeCat === "ALL" || p.categoryId === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );
  const activeCatObj = categories.find((c) => c.id === activeCat);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — fixed full-screen Goomer clone
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden text-white"
      style={{ background: "#15172A", fontFamily: "Inter, sans-serif" }}>

      {/* ───────────────────────────────────────────────────────────────────
          TOP BAR
      ─────────────────────────────────────────────────────────────────── */}
      <header className="h-[60px] flex items-center shrink-0" style={{ background: "#0F1120" }}>

        {/* Blue logo block — exact Goomer style */}
        <div className="w-[160px] h-full flex items-center justify-center shrink-0"
          style={{ background: "#2563EB" }}>
          <UtensilsCrossed size={22} className="text-white" />
          <span className="text-white font-black text-lg ml-2">PDV</span>
        </div>

        {/* Search */}
        <div className="relative mx-4 w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="w-full h-9 rounded-lg pl-8 pr-3 text-[12px] text-white placeholder-white/30 focus:outline-none border"
            style={{ background: "#1E2138", borderColor: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Table number field when DINE_IN */}
        {orderType === "DINE_IN" && (
          <div className="mr-3">
            <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Mesa nº"
              className="h-9 w-[90px] rounded-lg px-3 text-[12px] text-white placeholder-white/30 focus:outline-none border text-center font-semibold"
              style={{ background: "#1E2138", borderColor: "rgba(255,255,255,0.08)" }} />
          </div>
        )}

        <div className="flex-1" />

        {/* Order type blue tabs */}
        {ORDER_TYPES.map((t) => (
          <button key={t.key} onClick={() => setOrderType(t.key)}
            className="flex items-center gap-2 h-full px-5 text-[12px] font-bold transition-all border-r"
            style={{
              background: orderType === t.key ? "#2563EB" : "transparent",
              color: orderType === t.key ? "#fff" : "rgba(255,255,255,0.45)",
              borderColor: "rgba(255,255,255,0.07)",
            }}>
            {t.icon}
            <span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}

        {/* Cart / order button */}
        <button onClick={() => setCartOpen((v) => !v)}
          className="relative flex items-center gap-2.5 h-full px-5 text-[12px] font-black transition-all"
          style={{ background: cartOpen ? "#2563EB" : "#1D3A8A", minWidth: 140 }}>
          <ShoppingCart size={17} className="text-white shrink-0" />
          {cartCount === 0 ? (
            <span className="text-white/60">Pedido</span>
          ) : (
            <>
              <span className="text-white">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
              <span className="text-blue-200 font-black">{fmt(cartTotal)}</span>
            </>
          )}
          {cartCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-orange-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </header>

      {/* ───────────────────────────────────────────────────────────────────
          BODY  [left-nav 150px] [category-cards 210px] [products flex-1]
      ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── COL 1: Left nav ────────────────────────────────────────────── */}
        <aside className="w-[150px] flex flex-col overflow-hidden shrink-0 border-r"
          style={{ background: "#0F1120", borderColor: "rgba(255,255,255,0.06)" }}>

          {/* Cash status */}
          <button onClick={() => setShowCashModal(true)}
            className="mx-2 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition"
            style={{
              background: cash?.isOpen ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              borderColor: cash?.isOpen ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
              color: cash?.isOpen ? "#34D399" : "#F87171",
            }}>
            <DollarSign size={12} />
            <span className="truncate">{cash?.isOpen ? fmt(Number(cash.balance)) : "Fechado"}</span>
          </button>

          {/* Order context */}
          <div className="px-3 py-2 border-b text-[11px]" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {orderType === "DINE_IN" && tableNumber && (
              <div className="text-white/50">Mesa: <span className="text-white font-bold">{tableNumber}</span></div>
            )}
            {(orderType === "PHONE" || orderType === "DELIVERY") && customerName && (
              <div className="text-white/50 truncate">{customerName}</div>
            )}
            {cart.length > 0 && (
              <div className="mt-1 space-y-0.5 max-h-[280px] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-center justify-between py-0.5">
                    <span className="text-white/40 text-[10px] truncate flex-1 mr-1">{item.product.name}</span>
                    <span className="text-white/60 text-[10px] font-bold shrink-0">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
            {cart.length === 0 && (
              <p className="text-white/20 text-[10px] mt-1">Pedido vazio</p>
            )}
          </div>

          <div className="flex-1" />

          {/* Pizza CTA */}
          <div className="p-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => openPizzaModal()}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition"
              style={{ background: "#F97316" }}>
              🍕 Montar Pizza
            </button>
          </div>
        </aside>

        {/* ── COL 2: Category cards ──────────────────────────────────────── */}
        <div className="w-[210px] overflow-y-auto shrink-0 border-r"
          style={{ background: "#12142A", borderColor: "rgba(255,255,255,0.06)" }}>

          {/* "Todos" */}
          <button onClick={() => setActiveCat("ALL")}
            className="w-full flex items-center justify-center text-center px-3 font-semibold text-[13px] transition-all border-b"
            style={{
              height: 72,
              background: activeCat === "ALL" ? "rgba(37,99,235,0.2)" : "transparent",
              color: activeCat === "ALL" ? "#93C5FD" : "rgba(255,255,255,0.55)",
              borderColor: "rgba(255,255,255,0.07)",
              borderLeft: activeCat === "ALL" ? "3px solid #2563EB" : "3px solid transparent",
            }}>
            Todos os Itens
          </button>

          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className="w-full flex items-center justify-center text-center px-3 font-semibold text-[13px] transition-all border-b leading-tight"
              style={{
                height: 72,
                background: activeCat === cat.id ? "rgba(37,99,235,0.2)" : "transparent",
                color: activeCat === cat.id ? "#93C5FD" : "rgba(255,255,255,0.55)",
                borderColor: "rgba(255,255,255,0.07)",
                borderLeft: activeCat === cat.id ? "3px solid #2563EB" : "3px solid transparent",
              }}>
              {cat.name}
            </button>
          ))}

          <div className="p-3">
            <button onClick={() => openPizzaModal()}
              className="w-full py-3 rounded-xl text-[12px] font-black text-white"
              style={{ background: "#F97316" }}>
              🍕 Montar Pizza
            </button>
          </div>
        </div>

        {/* ── COL 3: Product area ────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "#15172A" }}>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[170px] rounded-2xl animate-pulse" style={{ background: "#1E2138" }} />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle size={32} className="text-red-400" />
                <p className="text-white/50 text-sm">Erro ao carregar cardápio</p>
                <button onClick={loadCatalog} className="flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:text-blue-300 transition">
                  <RefreshCw size={13} /> Tentar novamente
                </button>
              </div>
            ) : (
              <>
                {/* Category banner */}
                {activeCat !== "ALL" && activeCatObj && (
                  <div className="relative rounded-2xl overflow-hidden mb-4 flex items-end"
                    style={{ height: 160, background: "#1E2138" }}>
                    {activeCatObj.imageUrl && (
                      <img src={activeCatObj.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    )}
                    {!activeCatObj.imageUrl && filtered[0]?.imageUrl && (
                      <img src={filtered[0].imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                    )}
                    <div className="absolute inset-0"
                      style={{ background: "linear-gradient(to right, rgba(15,17,32,0.95) 35%, rgba(15,17,32,0.3))" }} />
                    <div className="relative z-10 px-6 py-5">
                      <h2 className="text-[24px] font-black text-white leading-tight">{activeCatObj.name}</h2>
                      <p className="text-white/50 text-[13px] mt-1">
                        {filtered.length} {filtered.length === 1 ? "item disponível" : "itens disponíveis"}
                      </p>
                    </div>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="text-5xl opacity-20">🍽️</div>
                    <p className="text-white/30 text-sm">
                      {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((product) => {
                      const inCart   = cart.find((i) => i.cartKey === product.id);
                      const hasSizes = !!(product.sizes?.length);
                      return (
                        <div key={product.id}
                          className="flex rounded-2xl overflow-hidden transition-all group"
                          style={{
                            background: inCart ? "rgba(37,99,235,0.1)" : "#1E2138",
                            border: inCart ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(255,255,255,0.05)",
                            minHeight: 160,
                          }}>

                          {/* IMAGE — LEFT (~35%) */}
                          <div className="w-[200px] shrink-0 relative overflow-hidden"
                            style={{ minHeight: 160, background: "#252844" }}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                style={{ minHeight: 160 }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-6xl opacity-10"
                                style={{ minHeight: 160 }}>🍽️</div>
                            )}
                            {inCart && (
                              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                                style={{ background: "#2563EB" }}>
                                ×{inCart.quantity}
                              </div>
                            )}
                          </div>

                          {/* CONTENT — RIGHT */}
                          <div className="flex-1 px-5 py-4 flex flex-col justify-between min-w-0">
                            <div>
                              {/* Name + price row */}
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <p className="font-bold text-[16px] text-white leading-snug line-clamp-2 flex-1">
                                  {product.name}
                                </p>
                                {!hasSizes && (
                                  <div className="text-right shrink-0">
                                    <p className="text-[18px] font-black text-white">
                                      {fmt(Number(product.salePrice))}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Description */}
                              {product.description && (
                                <p className="text-[13px] leading-relaxed line-clamp-3"
                                  style={{ color: "rgba(255,255,255,0.45)" }}>
                                  {product.description}
                                </p>
                              )}
                              {hasSizes && (
                                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                                  Preço varia por tamanho
                                </p>
                              )}
                            </div>

                            {/* Actions row */}
                            <div className="flex items-center justify-end gap-2 mt-3">
                              {/* Pizza shortcut */}
                              <button onClick={() => openPizzaModal(product)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all active:scale-90"
                                style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}
                                title="Montar pizza">🍕</button>

                              {/* ADICIONAR / qty stepper */}
                              {!hasSizes && (
                                inCart ? (
                                  <div className="flex items-center gap-0 rounded-xl overflow-hidden border"
                                    style={{ borderColor: "rgba(37,99,235,0.4)" }}>
                                    <button onClick={() => updateQty(product.id, -1)}
                                      className="w-10 h-10 flex items-center justify-center transition font-bold"
                                      style={{ background: "rgba(37,99,235,0.2)", color: "#93C5FD" }}>
                                      <Minus size={14} />
                                    </button>
                                    <span className="w-10 text-center text-[14px] font-black"
                                      style={{ color: "#93C5FD" }}>{inCart.quantity}</span>
                                    <button onClick={() => updateQty(product.id, 1)}
                                      className="w-10 h-10 flex items-center justify-center transition font-bold"
                                      style={{ background: "#2563EB", color: "#fff" }}>
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => addToCart(product)}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-[13px] transition-all active:scale-95"
                                    style={{ background: "#2563EB" }}>
                                    ADICIONAR
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Cart drawer (desliza da direita) ──────────────────────────── */}
        <div className={`absolute right-0 top-0 bottom-0 w-[300px] flex flex-col shadow-2xl transition-transform duration-300 ease-out border-l z-10 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`} style={{ background: "#0F1120", borderColor: "rgba(255,255,255,0.08)" }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-blue-400" />
              <span className="text-[13px] font-black text-white">Pedido</span>
              {cartCount > 0 && (
                <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full"
                  style={{ background: "#2563EB" }}>{cartCount}</span>
              )}
            </div>
            <button onClick={() => setCartOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              <X size={13} />
            </button>
          </div>

          {/* Customer fields */}
          <div className="px-3.5 py-3 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="space-y-2">
              {orderType === "DINE_IN" && (
                <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="Nº da mesa"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none border transition"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
              )}
              {(orderType === "PHONE" || orderType === "DELIVERY") && (<>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefone *"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
              </>)}
              {orderType === "DELIVERY" && (
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço *"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
              )}
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 gap-2">
                <ShoppingCart size={24} style={{ color: "rgba(255,255,255,0.1)" }} />
                <p className="text-[12px] text-center leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Clique em <b className="text-blue-400">ADICIONAR</b><br/>para montar o pedido
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-start gap-3 px-3.5 py-3">
                    <div className="shrink-0">
                      {item.flavors
                        ? <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                            style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)" }}>🍕</div>
                        : item.product.imageUrl
                          ? <img src={item.product.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                          : <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.06)" }}>
                              <Package size={14} style={{ color: "rgba(255,255,255,0.2)" }} />
                            </div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold leading-tight line-clamp-2"
                        style={{ color: "rgba(255,255,255,0.8)" }}>{item.product.name}</p>
                      {item.notes && item.flavors && (
                        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "rgba(249,115,22,0.7)" }}>{item.notes}</p>
                      )}
                      <p className="text-[13px] font-black mt-1 text-blue-400">{fmt(Number(item.product.salePrice) * item.quantity)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.cartKey, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}><Minus size={9} /></button>
                      <span className="w-5 text-center text-[11px] font-black" style={{ color: "rgba(255,255,255,0.7)" }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.cartKey, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}><Plus size={9} /></button>
                      <button onClick={() => removeItem(item.cartKey)} className="w-6 h-6 rounded-lg flex items-center justify-center ml-1 transition"
                        style={{ background: "rgba(239,68,68,0.1)", color: "rgba(248,113,113,0.7)", border: "1px solid rgba(239,68,68,0.15)" }}><X size={9} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="px-3.5 pb-4 pt-3 border-t space-y-3 shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>Pagamento</p>
              <button onClick={() => setSplitMode(!splitMode)}
                className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition border"
                style={splitMode
                  ? { background: "rgba(139,92,246,0.15)", color: "#C4B5FD", borderColor: "rgba(139,92,246,0.25)" }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.07)" }}>
                {splitMode ? "✓ Dividido" : "Dividir"}
              </button>
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_OPTIONS.map((p) => (
                  <button key={p.key} onClick={() => setPayMethod(p.key)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border"
                    style={payMethod === p.key
                      ? { background: "#2563EB", color: "#fff", borderColor: "#2563EB" }
                      : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.07)" }}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {splits.map((split, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={split.method} onChange={(e) => updateSplit(i, "method", e.target.value as PayMethod)}
                      className="rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none w-[88px] shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {PAY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>R$</span>
                      <input type="number" step="0.01" min="0" value={split.amount}
                        onChange={(e) => updateSplit(i, "amount", e.target.value)} placeholder="0,00"
                        className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
                    </div>
                    {splits.length > 1 && <button onClick={() => removeSplit(i)} style={{ color: "rgba(255,255,255,0.2)" }} className="hover:text-red-400 transition"><X size={11} /></button>}
                  </div>
                ))}
                {splits.length < 4 && (
                  <button onClick={addSplit} className="text-[11px] font-semibold flex items-center gap-1 transition" style={{ color: "#60A5FA" }}>
                    <Plus size={10} /> Adicionar forma
                  </button>
                )}
                <div className="flex justify-between text-[11px] font-bold px-3 py-2 rounded-xl border"
                  style={splitOk
                    ? { color: "#34D399", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }
                    : { color: "#FCA5A5", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)" }}>
                  <span>{splitOk ? "✓ Valores fecham" : splitRem > 0 ? "Faltam:" : "Excesso:"}</span>
                  {!splitOk && <span>R$ {Math.abs(splitRem).toFixed(2)}</span>}
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 border"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Total</p>
                </div>
                <span className="text-[20px] font-black text-white">{fmt(cartTotal)}</span>
              </div>
            )}

            <div className="flex gap-2">
              {cart.length > 0 && (
                <button onClick={clearCart}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={submitOrder} disabled={submitting || cart.length === 0}
                className="flex-1 h-11 rounded-xl font-black text-[13px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                style={{ background: "#2563EB" }}>
                {submitting ? <span className="animate-pulse text-xs">Processando…</span> : <><ChevronRight size={15} /> Finalizar Pedido</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ MODAL Pizza ══════════════════════════════════════════════════ */}
      {showPizzaModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border"
            style={{ background: "#13162A", borderColor: "rgba(255,255,255,0.09)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div>
                <h2 className="text-base font-black text-white">🍕 Montar Pizza</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Preço = sabor mais caro + borda</p>
              </div>
              <button onClick={() => setShowPizzaModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition border"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.08)" }}>
                <X size={15} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {/* 1. Size */}
              <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>1. Tamanho</p>
                <div className="flex items-end justify-around gap-2">
                  {PIZZA_SIZES.map((s) => (
                    <button key={s.key} onClick={() => setPizzaSize(s.key)}
                      className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all border-2"
                      style={pizzaSize === s.key
                        ? { borderColor: "#F97316", background: "rgba(249,115,22,0.1)" }
                        : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black transition-all"
                        style={pizzaSize === s.key
                          ? { background: "#F97316", color: "#fff" }
                          : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                        <span className="text-sm">{s.label}</span>
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* 2. Border */}
              <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>2. Borda</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setPizzaBorder(null)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                    style={!pizzaBorder ? { borderColor: "#F97316", background: "#F97316", color: "#fff" } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)" }}>
                    🚫 Sem borda
                  </button>
                  {borders.filter((b) => b.isActive).map((border) => {
                    const sp = border.sizes.find((s) => s.size === pizzaSize);
                    const sel = pizzaBorder?.id === border.id;
                    return (
                      <button key={border.id} onClick={() => setPizzaBorder(border)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                        style={sel ? { borderColor: "#F97316", background: "#F97316", color: "#fff" } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)" }}>
                        🧀 {border.name}
                        {sp && <span className="text-xs" style={{ color: sel ? "rgba(255,255,255,0.75)" : "#FB923C" }}>+R${Number(sp.price).toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 3. Parts */}
              <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>3. Quantos Sabores?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[{ n: 1, label: "Inteira", icon: "🍕" }, { n: 2, label: "Meio a Meio", icon: "½" }, { n: 3, label: "3 Sabores", icon: "⅓" }, { n: 4, label: "4 Sabores", icon: "¼" }].map(({ n, label, icon }) => (
                    <button key={n} onClick={() => changeFlavorParts(n)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl font-bold text-xs transition-all border-2"
                      style={flavorParts === n
                        ? { borderColor: "#F97316", background: "rgba(249,115,22,0.1)", color: "#FB923C" }
                        : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>
                      <span className="text-xl">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 4. Flavors */}
              <div className="px-6 py-4">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>4. Escolha os Sabores</p>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {Array.from({ length: flavorParts }).map((_, i) => {
                    const sel = flavorSlots[i];
                    const frac = ["Inteiro", "½", "⅓", "¼"][flavorParts - 1] || "¼";
                    return (
                      <button key={i} onClick={() => setPizzaSlot(i)}
                        className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all"
                        style={pizzaSlot === i
                          ? { borderColor: "#F97316", background: "rgba(249,115,22,0.1)", color: "#FB923C" }
                          : sel
                            ? { borderColor: "rgba(16,185,129,0.5)", background: "rgba(16,185,129,0.1)", color: "#34D399" }
                            : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)" }}>
                        <span className="font-black text-orange-400">{frac}</span>
                        <span className="font-medium max-w-[100px] truncate">{sel ? sel.name : `Sabor ${i + 1}`}</span>
                        {sel && <button onClick={(e) => { e.stopPropagation(); setSlot(i, null); }} style={{ color: "rgba(255,255,255,0.25)" }} className="hover:text-red-400 transition ml-1"><X size={11} /></button>}
                      </button>
                    );
                  })}
                </div>
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <input value={flavorFilter} onChange={(e) => setFlavorFilter(e.target.value)}
                    placeholder={`Buscar sabor ${pizzaSlot + 1}…`}
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none border"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", "::placeholder": { color: "rgba(255,255,255,0.2)" } } as any} />
                </div>
                {forFlavor.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {flavorCatIds.size === 0 ? 'Configure categorias com "Permite múltiplos sabores".' : "Nenhum sabor encontrado."}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {forFlavor.map((p) => {
                      const inSlot = flavorSlots[pizzaSlot]?.id === p.id;
                      const inOther = flavorSlots.some((s, i) => s?.id === p.id && i !== pizzaSlot);
                      return (
                        <button key={p.id} onClick={() => pickFlavor(p)}
                          className="relative text-left rounded-2xl border-2 overflow-hidden transition-all"
                          style={inSlot ? { borderColor: "#F97316" } : inOther ? { borderColor: "rgba(16,185,129,0.5)", opacity: 0.8 } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                          <div className="h-16 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🍕</div>}
                          </div>
                          <div className="p-2" style={{ background: "#1A1D2E" }}>
                            <p className="text-[11px] font-semibold leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.65)" }}>{p.name}</p>
                            <p className="text-[11px] font-black mt-0.5 text-orange-400">R$ {getPriceForSize(p, pizzaSize).toFixed(2)}</p>
                          </div>
                          {inSlot && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow" style={{ background: "#F97316" }}>✓</div>}
                          {inOther && !inSlot && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow" style={{ background: "#10B981" }}>✓</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Footer */}
            <div className="shrink-0 border-t px-6 py-4" style={{ background: "#13162A", borderColor: "rgba(255,255,255,0.07)" }}>
              {chosen.length > 0 && (
                <div className="rounded-2xl px-4 py-3 mb-3 flex items-center justify-between border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="min-w-0 mr-4">
                    <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Pizza {PIZZA_SIZES.find((s) => s.key === pizzaSize)?.sub}{pizzaBorder ? ` · Borda ${pizzaBorder.name}` : ""}
                    </p>
                    <p className="text-sm font-bold mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.75)" }}>{chosen.map((f) => f.name).join(" + ")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>Total</p>
                    <p className="text-2xl font-black text-orange-400">R$ {(previewUnit + previewBp).toFixed(2)}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowPizzaModal(false)}
                  className="px-5 py-3 rounded-xl font-semibold text-sm border transition"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.08)" }}>
                  Cancelar
                </button>
                <button onClick={confirmFlavors} disabled={!flavorSlots.some(Boolean)}
                  className="flex-1 py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "#F97316" }}>
                  <Plus size={14} /> Adicionar ao Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL Cash ════════════════════════════════════════════════════ */}
      {showCashModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl p-6 w-full max-w-md shadow-2xl border"
            style={{ background: "#13162A", borderColor: "rgba(255,255,255,0.09)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-white">Controle de Caixa</h2>
              <button onClick={() => setShowCashModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition border"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.08)" }}>
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Saldo",    v: cash?.balance || 0, c: "#34D399", bg: "rgba(16,185,129,0.1)",  b: "rgba(16,185,129,0.2)"  },
                { label: "Entradas", v: cash?.entries || 0, c: "#60A5FA", bg: "rgba(37,99,235,0.1)",   b: "rgba(37,99,235,0.2)"   },
                { label: "Saídas",   v: cash?.exits   || 0, c: "#F87171", bg: "rgba(239,68,68,0.1)",   b: "rgba(239,68,68,0.2)"   },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-3 border" style={{ background: s.bg, borderColor: s.b }}>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                  <p className="font-black text-sm mt-1" style={{ color: s.c }}>R$ {Number(s.v).toFixed(2)}</p>
                </div>
              ))}
            </div>
            {!cash?.isOpen ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Informe o valor inicial:</p>
                <input type="number" value={openingValue} onChange={(e) => setOpeningValue(e.target.value)} placeholder="R$ 0,00"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
                <button onClick={openCash} className="w-full py-3 rounded-xl font-black text-white" style={{ background: "#2563EB" }}>
                  Abrir Caixa
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <select value={movType} onChange={(e) => setMovType(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <option value="SUPPLY">Reforço de caixa</option>
                  <option value="WITHDRAW">Sangria</option>
                </select>
                <input type="number" value={movValue} onChange={(e) => setMovValue(e.target.value)} placeholder="Valor (R$)"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none border"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }} />
                <div className="flex gap-2">
                  <button onClick={movement} className="flex-1 py-3 rounded-xl font-semibold text-white" style={{ background: "#2563EB" }}>Registrar</button>
                  <button onClick={closeCash} className="px-4 py-3 rounded-xl font-semibold text-sm border transition"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#F87171", borderColor: "rgba(239,68,68,0.2)" }}>Fechar Caixa</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ MODAL Order done ══════════════════════════════════════════════ */}
      {orderDone && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl border"
            style={{ background: "#13162A", borderColor: "rgba(255,255,255,0.09)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border"
              style={{ background: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.25)" }}>
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-3xl font-black mb-2" style={{ color: "#34D399" }}>Pedido Enviado!</h2>
            <p className="mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Pedido <span className="text-white font-black">{orderDone}</span></p>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.25)" }}>Enviado para a cozinha e registrado.</p>
            <button onClick={() => setOrderDone(null)}
              className="w-full py-3.5 rounded-2xl font-black text-lg text-white"
              style={{ background: "#2563EB" }}>
              Novo Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
