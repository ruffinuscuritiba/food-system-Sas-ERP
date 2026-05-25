"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  ShoppingCart, Plus, Minus, Trash2, Phone, Users, Bike,
  DollarSign, CreditCard, Smartphone, Banknote, X,
  Search, Package, ChevronRight, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductSize = { size: string; price: number };
type Product     = { id: string; name: string; description?: string; salePrice: number; imageUrl?: string; categoryId?: string; isActive?: boolean; sizes?: ProductSize[] };
type Category    = { id: string; name: string; allowMultipleFlavors?: boolean };
type PizzaBorder = { id: string; name: string; isActive: boolean; sizes: ProductSize[] };
type CartItem    = { cartKey: string; product: Product; quantity: number; notes: string; flavors?: Product[]; pizzaSize?: string; pizzaBorderId?: string; borderPrice?: number };
type OrderType   = "DINE_IN" | "PHONE" | "DELIVERY";
type PayMethod   = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
type SplitEntry  = { method: PayMethod; amount: string };

const PAY_OPTIONS: { key: PayMethod; label: string; icon: React.ReactNode }[] = [
  { key: "PIX",         label: "PIX",      icon: <Smartphone size={14} /> },
  { key: "CASH",        label: "Dinheiro", icon: <Banknote size={14} /> },
  { key: "CREDIT_CARD", label: "Crédito",  icon: <CreditCard size={14} /> },
  { key: "DEBIT_CARD",  label: "Débito",   icon: <CreditCard size={14} /> },
];
const ORDER_TYPES: { key: OrderType; label: string; icon: React.ReactNode }[] = [
  { key: "DINE_IN",  label: "Mesa",     icon: <Users size={14} /> },
  { key: "PHONE",    label: "Telefone", icon: <Phone size={14} /> },
  { key: "DELIVERY", label: "Delivery", icon: <Bike size={14} /> },
];
const PAY_LABELS: Record<PayMethod, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};
const PIZZA_SIZES = [
  { key: "PEQUENA", label: "P",   sub: "Pequena"  },
  { key: "MEDIA",   label: "M",   sub: "Média"    },
  { key: "GRANDE",  label: "G",   sub: "Grande"   },
  { key: "FAMILIA", label: "Fam", sub: "Família"  },
];

