"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Plus, Minus, Trash2, Phone, Users, Bike,
  DollarSign, CreditCard, Smartphone, Banknote, X,
  Search, Package, ChevronRight, AlertCircle,
  ShoppingCart, UtensilsCrossed, RefreshCw,
  LayoutDashboard, CookingPot, Store,
  Palette, QrCode, ExternalLink, Puzzle,
} from "lucide-react";

// ─── Theme Constants (Goomer-style dark with blue accents) ─────────────────
const T = {
  bgPrimary:    "#0A0A0C",
  bgSecondary:  "#111114",
  bgTertiary:   "#18181C",
  bgCard:       "#1D1D22",
  bgElevated:   "#232328",
  border:       "#2A2A30",
  borderSoft:   "#1F1F24",
  textPrimary:  "#FFFFFF",
  textSecond:   "#B8B8C0",
  textTertiary: "#6D6D78",
  accent:       "#2563FF",
  accentHover:  "#3D75FF",
  accentDim:    "#1E4FD9",
  danger:       "#FF4757",
  success:      "#2ED573",
  orange:       "#F97316",
};

// ─── Types ─────────────────────────────────────────────────────────────────
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
function fmt(n: number) { return `R$ ${n.toFixed(2).replace(".", ",")}`; }

function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pizza") || n.includes("pizz")) return "🍕";
  if (n.includes("lanche") || n.includes("burger") || n.includes("hamburguer")) return "🍔";
  if (n.includes("bebida") || n.includes("drink") || n.includes("suco") || n.includes("refri")) return "🥤";
  if (n.includes("sobremesa") || n.includes("doce") || n.includes("sorvete")) return "🍰";
  if (n.includes("salada") || n.includes("vegano") || n.includes("vegetal")) return "🥗";
  if (n.includes("frango") || n.includes("chicken") || n.includes("asa")) return "🍗";
  if (n.includes("carne") || n.includes("steak") || n.includes("picanha") || n.includes("churrasco")) return "🥩";
  if (n.includes("peixe") || n.includes("salmão") || n.includes("frutos")) return "🐟";
  if (n.includes("massa") || n.includes("macarrão") || n.includes("espaguete") || n.includes("pasta")) return "🍝";
  if (n.includes("porcao") || n.includes("porção") || n.includes("aperitivo") || n.includes("entrada")) return "🍟";
  if (n.includes("sopa") || n.includes("caldo")) return "🍲";
  if (n.includes("cafe") || n.includes("café") || n.includes("expresso")) return "☕";
  if (n.includes("açaí") || n.includes("acai")) return "🫐";
  if (n.includes("tapioca") || n.includes("crepe")) return "🫓";
  if (n.includes("combo") || n.includes("promoção") || n.includes("promo")) return "🎁";
  if (n.includes("adicional") || n.includes("extra")) return "➕";
  if (n.includes("prato") || n.includes("executivo") || n.includes("almoço")) return "🍽️";
  if (n.includes("kids") || n.includes("infantil") || n.includes("criança")) return "🧒";
  if (n.includes("veggie") || n.includes("natural")) return "🌿";
  return "🍴";
}