function getPriceForSize(product: Product, size: string): number {
  if (product.sizes && product.sizes.length > 0) {
    const s = product.sizes.find((ps) => ps.size === size);
    if (s) return Number(s.price);
  }
  return Number(product.salePrice);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PDVPage() {
  const [cash, setCash]                     = useState<any>(null);
  const [openingValue, setOpeningValue]     = useState("");
  const [showCashModal, setShowCashModal]   = useState(false);
  const [movType, setMovType]               = useState("SUPPLY");
  const [movValue, setMovValue]             = useState("");

  const [categories, setCategories]         = useState<Category[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [borders, setBorders]               = useState<PizzaBorder[]>([]);
  const [activeCat, setActiveCat]           = useState<string>("ALL");
  const [search, setSearch]                 = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError]           = useState(false);

  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [orderType, setOrderType]           = useState<OrderType>("DINE_IN");
  const [payMethod, setPayMethod]           = useState<PayMethod>("PIX");
  const [customerName, setCustomerName]     = useState("");
  const [customerPhone, setCustomerPhone]   = useState("");
  const [tableNumber, setTableNumber]       = useState("");
  const [address, setAddress]               = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [orderDone, setOrderDone]           = useState<string | null>(null);

  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [flavorParts, setFlavorParts]       = useState(2);
  const [flavorSlots, setFlavorSlots]       = useState<(Product | null)[]>([null, null]);
  const [flavorFilter, setFlavorFilter]     = useState("");
  const [pizzaSize, setPizzaSize]           = useState("MEDIA");
  const [pizzaBorder, setPizzaBorder]       = useState<PizzaBorder | null>(null);
  const [pizzaActiveSlot, setPizzaActiveSlot] = useState(0);

  const [splitMode, setSplitMode]           = useState(false);
  const [splits, setSplits]                 = useState<SplitEntry[]>([
    { method: "PIX", amount: "" }, { method: "CASH", amount: "" },
  ]);

  const loadCash = useCallback(async () => {
    try { const r = await api.get("/cash/current"); setCash(r.data); } catch {}
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadError(false);
    setLoadingProducts(true);
    try {
      // Load categories and products together — these are critical
      const [catRes, prodRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products"),
      ]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch {
      setLoadError(true);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoadingProducts(false);
    }
    // Load borders separately so a failure here doesn't break the catalog
    try {
      const borderRes = await api.get("/pizza-borders");
      setBorders(Array.isArray(borderRes.data) ? borderRes.data : []);
    } catch { /* borders optional — silently ignore */ }
  }, []);

  useEffect(() => { loadCash(); loadCatalog(); }, []);

  async function openCash() {
    const v = Number(openingValue);
    if (!openingValue || isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    try { await api.post("/cash/open", { openingValue: v }); setOpeningValue(""); loadCash(); toast.success("Caixa aberto!"); }
    catch { toast.error("Erro ao abrir caixa"); }
  }
  async function movement() {
    const v = Number(movValue);
    if (!movValue || isNaN(v) || v <= 0) { toast.error("Valor inválido"); return; }
    try { await api.post("/cash/movement", { type: movType, value: v }); setMovValue(""); loadCash(); toast.success("Movimentação registrada"); }
    catch { toast.error("Erro ao registrar"); }
  }
  async function closeCash() {
    if (!confirm("Fechar o caixa?")) return;
    try { await api.patch("/cash/close"); loadCash(); toast.success("Caixa fechado"); }
    catch { toast.error("Erro ao fechar caixa"); }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.cartKey === product.id);
      if (ex) return prev.map((i) => i.cartKey === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartKey: product.id, product, quantity: 1, notes: "" }];
    });
  }
  function updateQty(cartKey: string, delta: number) {
    setCart((prev) => prev.map((i) => i.cartKey !== cartKey ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }
  function removeItem(cartKey: string) { setCart((prev) => prev.filter((i) => i.cartKey !== cartKey)); }
  function clearCart() { setCart([]); setCustomerName(""); setCustomerPhone(""); setTableNumber(""); setAddress(""); }

  const cartTotal = cart.reduce((acc, i) => acc + Number(i.product.salePrice) * i.quantity, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  function openFlavorModal(product?: Product) {
    setFlavorParts(2);
    setFlavorSlots(product ? [product, null] : [null, null]);
    setFlavorFilter("");
    setPizzaSize("MEDIA");
    setPizzaBorder(null);
    setPizzaActiveSlot(product ? 1 : 0);
    setShowFlavorModal(true);
  }
  function changeFlavorParts(n: number) {
    setFlavorParts(n);
    setPizzaActiveSlot(0);
    setFlavorSlots((prev) => {
      const next: (Product | null)[] = Array(n).fill(null);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }
  function setFlavorSlot(index: number, product: Product | null) {
    setFlavorSlots((prev) => prev.map((s, i) => i === index ? product : s));
  }
  function pickFlavor(product: Product) {
    setFlavorSlots((prev) => {
      const next = [...prev];
      next[pizzaActiveSlot] = product;
      const nextEmpty = next.findIndex((s, i) => i > pizzaActiveSlot && !s);
      if (nextEmpty !== -1) setPizzaActiveSlot(nextEmpty);
      return next;
    });
  }
  function confirmFlavors() {
    const chosen = flavorSlots.filter(Boolean) as Product[];
    if (chosen.length === 0) { toast.error("Selecione ao menos 1 sabor"); return; }
    if (flavorParts > 1 && chosen.length < 2) { toast.error("Selecione ao menos 2 sabores"); return; }
    const flavorPrices = chosen.map((f) => getPriceForSize(f, pizzaSize));
    const unitPrice = Math.max(...flavorPrices);
    const borderSizePrice = pizzaBorder
      ? Number(pizzaBorder.sizes.find((s) => s.size === pizzaSize)?.price || 0)
      : 0;
    const fraction = flavorParts === 1 ? "" : flavorParts === 2 ? "½ " : flavorParts === 3 ? "⅓ " : "¼ ";
    const flavorNote = chosen.map((f) => `${fraction}${f.name}`).join(" | ");
    const borderNote = pizzaBorder ? ` | Borda: ${pizzaBorder.name}` : "";
    const sizeLabel = PIZZA_SIZES.find((s) => s.key === pizzaSize)?.label || pizzaSize;
    const noteText = `Tam: ${sizeLabel}${borderNote} | ${flavorNote}`;
    const composedName = `🍕 Pizza ${sizeLabel}${chosen.length > 1 ? ` ${chosen.length} sabores` : ""}: ${chosen.map((f) => f.name).join(" + ")}`;
    setCart((prev) => [...prev, {
      cartKey: `pizza-${Date.now()}`,
      product: { ...chosen[0], name: composedName, salePrice: unitPrice + borderSizePrice },
      quantity: 1,
      notes: noteText,
      flavors: chosen,
      pizzaSize,
      pizzaBorderId: pizzaBorder?.id,
      borderPrice: borderSizePrice > 0 ? borderSizePrice : undefined,
    }]);
    setShowFlavorModal(false);
    toast.success("Pizza adicionada ao pedido!");
  }

  const flavorCatIds = new Set(categories.filter((c) => c.allowMultipleFlavors).map((c) => c.id));
  const flavorPool = flavorCatIds.size > 0
    ? products.filter((p) => flavorCatIds.has(p.categoryId || ""))
    : products;
  const filteredForFlavor = flavorPool.filter((p) =>
    !flavorFilter || p.name.toLowerCase().includes(flavorFilter.toLowerCase())
  );
  const chosenFlavors = flavorSlots.filter(Boolean) as Product[];
  const previewUnitPrice = chosenFlavors.length > 0 ? Math.max(...chosenFlavors.map((f) => getPriceForSize(f, pizzaSize))) : 0;
  const previewBorderPrice = pizzaBorder ? Number(pizzaBorder.sizes.find((s) => s.size === pizzaSize)?.price || 0) : 0;
  const previewTotal = previewUnitPrice + previewBorderPrice;

  const splitSum       = splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  const splitRemaining = cartTotal - splitSum;
  const splitOk        = Math.abs(splitRemaining) < 0.02;

  function addSplit() { if (splits.length >= 4) return; setSplits((prev) => [...prev, { method: "PIX", amount: "" }]); }
  function removeSplit(i: number) { setSplits((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateSplit(i: number, field: keyof SplitEntry, value: string) {
    setSplits((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  async function submitOrder() {
    if (cart.length === 0) { toast.error("Adicione produtos ao pedido"); return; }
    if (orderType === "PHONE" && !customerPhone) { toast.error("Informe o telefone"); return; }
    if (orderType === "DELIVERY" && !address) { toast.error("Informe o endereço"); return; }
    if (splitMode && !splitOk) {
      toast.error(`Pagamentos não fecham. ${splitRemaining > 0 ? `Faltam R$ ${splitRemaining.toFixed(2)}` : `Sobram R$ ${Math.abs(splitRemaining).toFixed(2)}`}`);
      return;
    }
    const primaryMethod: PayMethod = splitMode ? splits[0].method : payMethod;
    const payNotes = splitMode
      ? `Pag. dividido: ${splits.map((s) => `${PAY_LABELS[s.method]} R$${parseFloat(s.amount || "0").toFixed(2)}`).join(" | ")}`
      : undefined;
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        customerName: customerName || (orderType === "DINE_IN" ? `Mesa ${tableNumber || "—"}` : "Cliente"),
        customerPhone: customerPhone || "PDV",
        deliveryAddress: address || "INTERNO",
        orderType,
        paymentMethod: primaryMethod,
        notes: payNotes,
        items: cart.map((i) => ({
          productId: i.flavors ? i.flavors[0].id : i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.salePrice,
          subtotal: Number(i.product.salePrice) * i.quantity,
          productName: i.product.name,
          notes: i.notes,
          ...(i.pizzaSize && { pizzaSize: i.pizzaSize }),
          ...(i.pizzaBorderId && { pizzaBorderId: i.pizzaBorderId }),
          ...(i.borderPrice && { borderPrice: i.borderPrice }),
          ...(i.flavors && i.flavors.length > 0 && {
            flavors: i.flavors.map((f, idx) => ({ productId: f.id, position: idx + 1 })),
          }),
        })),
        subtotal: cartTotal,
        total: cartTotal,
        deliveryFee: 0,
      });
      setOrderDone(`#${res.data?.id?.slice(-6)?.toUpperCase() || "OK"}`);
      clearCart();
      setSplitMode(false);
      setSplits([{ method: "PIX", amount: "" }, { method: "CASH", amount: "" }]);
      loadCash();
    } catch { toast.error("Erro ao finalizar pedido"); }
    finally { setSubmitting(false); }
  }

  // Products shown in the main grid — show all non-deleted that pass the filters
  const filtered = products.filter((p) => {
    const matchCat    = activeCat === "ALL" || p.categoryId === activeCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#F3F1ED] text-gray-900 flex flex-col overflow-hidden font-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200/80 px-5 h-[60px] flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
            <ShoppingCart size={17} className="text-white" />
          </div>
          <div>
            <p className="font-black text-gray-900 text-sm leading-none">Frente de Caixa</p>
            <p className="text-gray-400 text-[11px] mt-0.5 leading-none">PDV</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            cash?.isOpen
              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
              : "bg-red-50 text-red-500 border-red-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cash?.isOpen ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
            {cash?.isOpen ? `R$ ${Number(cash.balance).toFixed(2)}` : "Caixa Fechado"}
          </div>
          <button
            onClick={() => setShowCashModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-gray-600 font-semibold"
          >
            <DollarSign size={13} /> Caixa
          </button>
          {cash?.isOpen && (
            <button
              onClick={closeCash}
              className="text-xs px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 font-semibold transition border border-red-200"
            >
              Fechar Caixa
            </button>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Col 1: Categorias ─────────────────────────────────────────────── */}
        <aside className="w-[176px] bg-white border-r border-gray-100 flex flex-col overflow-hidden shrink-0 shadow-sm">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Categorias</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-0.5">
            <button
              onClick={() => setActiveCat("ALL")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2.5 ${
                activeCat === "ALL"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeCat === "ALL" ? "bg-white/60" : "bg-gray-300"}`} />
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2.5 ${
                  activeCat === cat.id
                    ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${activeCat === cat.id ? "bg-white/60" : "bg-gray-300"}`} />
                <span className="truncate leading-tight">{cat.name}</span>
              </button>
            ))}
          </nav>
          <div className="p-2.5 border-t border-gray-100 shrink-0">
            <button
              onClick={() => openFlavorModal()}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-1.5"
            >
              <span className="text-sm">🍕</span> Montar Pizza
            </button>
          </div>
        </aside>

        {/* ── Col 2: Produtos ───────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              // Skeleton loading
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-[104px] overflow-hidden flex animate-pulse">
                    <div className="flex-1 p-4 space-y-2">
                      <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                      <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                      <div className="h-4 bg-gray-100 rounded-lg w-1/3 mt-auto" />
                    </div>
                    <div className="w-[104px] bg-gray-100 shrink-0" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                  <AlertCircle size={22} className="text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-700 text-sm">Erro ao carregar cardápio</p>
                  <p className="text-gray-400 text-xs mt-1">Verifique a conexão com o servidor</p>
                </div>
                <button onClick={loadCatalog} className="mt-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition">
                  Tentar novamente
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Package size={22} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-700 text-sm">
                    {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {products.length === 0
                      ? "Vá em Cardápio → Produtos para cadastrar"
                      : "Tente outra categoria ou pesquisa"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filtered.map((product) => {
                  const inCart = cart.find((i) => i.cartKey === product.id);
                  const hasSizes = product.sizes && product.sizes.length > 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => !hasSizes && addToCart(product)}
                      className={`group relative bg-white rounded-2xl overflow-hidden flex h-[104px] transition-all border ${
                        inCart
                          ? "border-emerald-300 shadow-md shadow-emerald-100"
                          : "border-gray-100 hover:border-orange-200 hover:shadow-md hover:shadow-orange-50 shadow-sm"
                      } ${!hasSizes ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {/* Content */}
                      <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
                        <div className="min-w-0">
                          <p className="font-bold text-[13px] text-gray-900 leading-tight line-clamp-2">{product.name}</p>
                          {product.description && (
                            <p className="text-gray-400 text-[11px] mt-0.5 leading-tight line-clamp-1">{product.description}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`font-black text-[15px] ${inCart ? "text-emerald-500" : "text-orange-500"}`}>
                            {hasSizes ? "Ver tamanhos" : `R$ ${Number(product.salePrice).toFixed(2)}`}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); openFlavorModal(product); }}
                              title="Montar pizza"
                              className="w-7 h-7 rounded-lg bg-orange-50 hover:bg-orange-100 active:scale-90 text-orange-500 flex items-center justify-center text-sm transition-all"
                            >
                              🍕
                            </button>
                            {!hasSizes && (
                              <button
                                onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all font-bold text-xs active:scale-90 ${
                                  inCart
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                                    : "bg-gray-100 text-gray-600 hover:bg-orange-500 hover:text-white"
                                }`}
                              >
                                {inCart ? inCart.quantity : <Plus size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Image */}
                      <div className="w-[104px] shrink-0 relative overflow-hidden bg-gray-100">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={22} className="text-gray-300" />
                          </div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md">
                            {inCart.quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ── Col 3: Pedido ─────────────────────────────────────────────────── */}
        <aside className="w-[304px] bg-white border-l border-gray-100 flex flex-col shrink-0 shadow-sm">

          {/* Order type */}
          <div className="px-3.5 pt-3.5 pb-3 border-b border-gray-100 shrink-0">
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {ORDER_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOrderType(t.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    orderType === t.key
                      ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {orderType === "DINE_IN" && (
                <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="Número da mesa"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition" />
              )}
              {(orderType === "PHONE" || orderType === "DELIVERY") && (
                <>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition" />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefone *"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition" />
                </>
              )}
              {orderType === "DELIVERY" && (
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço de entrega *"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition" />
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <ShoppingCart size={18} className="text-gray-300" />
                </div>
                <p className="text-xs text-gray-400 text-center">Toque em um produto para adicionar</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartKey} className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                <div className="shrink-0">
                  {item.flavors ? (
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-lg">🍕</div>
                  ) : item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-9 h-9 rounded-xl object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center">
                      <Package size={14} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold leading-tight text-gray-800 line-clamp-2">{item.product.name}</p>
                  {item.notes && item.flavors && (
                    <p className="text-orange-500 text-[10px] mt-0.5 leading-tight line-clamp-1">{item.notes}</p>
                  )}
                  <p className="text-emerald-500 text-xs font-black mt-1">
                    R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.cartKey, -1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                    <Minus size={10} />
                  </button>
                  <span className="w-5 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQty(item.cartKey, 1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                    <Plus size={10} />
                  </button>
                  <button onClick={() => removeItem(item.cartKey)} className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center ml-0.5 transition">
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Payment + submit */}
          <div className="px-3.5 pb-4 pt-3 border-t border-gray-100 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Pagamento</p>
              <button
                onClick={() => setSplitMode(!splitMode)}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                  splitMode ? "bg-violet-100 text-violet-600 border border-violet-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {splitMode ? "✓ Dividido" : "Dividir"}
              </button>
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_OPTIONS.map((p) => (
                  <button key={p.key} onClick={() => setPayMethod(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      payMethod === p.key
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {splits.map((split, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={split.method} onChange={(e) => updateSplit(i, "method", e.target.value as PayMethod)}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-900 focus:outline-none w-24 shrink-0">
                      {PAY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <input type="number" step="0.01" min="0" value={split.amount}
                        onChange={(e) => updateSplit(i, "amount", e.target.value)} placeholder="0,00"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-7 pr-2 py-2 text-xs focus:outline-none focus:border-emerald-400" />
                    </div>
                    {splits.length > 1 && (
                      <button onClick={() => removeSplit(i)} className="text-gray-400 hover:text-red-400 transition shrink-0"><X size={13} /></button>
                    )}
                  </div>
                ))}
                {splits.length < 4 && (
                  <button onClick={addSplit} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-semibold transition">
                    <Plus size={11} /> Adicionar forma
                  </button>
                )}
                <div className={`flex justify-between text-xs font-bold px-3 py-2 rounded-xl ${splitOk ? "text-emerald-600 bg-emerald-50" : splitRemaining > 0 ? "text-orange-500 bg-orange-50" : "text-red-500 bg-red-50"}`}>
                  <span>{splitOk ? "✓ Valores fecham" : splitRemaining > 0 ? "Faltam:" : "Excesso:"}</span>
                  {!splitOk && <span>R$ {Math.abs(splitRemaining).toFixed(2)}</span>}
                </div>
              </div>
            )}

            {/* Total */}
            {cart.length > 0 && (
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between border border-gray-100">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                  <p className="text-[10px] text-gray-400">Total do pedido</p>
                </div>
                <span className="text-2xl font-black text-gray-900">R$ {cartTotal.toFixed(2)}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {cart.length > 0 && (
                <button onClick={clearCart} className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-400 transition flex items-center justify-center text-gray-400 shrink-0">
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={submitOrder}
                disabled={submitting || cart.length === 0}
                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-200 active:scale-[0.98]"
              >
                {submitting
                  ? <span className="animate-pulse text-xs">Processando…</span>
                  : <><ChevronRight size={17} /> Finalizar Pedido</>
                }
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Pizza Configurator Modal ─────────────────────────────────────────── */}
      {showFlavorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-900">🍕 Montar Pizza</h2>
                <p className="text-gray-400 text-xs mt-0.5">Preço = sabor mais caro + borda</p>
              </div>
              <button onClick={() => setShowFlavorModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* 1. Tamanho */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">1. Tamanho</p>
                <div className="flex items-end justify-around gap-2">
                  {PIZZA_SIZES.map((s) => (
                    <button key={s.key} onClick={() => setPizzaSize(s.key)}
                      className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl transition-all border-2 ${
                        pizzaSize === s.key
                          ? "border-orange-500 bg-orange-50"
                          : "border-transparent bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all ${
                        pizzaSize === s.key ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-gray-200 text-gray-600"
                      }`}>
                        <span className="text-sm">{s.label}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Borda */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">2. Borda</p>
                {borders.filter((b) => b.isActive).length === 0 ? (
                  <p className="text-gray-400 text-sm">Nenhuma borda cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPizzaBorder(null)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                        !pizzaBorder ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                      }`}
                    >
                      🚫 Sem borda
                    </button>
                    {borders.filter((b) => b.isActive).map((border) => {
                      const sp = border.sizes.find((s) => s.size === pizzaSize);
                      const isSelected = pizzaBorder?.id === border.id;
                      return (
                        <button key={border.id} onClick={() => setPizzaBorder(border)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                            isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                          }`}
                        >
                          🧀 {border.name}
                          {sp && <span className={`text-xs ${isSelected ? "text-white/80" : "text-orange-500"}`}>+R${Number(sp.price).toFixed(2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Qtd sabores */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">3. Quantos Sabores?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[{ n: 1, label: "Inteira", icon: "🍕" }, { n: 2, label: "Meio a Meio", icon: "½" }, { n: 3, label: "3 Sabores", icon: "⅓" }, { n: 4, label: "4 Sabores", icon: "¼" }].map(({ n, label, icon }) => (
                    <button key={n} onClick={() => changeFlavorParts(n)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl font-bold text-xs transition-all border-2 ${
                        flavorParts === n
                          ? "border-orange-500 bg-orange-50 text-orange-600"
                          : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-xl">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Escolha */}
              <div className="px-6 py-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">4. Escolha os Sabores</p>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {Array.from({ length: flavorParts }).map((_, i) => {
                    const selected = flavorSlots[i];
                    const fraction = flavorParts === 1 ? "Inteiro" : flavorParts === 2 ? "½" : flavorParts === 3 ? "⅓" : "¼";
                    return (
                      <button key={i} onClick={() => setPizzaActiveSlot(i)}
                        className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all ${
                          pizzaActiveSlot === i ? "border-orange-500 bg-orange-50 text-orange-600"
                          : selected ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                          : "border-gray-200 text-gray-400 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <span className="font-black text-orange-400">{fraction}</span>
                        <span className="font-medium max-w-[100px] truncate">{selected ? selected.name : `Sabor ${i + 1}`}</span>
                        {selected && (
                          <button onClick={(e) => { e.stopPropagation(); setFlavorSlot(i, null); }} className="text-gray-400 hover:text-red-400 transition ml-1">
                            <X size={12} />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={flavorFilter} onChange={(e) => setFlavorFilter(e.target.value)}
                    placeholder={`Buscar sabor para posição ${pizzaActiveSlot + 1}…`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400 placeholder-gray-400"
                  />
                </div>
                {filteredForFlavor.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">
                    {flavorCatIds.size === 0
                      ? 'Configure categorias com "Permite múltiplos sabores" no cadastro de categorias.'
                      : "Nenhum sabor encontrado."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {filteredForFlavor.map((p) => {
                      const isInSlot = flavorSlots[pizzaActiveSlot]?.id === p.id;
                      const usedInOther = flavorSlots.some((s, i) => s?.id === p.id && i !== pizzaActiveSlot);
                      const priceForSize = getPriceForSize(p, pizzaSize);
                      return (
                        <button key={p.id} onClick={() => pickFlavor(p)}
                          className={`relative text-left rounded-2xl border-2 transition-all overflow-hidden ${
                            isInSlot ? "border-orange-500"
                            : usedInOther ? "border-emerald-400 opacity-80"
                            : "border-transparent hover:border-orange-300 bg-gray-50"
                          }`}
                        >
                          <div className="h-16 bg-gray-100 overflow-hidden">
                            {p.imageUrl
                              ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-2xl">🍕</div>
                            }
                          </div>
                          <div className="p-2 bg-white">
                            <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-gray-800">{p.name}</p>
                            <p className="text-orange-500 text-[11px] font-black mt-0.5">R$ {priceForSize.toFixed(2)}</p>
                          </div>
                          {isInSlot && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-black shadow">✓</div>}
                          {usedInOther && !isInSlot && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black shadow">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white">
              {chosenFlavors.length > 0 && (
                <div className="bg-[#F3F1ED] rounded-2xl px-4 py-3 mb-3 flex items-center justify-between">
                  <div className="min-w-0 mr-4">
                    <p className="text-xs text-gray-500 font-semibold">
                      Pizza {PIZZA_SIZES.find((s) => s.key === pizzaSize)?.sub}
                      {pizzaBorder ? ` · Borda ${pizzaBorder.name}` : ""}
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{chosenFlavors.map((f) => f.name).join(" + ")}</p>
                    {pizzaBorder && previewBorderPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">Sabores R${previewUnitPrice.toFixed(2)} + Borda R${previewBorderPrice.toFixed(2)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-2xl font-black text-orange-500">R$ {previewTotal.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowFlavorModal(false)}
                  className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition font-semibold text-sm text-gray-600">
                  Cancelar
                </button>
                <button onClick={confirmFlavors} disabled={!flavorSlots.some(Boolean)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-md shadow-orange-200 active:scale-[0.98]"
                >
                  <Plus size={16} /> Adicionar ao Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Modal ──────────────────────────────────────────────────────── */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Controle de Caixa</h2>
              <button onClick={() => setShowCashModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Saldo",    value: cash?.balance || 0, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Entradas", value: cash?.entries || 0, color: "text-blue-600",    bg: "bg-blue-50"    },
                { label: "Saídas",   value: cash?.exits   || 0, color: "text-red-500",     bg: "bg-red-50"     },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-3`}>
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <p className={`font-black text-sm mt-1 ${s.color}`}>R$ {Number(s.value).toFixed(2)}</p>
                </div>
              ))}
            </div>
            {!cash?.isOpen ? (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">Informe o valor inicial para abrir o caixa:</p>
                <input type="number" value={openingValue} onChange={(e) => setOpeningValue(e.target.value)} placeholder="R$ 0,00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-emerald-400 transition" />
                <button onClick={async () => { await openCash(); setShowCashModal(false); }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 transition py-3 rounded-xl font-black text-white shadow-md shadow-emerald-200">
                  Abrir Caixa
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">Reforço ou sangria de caixa:</p>
                <select value={movType} onChange={(e) => setMovType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none">
                  <option value="SUPPLY">Reforço de caixa</option>
                  <option value="WITHDRAW">Sangria</option>
                </select>
                <input type="number" value={movValue} onChange={(e) => setMovValue(e.target.value)} placeholder="Valor (R$)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-400 transition" />
                <button onClick={async () => { await movement(); }}
                  className="w-full bg-blue-500 hover:bg-blue-600 transition py-3 rounded-xl font-semibold text-white">
                  Registrar Movimentação
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pedido confirmado ────────────────────────────────────────────────── */}
      {orderDone && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-3xl font-black text-emerald-500 mb-2">Pedido Enviado!</h2>
            <p className="text-gray-500 mb-1">Pedido <span className="text-gray-900 font-black">{orderDone}</span></p>
            <p className="text-gray-400 text-sm mb-8">Enviado para a cozinha e registrado.</p>
            <button onClick={() => setOrderDone(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 transition py-3.5 rounded-2xl font-black text-lg text-white shadow-md shadow-emerald-200">
              Novo Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