// ───────────────────────────────────────────────────────────────────────────
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

  // ── load ────────────────────────────────────────────────────────────────
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

  // ── cash ────────────────────────────────────────────────────────────────
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

  // ── cart ────────────────────────────────────────────────────────────────
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

  // ── pizza ───────────────────────────────────────────────────────────────
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

  // ── split ───────────────────────────────────────────────────────────────
  const splitSum  = splits.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0);
  const splitRem  = cartTotal - splitSum;
  const splitOk   = Math.abs(splitRem) < 0.02;
  function addSplit() { if (splits.length < 4) setSplits((p) => [...p, { method: "PIX", amount: "" }]); }
  function removeSplit(i: number) { setSplits((p) => p.filter((_, x) => x !== i)); }
  function updateSplit(i: number, f: keyof SplitEntry, v: string) { setSplits((p) => p.map((s, x) => x === i ? { ...s, [f]: v } : s)); }

  // ── submit ──────────────────────────────────────────────────────────────
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

  // ── filters ─────────────────────────────────────────────────────────────
  const filtered     = products.filter((p) =>
    (activeCat === "ALL" || p.categoryId === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );
  const activeCatObj = categories.find((c) => c.id === activeCat);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Goomer-style dark with vibrant blue accents
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden text-white"
      style={{
        background: T.bgPrimary,
        fontFamily: "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        letterSpacing: "-0.01em",
      }}
    >

      {/* ════════════════ TOP BAR ════════════════ */}
      <header
        className="h-[72px] flex items-center shrink-0 border-b"
        style={{ background: T.bgSecondary, borderColor: T.borderSoft }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 shrink-0" style={{ minWidth: 220 }}>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: T.accent,
              boxShadow: "0 8px 24px rgba(37, 99, 255, 0.35)",
            }}
          >
            <UtensilsCrossed size={22} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[16px] font-extrabold tracking-tight text-white">Gourmet</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: T.textTertiary }}>
              PDV / Caixa
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative ml-2 mr-4" style={{ width: 320 }}>
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: T.accent }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto, código ou cliente..."
            className="w-full h-11 rounded-xl pl-12 pr-4 text-[14px] font-medium text-white focus:outline-none border transition"
            style={{ background: T.bgTertiary, borderColor: T.borderSoft, color: T.textPrimary }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.bgCard; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.background = T.bgTertiary; }}
          />
        </div>

        {/* Table badge (only DINE_IN) */}
        {orderType === "DINE_IN" && (
          <div
            className="flex items-center gap-2.5 h-11 px-4 rounded-xl border mr-3"
            style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: T.success, boxShadow: `0 0 8px ${T.success}` }}
            />
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.textTertiary }}>Mesa</div>
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="nº"
                className="bg-transparent text-[14px] font-bold focus:outline-none w-12 text-white placeholder-white/30"
              />
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Order type tabs */}
        <div className="flex gap-2 mr-2">
          {ORDER_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setOrderType(t.key)}
              className="flex items-center gap-2 h-11 px-4 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: orderType === t.key ? T.accent : T.bgTertiary,
                color: orderType === t.key ? "#fff" : T.textSecond,
                border: `1px solid ${orderType === t.key ? T.accent : T.borderSoft}`,
                boxShadow: orderType === t.key ? "0 4px 12px rgba(37, 99, 255, 0.25)" : "none",
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Cash button (icon only) */}
        <button
          onClick={() => setShowCashModal(true)}
          title={cash?.isOpen ? `Caixa: ${fmt(Number(cash.balance))}` : "Caixa Fechado"}
          className="h-11 w-11 rounded-xl flex items-center justify-center mr-2 transition border"
          style={{
            background: cash?.isOpen ? "rgba(46, 213, 115, 0.1)" : "rgba(255, 71, 87, 0.1)",
            borderColor: cash?.isOpen ? "rgba(46, 213, 115, 0.3)" : "rgba(255, 71, 87, 0.3)",
            color: cash?.isOpen ? T.success : T.danger,
          }}
        >
          <DollarSign size={16} />
        </button>

        {/* Cart button */}
        <button
          onClick={() => setCartOpen((v) => !v)}
          className="relative flex items-center gap-2.5 h-11 px-5 rounded-xl mr-5 text-[12px] font-bold transition-all"
          style={{
            background: T.accent,
            color: "#fff",
            boxShadow: "0 4px 12px rgba(37, 99, 255, 0.25)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}
        >
          <ShoppingCart size={16} className="shrink-0" />
          {cartCount === 0 ? (
            <span>Pedido</span>
          ) : (
            <>
              <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
              <span className="font-extrabold">{fmt(cartTotal)}</span>
            </>
          )}
          {cartCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full text-[11px] font-bold text-white flex items-center justify-center px-1.5"
              style={{ background: T.danger, border: `2px solid ${T.bgSecondary}` }}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </header>

      {/* ════════════════ BODY ════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── COL 1: Left nav (icon only) ──────────────────────────── */}
        <aside
          className="w-14 flex flex-col overflow-y-auto overflow-x-hidden shrink-0 border-r"
          style={{ background: T.bgSecondary, borderColor: T.borderSoft }}
        >
          <nav className="flex-1 flex flex-col items-center gap-1 py-3">
            <SideNavItem href="/"        icon={<LayoutDashboard size={16} />} label="Dashboard" />
            <SideNavItem href="/orders"  icon={<ShoppingCart size={16} />}    label="Pedidos" />
            <SideNavItem href="/kitchen" icon={<CookingPot size={16} />}      label="Cozinha" />
            <SideNavItem href="/tables"  icon={<Store size={16} />}           label="Mesas" />
            <SideNavItem href="/pdv"     icon={<DollarSign size={16} />}      label="PDV / Caixa" active />
            <div className="w-8 border-t my-2" style={{ borderColor: T.border }} />
            <SideNavItem href="/modulos" icon={<Puzzle size={16} />}          label="Módulos" />
            <SideNavItem href="/theme"   icon={<Palette size={16} />}         label="Tema" />
            <SideNavItem href="/tables/qrcode" icon={<QrCode size={16} />}    label="QR Mesas" />
          </nav>

          {/* Bottom CTA */}
          <div className="p-2 flex flex-col items-center gap-1.5 border-t" style={{ borderColor: T.borderSoft }}>
            <button
              onClick={() => openPizzaModal()}
              title="Montar Pizza"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-lg transition active:scale-90"
              style={{ background: T.orange, boxShadow: `0 4px 12px ${T.orange}55` }}
            >
              🍕
            </button>
            <a
              href="/menu"
              target="_blank"
              rel="noopener noreferrer"
              title="Ver Cardápio"
              className="w-10 h-10 flex items-center justify-center rounded-xl transition"
              style={{ color: T.textTertiary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.textTertiary)}
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </aside>

        {/* ── COL 2: Category cards ────────────────────────────────── */}
        <div
          className="w-[200px] overflow-y-auto shrink-0 border-r p-4"
          style={{ background: T.bgSecondary, borderColor: T.borderSoft }}
        >
          <CategoryCard
            active={activeCat === "ALL"}
            label="Todos"
            emoji="🍴"
            onClick={() => setActiveCat("ALL")}
          />
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              active={activeCat === cat.id}
              label={cat.name}
              emoji={getCategoryEmoji(cat.name)}
              imageUrl={cat.imageUrl}
              onClick={() => setActiveCat(cat.id)}
            />
          ))}

          <button
            onClick={() => openPizzaModal()}
            className="w-full py-3.5 mt-2 font-bold text-[13px] text-white rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: T.orange,
              boxShadow: `0 4px 16px ${T.orange}40`,
            }}
          >
            🍕 Montar Pizza
          </button>
        </div>

        {/* ── COL 3: Product area ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: T.bgPrimary }}>
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[160px] rounded-2xl animate-pulse"
                    style={{ background: T.bgCard, border: `1px solid ${T.borderSoft}` }}
                  />
                ))}
              </div>
            ) : loadError ? (
              <div
                className="flex items-center gap-3 px-5 py-4 rounded-2xl border"
                style={{ background: T.bgCard, borderColor: "rgba(255, 71, 87, 0.3)" }}
              >
                <AlertCircle size={20} style={{ color: T.danger }} className="shrink-0" />
                <p className="text-sm" style={{ color: T.textSecond }}>Erro ao carregar</p>
                <button
                  onClick={loadCatalog}
                  className="flex items-center gap-1.5 text-sm font-bold transition ml-auto px-3 py-1.5 rounded-lg"
                  style={{ color: T.accent, background: "rgba(37, 99, 255, 0.1)" }}
                >
                  <RefreshCw size={13} /> Tentar
                </button>
              </div>
            ) : (
              <>
                {/* Hero banner */}
                {activeCat !== "ALL" && activeCatObj && (
                  <div
                    className="relative h-[160px] rounded-2xl overflow-hidden mb-6"
                    style={{
                      background: activeCatObj.imageUrl
                        ? `linear-gradient(90deg, rgba(10,10,12,0.95) 0%, rgba(10,10,12,0.6) 50%, rgba(10,10,12,0.2) 100%), url('${activeCatObj.imageUrl}') center/cover`
                        : `linear-gradient(135deg, ${T.bgCard}, ${T.bgElevated})`,
                    }}
                  >
                    <div className="relative z-10 p-8 h-full flex flex-col justify-center">
                      <h1 className="text-[28px] font-extrabold tracking-tight mb-1 text-white">
                        {activeCatObj.name}
                      </h1>
                      <p className="text-[13px]" style={{ color: T.textSecond }}>
                        {filtered.length} {filtered.length === 1 ? "produto disponível" : "produtos disponíveis"}
                      </p>
                    </div>
                  </div>
                )}

                {activeCat === "ALL" && filtered.length > 0 && (
                  <div className="mb-6">
                    <h1 className="text-[24px] font-extrabold tracking-tight text-white mb-1">
                      Cardápio completo
                    </h1>
                    <p className="text-[13px]" style={{ color: T.textSecond }}>
                      {filtered.length} {filtered.length === 1 ? "produto" : "produtos"} disponíveis
                    </p>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                      style={{ background: T.bgCard, border: `1px solid ${T.borderSoft}` }}
                    >
                      🍽️
                    </div>
                    <div className="text-center">
                      <p className="text-[15px] font-semibold" style={{ color: T.textSecond }}>
                        {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum resultado"}
                      </p>
                      {products.length === 0 && (
                        <p className="text-[12px] mt-1.5" style={{ color: T.textTertiary }}>
                          Adicione produtos em <strong style={{ color: T.accent }}>Cardápio → Produtos</strong>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((product) => {
                      const inCart   = cart.find((i) => i.cartKey === product.id);
                      const hasSizes = !!(product.sizes?.length);
                      return (
                        <div
                          key={product.id}
                          className="grid overflow-hidden group transition-all"
                          style={{
                            gridTemplateColumns: "180px 1fr auto",
                            alignItems: "center",
                            background: inCart ? "rgba(37, 99, 255, 0.08)" : T.bgCard,
                            border: `1px solid ${inCart ? "rgba(37, 99, 255, 0.4)" : T.borderSoft}`,
                            borderRadius: 16,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          }}
                          onMouseEnter={(e) => {
                            if (!inCart) {
                              e.currentTarget.style.background = T.bgElevated;
                              e.currentTarget.style.borderColor = T.border;
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!inCart) {
                              e.currentTarget.style.background = T.bgCard;
                              e.currentTarget.style.borderColor = T.borderSoft;
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
                            }
                          }}
                        >
                          {/* IMAGE */}
                          <div
                            className="relative overflow-hidden shrink-0"
                            style={{
                              height: 140,
                              background: T.bgTertiary,
                              borderRadius: "16px 0 0 16px",
                            }}
                          >
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-5xl"
                                style={{ opacity: 0.2 }}
                              >
                                🍽️
                              </div>
                            )}
                            {inCart && (
                              <div
                                className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                                style={{
                                  background: T.accent,
                                  boxShadow: `0 0 12px ${T.accent}80`,
                                }}
                              >
                                ×{inCart.quantity}
                              </div>
                            )}
                          </div>

                          {/* CONTENT */}
                          <div className="px-5 py-4 min-w-0">
                            <div className="flex items-baseline justify-between gap-4 mb-1.5 flex-wrap">
                              <p className="font-bold text-[17px] leading-tight text-white tracking-tight">
                                {product.name}
                              </p>
                              {!hasSizes && (
                                <p className="text-[19px] font-extrabold text-white shrink-0">
                                  {fmt(Number(product.salePrice))}
                                </p>
                              )}
                            </div>
                            {product.description && (
                              <p
                                className="text-[12.5px] leading-relaxed line-clamp-2"
                                style={{ color: T.textSecond }}
                              >
                                {product.description}
                              </p>
                            )}
                            {hasSizes && (
                              <p className="text-[11px] mt-1.5" style={{ color: T.textTertiary }}>
                                Preço varia por tamanho
                              </p>
                            )}
                          </div>

                          {/* ACTIONS */}
                          <div className="pr-5 flex flex-col items-end gap-2 shrink-0">
                            {!hasSizes && (
                              inCart ? (
                                <div
                                  className="flex items-center overflow-hidden rounded-xl border"
                                  style={{ borderColor: `${T.accent}55` }}
                                >
                                  <button
                                    onClick={() => updateQty(product.id, -1)}
                                    className="w-9 h-9 flex items-center justify-center transition font-bold"
                                    style={{ background: "rgba(37, 99, 255, 0.15)", color: T.accent }}
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="w-9 text-center text-[14px] font-extrabold text-white">
                                    {inCart.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateQty(product.id, 1)}
                                    className="w-9 h-9 flex items-center justify-center transition font-bold text-white"
                                    style={{ background: T.accent }}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(product)}
                                  className="flex items-center gap-1.5 px-6 py-2.5 text-white font-bold text-[12px] uppercase tracking-[0.08em] rounded-xl transition active:scale-[0.96]"
                                  style={{
                                    background: T.accent,
                                    boxShadow: `0 4px 12px ${T.accent}40`,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = T.accentHover; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}
                                >
                                  <Plus size={13} /> Adicionar
                                </button>
                              )
                            )}
                            <button
                              onClick={() => openPizzaModal(product)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all active:scale-90"
                              style={{
                                background: "rgba(249, 115, 22, 0.15)",
                                border: `1px solid rgba(249, 115, 22, 0.3)`,
                              }}
                              title="Montar pizza"
                            >
                              🍕
                            </button>
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

        {/* ── Cart panel (right) ───────────────────────────────────── */}
        <div
          className="w-[300px] flex flex-col border-l shrink-0"
          style={{ background: T.bgSecondary, borderColor: T.borderSoft }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{ borderColor: T.borderSoft }}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart size={16} style={{ color: T.accent }} />
              <span className="text-[14px] font-bold text-white">Pedido</span>
              {cartCount > 0 && (
                <span
                  className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                  style={{ background: T.accent }}
                >
                  {cartCount}
                </span>
              )}
            </div>
          </div>

          {/* Customer fields */}
          <div className="px-4 py-3 border-b shrink-0 space-y-2" style={{ borderColor: T.borderSoft }}>
            {orderType === "DINE_IN" && (
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Nº da mesa"
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 focus:outline-none border transition"
                style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                onFocus={(e) => (e.currentTarget.style.borderColor = T.accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = T.borderSoft)}
              />
            )}
            {(orderType === "PHONE" || orderType === "DELIVERY") && (
              <>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome"
                  className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 focus:outline-none border transition"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Telefone *"
                  className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 focus:outline-none border transition"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                />
              </>
            )}
            {orderType === "DELIVERY" && (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Endereço *"
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 focus:outline-none border transition"
                style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
              />
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 px-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: T.bgCard }}
                >
                  <ShoppingCart size={22} style={{ color: T.textTertiary }} />
                </div>
                <p className="text-[12px] text-center leading-relaxed" style={{ color: T.textTertiary }}>
                  Clique em <b style={{ color: T.accent }}>ADICIONAR</b>
                  <br />para montar o pedido
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: T.borderSoft }}>
                {cart.map((item) => (
                  <div key={item.cartKey} className="flex items-start gap-3 px-4 py-3">
                    <div className="shrink-0">
                      {item.flavors ? (
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                          style={{
                            background: "rgba(249, 115, 22, 0.15)",
                            border: "1px solid rgba(249, 115, 22, 0.3)",
                          }}
                        >
                          🍕
                        </div>
                      ) : item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover" />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: T.bgCard }}
                        >
                          <Package size={15} style={{ color: T.textTertiary }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold leading-tight line-clamp-2 text-white">
                        {item.product.name}
                      </p>
                      {item.notes && item.flavors && (
                        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: T.orange }}>
                          {item.notes}
                        </p>
                      )}
                      <p className="text-[13px] font-extrabold mt-1" style={{ color: T.accent }}>
                        {fmt(Number(item.product.salePrice) * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQty(item.cartKey, -1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition border"
                        style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center text-[11px] font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.cartKey, 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition border"
                        style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
                      >
                        <Plus size={10} />
                      </button>
                      <button
                        onClick={() => removeItem(item.cartKey)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center ml-1 transition border"
                        style={{
                          background: "rgba(255, 71, 87, 0.1)",
                          color: T.danger,
                          borderColor: "rgba(255, 71, 87, 0.2)",
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="px-4 pb-4 pt-3 border-t space-y-3 shrink-0" style={{ borderColor: T.borderSoft }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: T.textTertiary }}>
                Pagamento
              </p>
              <button
                onClick={() => setSplitMode(!splitMode)}
                className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition border"
                style={
                  splitMode
                    ? {
                        background: "rgba(139, 92, 246, 0.15)",
                        color: "#C4B5FD",
                        borderColor: "rgba(139, 92, 246, 0.3)",
                      }
                    : {
                        background: T.bgTertiary,
                        color: T.textSecond,
                        borderColor: T.borderSoft,
                      }
                }
              >
                {splitMode ? "✓ Dividido" : "Dividir"}
              </button>
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-2 gap-2">
                {PAY_OPTIONS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPayMethod(p.key)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11.5px] font-bold transition-all border"
                    style={
                      payMethod === p.key
                        ? {
                            background: T.accent,
                            color: "#fff",
                            borderColor: T.accent,
                            boxShadow: `0 4px 12px ${T.accent}40`,
                          }
                        : {
                            background: T.bgTertiary,
                            color: T.textSecond,
                            borderColor: T.borderSoft,
                          }
                    }
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {splits.map((split, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={split.method}
                      onChange={(e) => updateSplit(i, "method", e.target.value as PayMethod)}
                      className="rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none w-[88px] shrink-0 border"
                      style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                    >
                      {PAY_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <span
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px]"
                        style={{ color: T.textTertiary }}
                      >
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.amount}
                        onChange={(e) => updateSplit(i, "amount", e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white focus:outline-none border"
                        style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                      />
                    </div>
                    {splits.length > 1 && (
                      <button
                        onClick={() => removeSplit(i)}
                        style={{ color: T.textTertiary }}
                        className="hover:text-red-400 transition"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
                {splits.length < 4 && (
                  <button
                    onClick={addSplit}
                    className="text-[11px] font-semibold flex items-center gap-1 transition"
                    style={{ color: T.accent }}
                  >
                    <Plus size={10} /> Adicionar forma
                  </button>
                )}
                <div
                  className="flex justify-between text-[11px] font-bold px-3 py-2 rounded-xl border"
                  style={
                    splitOk
                      ? {
                          color: T.success,
                          background: "rgba(46, 213, 115, 0.1)",
                          borderColor: "rgba(46, 213, 115, 0.25)",
                        }
                      : {
                          color: "#FCA5A5",
                          background: "rgba(255, 71, 87, 0.1)",
                          borderColor: "rgba(255, 71, 87, 0.25)",
                        }
                  }
                >
                  <span>{splitOk ? "✓ Valores fecham" : splitRem > 0 ? "Faltam:" : "Excesso:"}</span>
                  {!splitOk && <span>R$ {Math.abs(splitRem).toFixed(2)}</span>}
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3 border"
                style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: T.textTertiary }}>
                    {cartCount} {cartCount === 1 ? "item" : "itens"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.textTertiary }}>Total</p>
                </div>
                <span className="text-[22px] font-extrabold text-white tracking-tight">{fmt(cartTotal)}</span>
              </div>
            )}

            <div className="flex gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition border"
                  style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={submitOrder}
                disabled={submitting || cart.length === 0}
                className="flex-1 h-11 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition"
                style={{
                  background: T.accent,
                  boxShadow: cart.length > 0 ? `0 4px 16px ${T.accent}55` : "none",
                }}
                onMouseEnter={(e) => {
                  if (!submitting && cart.length > 0) e.currentTarget.style.background = T.accentHover;
                }}
                onMouseLeave={(e) => {
                  if (!submitting && cart.length > 0) e.currentTarget.style.background = T.accent;
                }}
              >
                {submitting ? (
                  <span className="animate-pulse text-xs">Processando...</span>
                ) : (
                  <>
                    <ChevronRight size={15} /> Finalizar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ MODAL Pizza ═══════ */}
      {showPizzaModal && (
        <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="rounded-3xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border"
            style={{ background: T.bgSecondary, borderColor: T.border }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: T.borderSoft }}
            >
              <div>
                <h2 className="text-base font-extrabold text-white">🍕 Montar Pizza</h2>
                <p className="text-[11px] mt-0.5" style={{ color: T.textTertiary }}>
                  Preço = sabor mais caro + borda
                </p>
              </div>
              <button
                onClick={() => setShowPizzaModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition border"
                style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {/* 1. Size */}
              <div className="px-6 py-4 border-b" style={{ borderColor: T.borderSoft }}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
                  style={{ color: T.textTertiary }}
                >
                  1. Tamanho
                </p>
                <div className="flex items-end justify-around gap-2">
                  {PIZZA_SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setPizzaSize(s.key)}
                      className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all border-2"
                      style={
                        pizzaSize === s.key
                          ? { borderColor: T.orange, background: "rgba(249, 115, 22, 0.1)" }
                          : { borderColor: T.borderSoft, background: T.bgTertiary }
                      }
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold transition-all"
                        style={
                          pizzaSize === s.key
                            ? { background: T.orange, color: "#fff" }
                            : { background: T.bgCard, color: T.textSecond }
                        }
                      >
                        <span className="text-sm">{s.label}</span>
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: T.textSecond }}>
                        {s.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {/* 2. Border */}
              <div className="px-6 py-4 border-b" style={{ borderColor: T.borderSoft }}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
                  style={{ color: T.textTertiary }}
                >
                  2. Borda
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPizzaBorder(null)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                    style={
                      !pizzaBorder
                        ? { borderColor: T.orange, background: T.orange, color: "#fff" }
                        : { borderColor: T.borderSoft, color: T.textSecond, background: T.bgTertiary }
                    }
                  >
                    🚫 Sem borda
                  </button>
                  {borders.filter((b) => b.isActive).map((border) => {
                    const sp = border.sizes.find((s) => s.size === pizzaSize);
                    const sel = pizzaBorder?.id === border.id;
                    return (
                      <button
                        key={border.id}
                        onClick={() => setPizzaBorder(border)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                        style={
                          sel
                            ? { borderColor: T.orange, background: T.orange, color: "#fff" }
                            : { borderColor: T.borderSoft, color: T.textSecond, background: T.bgTertiary }
                        }
                      >
                        🧀 {border.name}
                        {sp && (
                          <span
                            className="text-xs"
                            style={{ color: sel ? "rgba(255,255,255,0.85)" : "#FB923C" }}
                          >
                            +R${Number(sp.price).toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 3. Parts */}
              <div className="px-6 py-4 border-b" style={{ borderColor: T.borderSoft }}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
                  style={{ color: T.textTertiary }}
                >
                  3. Quantos Sabores?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { n: 1, label: "Inteira", icon: "🍕" },
                    { n: 2, label: "Meio a Meio", icon: "½" },
                    { n: 3, label: "3 Sabores", icon: "⅓" },
                    { n: 4, label: "4 Sabores", icon: "¼" },
                  ].map(({ n, label, icon }) => (
                    <button
                      key={n}
                      onClick={() => changeFlavorParts(n)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl font-bold text-xs transition-all border-2"
                      style={
                        flavorParts === n
                          ? { borderColor: T.orange, background: "rgba(249, 115, 22, 0.1)", color: "#FB923C" }
                          : { borderColor: T.borderSoft, background: T.bgTertiary, color: T.textSecond }
                      }
                    >
                      <span className="text-xl">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 4. Flavors */}
              <div className="px-6 py-4">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
                  style={{ color: T.textTertiary }}
                >
                  4. Escolha os Sabores
                </p>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {Array.from({ length: flavorParts }).map((_, i) => {
                    const sel = flavorSlots[i];
                    const frac = ["Inteiro", "½", "⅓", "¼"][flavorParts - 1] || "¼";
                    return (
                      <button
                        key={i}
                        onClick={() => setPizzaSlot(i)}
                        className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all"
                        style={
                          pizzaSlot === i
                            ? { borderColor: T.orange, background: "rgba(249, 115, 22, 0.1)", color: "#FB923C" }
                            : sel
                              ? {
                                  borderColor: "rgba(46, 213, 115, 0.5)",
                                  background: "rgba(46, 213, 115, 0.1)",
                                  color: T.success,
                                }
                              : { borderColor: T.borderSoft, color: T.textTertiary, background: T.bgTertiary }
                        }
                      >
                        <span className="font-extrabold" style={{ color: T.orange }}>{frac}</span>
                        <span className="font-medium max-w-[100px] truncate">
                          {sel ? sel.name : `Sabor ${i + 1}`}
                        </span>
                        {sel && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSlot(i, null); }}
                            style={{ color: T.textTertiary }}
                            className="hover:text-red-400 transition ml-1"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="relative mb-3">
                  <Search
                    size={13}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: T.textTertiary }}
                  />
                  <input
                    value={flavorFilter}
                    onChange={(e) => setFlavorFilter(e.target.value)}
                    placeholder={`Buscar sabor ${pizzaSlot + 1}...`}
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none border"
                    style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                  />
                </div>
                {forFlavor.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: T.textTertiary }}>
                    {flavorCatIds.size === 0
                      ? 'Configure categorias com "Permite múltiplos sabores".'
                      : "Nenhum sabor encontrado."}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {forFlavor.map((p) => {
                      const inSlot = flavorSlots[pizzaSlot]?.id === p.id;
                      const inOther = flavorSlots.some((s, i) => s?.id === p.id && i !== pizzaSlot);
                      return (
                        <button
                          key={p.id}
                          onClick={() => pickFlavor(p)}
                          className="relative text-left rounded-2xl border-2 overflow-hidden transition-all"
                          style={
                            inSlot
                              ? { borderColor: T.orange }
                              : inOther
                                ? { borderColor: "rgba(46, 213, 115, 0.5)", opacity: 0.8 }
                                : { borderColor: T.borderSoft, background: T.bgTertiary }
                          }
                        >
                          <div className="h-16 overflow-hidden" style={{ background: T.bgCard }}>
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">🍕</div>
                            )}
                          </div>
                          <div className="p-2" style={{ background: T.bgCard }}>
                            <p
                              className="text-[11px] font-semibold leading-tight line-clamp-2 text-white"
                            >
                              {p.name}
                            </p>
                            <p className="text-[11px] font-extrabold mt-0.5" style={{ color: T.orange }}>
                              R$ {getPriceForSize(p, pizzaSize).toFixed(2)}
                            </p>
                          </div>
                          {inSlot && (
                            <div
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow"
                              style={{ background: T.orange }}
                            >
                              ✓
                            </div>
                          )}
                          {inOther && !inSlot && (
                            <div
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow"
                              style={{ background: T.success }}
                            >
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Modal footer */}
            <div
              className="shrink-0 border-t px-6 py-4"
              style={{ background: T.bgSecondary, borderColor: T.borderSoft }}
            >
              {chosen.length > 0 && (
                <div
                  className="rounded-2xl px-4 py-3 mb-3 flex items-center justify-between border"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                >
                  <div className="min-w-0 mr-4">
                    <p className="text-[11px] font-semibold" style={{ color: T.textTertiary }}>
                      Pizza {PIZZA_SIZES.find((s) => s.key === pizzaSize)?.sub}
                      {pizzaBorder ? ` · Borda ${pizzaBorder.name}` : ""}
                    </p>
                    <p className="text-sm font-bold mt-0.5 truncate text-white">
                      {chosen.map((f) => f.name).join(" + ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px]" style={{ color: T.textTertiary }}>Total</p>
                    <p className="text-2xl font-extrabold" style={{ color: T.orange }}>
                      R$ {(previewUnit + previewBp).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPizzaModal(false)}
                  className="px-5 py-3 rounded-xl font-semibold text-sm border transition"
                  style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmFlavors}
                  disabled={!flavorSlots.some(Boolean)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: T.orange, boxShadow: `0 4px 16px ${T.orange}40` }}
                >
                  <Plus size={14} /> Adicionar ao Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODAL Cash ═══════ */}
      {showCashModal && (
        <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="rounded-3xl p-6 w-full max-w-md shadow-2xl border"
            style={{ background: T.bgSecondary, borderColor: T.border }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-extrabold text-white">Controle de Caixa</h2>
              <button
                onClick={() => setShowCashModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition border"
                style={{ background: T.bgTertiary, color: T.textSecond, borderColor: T.borderSoft }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Saldo",    v: cash?.balance || 0, c: T.success, bg: "rgba(46, 213, 115, 0.1)", b: "rgba(46, 213, 115, 0.25)" },
                { label: "Entradas", v: cash?.entries || 0, c: T.accent,  bg: "rgba(37, 99, 255, 0.1)",  b: "rgba(37, 99, 255, 0.25)" },
                { label: "Saídas",   v: cash?.exits   || 0, c: T.danger,  bg: "rgba(255, 71, 87, 0.1)",  b: "rgba(255, 71, 87, 0.25)" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-3 border" style={{ background: s.bg, borderColor: s.b }}>
                  <p className="text-[10px] font-medium" style={{ color: T.textTertiary }}>{s.label}</p>
                  <p className="font-extrabold text-sm mt-1" style={{ color: s.c }}>R$ {Number(s.v).toFixed(2)}</p>
                </div>
              ))}
            </div>
            {!cash?.isOpen ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: T.textSecond }}>Informe o valor inicial:</p>
                <input
                  type="number"
                  value={openingValue}
                  onChange={(e) => setOpeningValue(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none border"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                />
                <button
                  onClick={openCash}
                  className="w-full py-3 rounded-xl font-extrabold text-white transition"
                  style={{ background: T.accent, boxShadow: `0 4px 16px ${T.accent}55` }}
                >
                  Abrir Caixa
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={movType}
                  onChange={(e) => setMovType(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white focus:outline-none border"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                >
                  <option value="SUPPLY">Reforço de caixa</option>
                  <option value="WITHDRAW">Sangria</option>
                </select>
                <input
                  type="number"
                  value={movValue}
                  onChange={(e) => setMovValue(e.target.value)}
                  placeholder="Valor (R$)"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none border"
                  style={{ background: T.bgTertiary, borderColor: T.borderSoft }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={movement}
                    className="flex-1 py-3 rounded-xl font-semibold text-white"
                    style={{ background: T.accent }}
                  >
                    Registrar
                  </button>
                  <button
                    onClick={closeCash}
                    className="px-4 py-3 rounded-xl font-semibold text-sm border transition"
                    style={{
                      background: "rgba(255, 71, 87, 0.1)",
                      color: T.danger,
                      borderColor: "rgba(255, 71, 87, 0.25)",
                    }}
                  >
                    Fechar Caixa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ MODAL Order done ═══════ */}
      {orderDone && (
        <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl border"
            style={{ background: T.bgSecondary, borderColor: T.border }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border"
              style={{
                background: "rgba(46, 213, 115, 0.15)",
                borderColor: "rgba(46, 213, 115, 0.3)",
              }}
            >
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-3xl font-extrabold mb-2" style={{ color: T.success }}>Pedido Enviado!</h2>
            <p className="mb-1" style={{ color: T.textSecond }}>
              Pedido <span className="text-white font-extrabold">{orderDone}</span>
            </p>
            <p className="text-sm mb-8" style={{ color: T.textTertiary }}>
              Enviado para a cozinha e registrado.
            </p>
            <button
              onClick={() => setOrderDone(null)}
              className="w-full py-3.5 rounded-2xl font-extrabold text-lg text-white"
              style={{ background: T.accent, boxShadow: `0 4px 16px ${T.accent}55` }}
            >
              Novo Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────
function SideNavItem({
  href, icon, label, active,
}: {
  href: string; icon: React.ReactNode; label: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all relative"
      style={{
        background: active ? T.accent : "transparent",
        color: active ? "#fff" : T.textSecond,
        boxShadow: active ? `0 4px 12px ${T.accent}55` : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = T.bgTertiary;
          e.currentTarget.style.color = T.textPrimary;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = T.textSecond;
        }
      }}
    >
      {icon}
    </Link>
  );
}

function CategoryCard({
  active, label, emoji, imageUrl, onClick,
}: {
  active: boolean; label: string; emoji: string; imageUrl?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col items-center justify-center text-center gap-2 mb-2.5 transition-all"
      style={{
        padding: "18px 12px",
        background: active
          ? `linear-gradient(135deg, ${T.accent}, ${T.accentDim})`
          : T.bgCard,
        color: active ? "#fff" : T.textSecond,
        border: `1px solid ${active ? T.accent : T.borderSoft}`,
        borderRadius: 16,
        boxShadow: active
          ? `0 8px 24px ${T.accent}40`
          : "0 2px 8px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = T.bgElevated;
          e.currentTarget.style.color = T.textPrimary;
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = T.bgCard;
          e.currentTarget.style.color = T.textSecond;
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className="w-10 h-10 rounded-full object-cover shrink-0"
          style={{ opacity: active ? 1 : 0.75 }}
        />
      ) : (
        <span className="text-[26px] leading-none">{emoji}</span>
      )}
      <span className="font-bold text-[12px] leading-tight line-clamp-2 text-center w-full">
        {label}
      </span>
    </button>
  );
}
