"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  ShoppingCart, Plus, Minus, Trash2, Phone, Users, Bike,
  DollarSign, CreditCard, Smartphone, Banknote, X,
  ChevronRight, Search, Package, Clock
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Product  = { id: string; name: string; description?: string; salePrice: number; imageUrl?: string; categoryId?: string };
type Category = { id: string; name: string };
// cartKey: product.id para simples, "pizza-<ts>" para compostas
type CartItem = { cartKey: string; product: Product; quantity: number; notes: string; flavors?: Product[] };
type OrderType = "DINE_IN" | "PHONE" | "DELIVERY";
type PayMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
type SplitEntry = { method: PayMethod; amount: string };

const PAY_OPTIONS: { key: PayMethod; label: string; icon: React.ReactNode }[] = [
  { key: "PIX",         label: "PIX",      icon: <Smartphone size={18} /> },
  { key: "CASH",        label: "Dinheiro", icon: <Banknote size={18} /> },
  { key: "CREDIT_CARD", label: "Crédito",  icon: <CreditCard size={18} /> },
  { key: "DEBIT_CARD",  label: "Débito",   icon: <CreditCard size={18} /> },
];

const ORDER_TYPES: { key: OrderType; label: string; icon: React.ReactNode }[] = [
  { key: "DINE_IN",  label: "Presencial", icon: <Users size={16} /> },
  { key: "PHONE",    label: "Telefone",   icon: <Phone size={16} /> },
  { key: "DELIVERY", label: "Delivery",   icon: <Bike size={16} /> },
];

const PAY_LABELS: Record<PayMethod, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PDVPage() {
  // Cash
  const [cash, setCash]           = useState<any>(null);
  const [openingValue, setOpeningValue] = useState("");
  const [showCashModal, setShowCashModal] = useState(false);
  const [movType, setMovType]     = useState("SUPPLY");
  const [movValue, setMovValue]   = useState("");

  // Catalog
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [activeCat, setActiveCat]   = useState<string>("ALL");
  const [search, setSearch]         = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Order
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [payMethod, setPayMethod] = useState<PayMethod>("PIX");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber]   = useState("");
  const [address, setAddress]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState<string | null>(null);

  // ── Pizza configurator ────────────────────────────────────────────────────
  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [flavorParts, setFlavorParts] = useState(2);
  const [flavorSlots, setFlavorSlots] = useState<(Product | null)[]>([null, null]);
  const [flavorFilter, setFlavorFilter] = useState("");
  const [pizzaSize, setPizzaSize] = useState("M");
  const [pizzaBorder, setPizzaBorder] = useState("Sem borda");
  const [pizzaActiveSlot, setPizzaActiveSlot] = useState(0);

  // ── Split payment ──────────────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitEntry[]>([
    { method: "PIX", amount: "" },
    { method: "CASH", amount: "" },
  ]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadCash = useCallback(async () => {
    try { const r = await api.get("/cash/current"); setCash(r.data); } catch {}
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([api.get("/categories"), api.get("/products")]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch { toast.error("Erro ao carregar cardápio"); }
    finally { setLoadingProducts(false); }
  }, []);

  useEffect(() => { loadCash(); loadCatalog(); }, []);

  // ── Cash ops ──────────────────────────────────────────────────────────────
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

  // ── Cart ops ───────────────────────────────────────────────────────────────
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

  // ── Pizza meio a meio ──────────────────────────────────────────────────────
  const PIZZA_SIZES = [
    { key: "Broto", label: "Broto", sub: "25cm", circle: "w-7 h-7" },
    { key: "P",     label: "P",     sub: "30cm", circle: "w-8 h-8" },
    { key: "M",     label: "M",     sub: "35cm", circle: "w-10 h-10" },
    { key: "G",     label: "G",     sub: "40cm", circle: "w-12 h-12" },
    { key: "Família", label: "Família", sub: "45cm", circle: "w-14 h-14" },
  ];

  const PIZZA_BORDERS = ["Sem borda", "Catupiry", "Cheddar", "Cream Cheese", "Cheddar+Bacon"];

  function openFlavorModal(product?: Product) {
    setFlavorParts(2);
    setFlavorSlots(product ? [product, null] : [null, null]);
    setFlavorFilter("");
    setPizzaSize("M");
    setPizzaBorder("Sem borda");
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

  // Clica em card de sabor → preenche slot ativo e avança
  function pickFlavor(product: Product) {
    setFlavorSlots((prev) => {
      const next = [...prev];
      next[pizzaActiveSlot] = product;
      return next;
    });
    // Avança para próximo slot vazio automaticamente
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

    const highestPrice = Math.max(...chosen.map((f) => Number(f.salePrice)));
    const base = chosen.find((f) => Number(f.salePrice) === highestPrice) || chosen[0];
    const fraction = flavorParts === 1 ? "" : flavorParts === 2 ? "½ " : flavorParts === 3 ? "⅓ " : "¼ ";
    const flavorNote = chosen.map((f) => `${fraction}${f.name}`).join(" | ");
    const borderNote = pizzaBorder !== "Sem borda" ? ` | Borda: ${pizzaBorder}` : "";
    const noteText = `Tam: ${pizzaSize}${borderNote} | ${flavorNote}`;
    const composedName = `🍕 Pizza ${pizzaSize}${chosen.length > 1 ? ` ${chosen.length} sabores` : ""}: ${chosen.map((f) => f.name).join(" + ")}`;

    setCart((prev) => [...prev, {
      cartKey: `pizza-${Date.now()}`,
      product: { ...base, name: composedName },
      quantity: 1,
      notes: noteText,
      flavors: chosen,
    }]);
    setShowFlavorModal(false);
    toast.success("Pizza adicionada ao pedido!");
  }

  const filteredForFlavor = products.filter((p) =>
    !flavorFilter || p.name.toLowerCase().includes(flavorFilter.toLowerCase())
  );

  // ── Split payment ──────────────────────────────────────────────────────────
  const splitSum = splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  const splitRemaining = cartTotal - splitSum;
  const splitOk = Math.abs(splitRemaining) < 0.02;

  function addSplit() {
    if (splits.length >= 4) return;
    setSplits((prev) => [...prev, { method: "PIX", amount: "" }]);
  }

  function removeSplit(i: number) {
    setSplits((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSplit(i: number, field: keyof SplitEntry, value: string) {
    setSplits((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  // ── Submit order ───────────────────────────────────────────────────────────
  async function submitOrder() {
    if (cart.length === 0) { toast.error("Adicione produtos ao pedido"); return; }
    if (orderType === "PHONE" && !customerPhone) { toast.error("Informe o telefone do cliente"); return; }
    if (orderType === "DELIVERY" && !address) { toast.error("Informe o endereço de entrega"); return; }

    // Validate split payment
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
          productId: i.flavors ? i.flavors[0].id : i.product.id,  // usa produto real (maior preço)
          quantity: i.quantity,
          unitPrice: i.product.salePrice,
          subtotal: Number(i.product.salePrice) * i.quantity,
          productName: i.product.name,
          notes: i.notes,
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

  // ── Filtered products ─────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const matchCat  = activeCat === "ALL" || p.categoryId === activeCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && (p as any).isActive !== false;
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-green-400" />
            <span className="font-bold text-lg">PDV</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cash?.isOpen ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {cash?.isOpen ? "Caixa Aberto" : "Caixa Fechado"}
          </div>
          {cash?.isOpen && (
            <span className="text-slate-400 text-sm">
              Saldo: <span className="text-green-400 font-semibold">R$ {Number(cash.balance).toFixed(2)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCashModal(true)} className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-2">
            <DollarSign size={16} /> Caixa
          </button>
          {cash?.isOpen && (
            <button onClick={closeCash} className="text-sm px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition">
              Fechar Caixa
            </button>
          )}
        </div>
      </header>

      {/* ── Body (3 columns) ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Col 1: Categories ───────────────────────────────────────────── */}
        <aside className="w-44 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden shrink-0">
          <div className="px-3 py-3 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Categorias</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
            <button onClick={() => setActiveCat("ALL")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition ${activeCat === "ALL" ? "bg-green-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              Todos
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition leading-tight ${activeCat === cat.id ? "bg-green-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                {cat.name}
              </button>
            ))}
          </nav>
          {/* Botão montar pizza */}
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={() => openFlavorModal()}
              className="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1"
            >
              🍕 Montar
            </button>
          </div>
        </aside>

        {/* ── Col 2: Products ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-slate-500 animate-pulse">Carregando cardápio...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <Package size={32} className="text-slate-700" />
                <p className="text-slate-500 text-sm">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filtered.map((product) => {
                  const inCart = cart.find((i) => i.cartKey === product.id);
                  return (
                    <div key={product.id} className={`relative bg-slate-900 border rounded-2xl overflow-hidden cursor-pointer hover:border-green-500/50 transition group ${inCart ? "border-green-500/40 bg-slate-800/80" : "border-slate-800"}`}>
                      {/* Image */}
                      <div className="h-28 bg-slate-800 overflow-hidden" onClick={() => addToCart(product)}>
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-700"><Package size={28} /></div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-sm leading-tight line-clamp-1">{product.name}</p>
                        {product.description && (
                          <p className="text-slate-500 text-xs mt-0.5 line-clamp-1 leading-tight">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <span className="text-green-400 font-bold text-sm">R$ {Number(product.salePrice).toFixed(2)}</span>
                          <div className="flex gap-1">
                            {/* Botão montar pizza */}
                            <button
                              onClick={() => openFlavorModal(product)}
                              title="Montar pizza com este sabor"
                              className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/40 flex items-center justify-center transition text-xs"
                            >
                              🍕
                            </button>
                            {/* Botão add simples */}
                            <button
                              onClick={() => addToCart(product)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${inCart ? "bg-green-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-green-500 hover:text-white"}`}
                            >
                              {inCart ? <span className="text-xs font-bold">{inCart.quantity}</span> : <Plus size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ── Col 3: Order Panel ──────────────────────────────────────────── */}
        <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">

          {/* Order type */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Tipo de atendimento</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ORDER_TYPES.map((t) => (
                <button key={t.key} onClick={() => setOrderType(t.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition ${orderType === t.key ? "bg-green-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Customer fields */}
            <div className="mt-3 space-y-2">
              {orderType === "DINE_IN" && (
                <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Número da mesa"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
              )}
              {(orderType === "PHONE" || orderType === "DELIVERY") && (
                <>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Telefone *"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
                </>
              )}
              {orderType === "DELIVERY" && (
                <input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Endereço de entrega *"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500" />
              )}
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                <ShoppingCart size={28} />
                <p className="text-xs">Clique nos produtos para adicionar</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartKey} className="flex items-start gap-2 bg-slate-800 rounded-xl p-2.5">
                {item.product.imageUrl && !item.flavors && (
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                {item.flavors && (
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-lg shrink-0">🍕</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-2 leading-tight">{item.product.name}</p>
                  {item.notes && item.flavors && (
                    <p className="text-orange-400/70 text-xs mt-0.5 leading-tight">{item.notes}</p>
                  )}
                  <p className="text-green-400 text-xs font-bold mt-0.5">R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.cartKey, -1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition">
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.cartKey, 1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => removeItem(item.cartKey)} className="w-6 h-6 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center ml-1 transition">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Payment + total */}
          <div className="px-4 pb-4 pt-3 border-t border-slate-800 space-y-3 shrink-0">
            {/* Payment header */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pagamento</p>
              <button
                onClick={() => setSplitMode(!splitMode)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${splitMode ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                {splitMode ? "✓ Dividido" : "Dividir conta"}
              </button>
            </div>

            {!splitMode ? (
              /* Pagamento único */
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_OPTIONS.map((p) => (
                  <button key={p.key} onClick={() => setPayMethod(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${payMethod === p.key ? "bg-green-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            ) : (
              /* Pagamento dividido */
              <div className="space-y-2">
                {splits.map((split, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={split.method}
                      onChange={(e) => updateSplit(i, "method", e.target.value as PayMethod)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none w-24 shrink-0"
                    >
                      {PAY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.amount}
                        onChange={(e) => updateSplit(i, "amount", e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-2 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                    {splits.length > 1 && (
                      <button onClick={() => removeSplit(i)} className="text-slate-500 hover:text-red-400 transition shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {splits.length < 4 && (
                  <button onClick={addSplit} className="text-xs text-green-400 hover:text-green-300 transition flex items-center gap-1">
                    <Plus size={12} /> Adicionar forma
                  </button>
                )}
                {/* Saldo */}
                <div className={`flex justify-between text-xs font-semibold px-1 py-1 rounded-lg ${splitOk ? "text-green-400 bg-green-500/10" : splitRemaining > 0 ? "text-orange-400 bg-orange-500/10" : "text-red-400 bg-red-500/10"}`}>
                  <span>{splitOk ? "✓ Valores fecham" : splitRemaining > 0 ? "Faltam:" : "Excesso:"}</span>
                  {!splitOk && <span>R$ {Math.abs(splitRemaining).toFixed(2)}</span>}
                </div>
              </div>
            )}

            {/* Total */}
            {cart.length > 0 && (
              <div className="bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <span className="text-2xl font-black text-green-400">R$ {cartTotal.toFixed(2)}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {cart.length > 0 && (
                <button onClick={clearCart} className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition text-slate-400">
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={submitOrder} disabled={submitting || cart.length === 0}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                {submitting ? <span className="animate-pulse">Processando...</span> : (<><ChevronRight size={18} /> Finalizar</>)}
              </button>
            </div>
          </div>

        </aside>
      </div>

      {/* ── Pizza Configurator Modal (estilo Goomer) ────────────────────────── */}
      {showFlavorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col max-h-[95vh] overflow-hidden shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold">🍕 Montar Pizza</h2>
                <p className="text-slate-500 text-xs mt-0.5">Preço = maior sabor selecionado</p>
              </div>
              <button onClick={() => setShowFlavorModal(false)} className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ── 1. Tamanho ──────────────────────────────────────── */}
              <div className="px-5 py-4 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">1. Tamanho</p>
                <div className="flex items-end justify-around gap-2">
                  {PIZZA_SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setPizzaSize(s.key)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition ${pizzaSize === s.key ? "bg-orange-500/20 border border-orange-500" : "border border-transparent hover:bg-slate-800"}`}
                    >
                      {/* Pizza visual (círculo crescente) */}
                      <div className={`${s.circle} rounded-full flex items-center justify-center text-orange-400 transition-all ${pizzaSize === s.key ? "bg-orange-500 text-white" : "bg-slate-800"}`}>
                        <span className="text-xs font-black">{s.label}</span>
                      </div>
                      <span className="text-xs text-slate-500">{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 2. Borda ────────────────────────────────────────── */}
              <div className="px-5 py-4 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">2. Borda</p>
                <div className="flex flex-wrap gap-2">
                  {PIZZA_BORDERS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setPizzaBorder(b)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition border ${pizzaBorder === b ? "bg-orange-500 border-orange-500 text-white" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"}`}
                    >
                      {b === "Sem borda" ? "🚫 " : "🧀 "}{b}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 3. Quantos sabores ──────────────────────────────── */}
              <div className="px-5 py-4 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">3. Quantos Sabores?</p>
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
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl font-semibold text-xs transition border ${flavorParts === n ? "bg-orange-500 border-orange-500 text-white" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"}`}
                    >
                      <span className="text-xl">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 4. Escolha os sabores ───────────────────────────── */}
              <div className="px-5 py-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">4. Escolha os Sabores</p>

                {/* Slot tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {Array.from({ length: flavorParts }).map((_, i) => {
                    const selected = flavorSlots[i];
                    const fraction = flavorParts === 1 ? "Inteiro" : flavorParts === 2 ? "½" : flavorParts === 3 ? "⅓" : "¼";
                    return (
                      <button
                        key={i}
                        onClick={() => setPizzaActiveSlot(i)}
                        className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
                          pizzaActiveSlot === i
                            ? "border-orange-500 bg-orange-500/10 text-white"
                            : selected
                              ? "border-green-500/40 bg-green-500/10 text-green-400"
                              : "border-slate-700 text-slate-500 hover:border-slate-500"
                        }`}
                      >
                        <span className="font-black text-orange-400">{fraction}</span>
                        <span className="font-medium max-w-[100px] truncate">
                          {selected ? selected.name : `Sabor ${i + 1}`}
                        </span>
                        {selected && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setFlavorSlot(i, null); }}
                            className="text-slate-500 hover:text-red-400 transition ml-1"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Busca */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={flavorFilter}
                    onChange={(e) => setFlavorFilter(e.target.value)}
                    placeholder={`Buscar sabor para a posição ${pizzaActiveSlot + 1}...`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 placeholder-slate-600"
                  />
                </div>

                {/* Grid de sabores (cards clicáveis com imagem) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {filteredForFlavor.map((p) => {
                    const isInSlot = flavorSlots[pizzaActiveSlot]?.id === p.id;
                    const usedInOther = flavorSlots.some((s, i) => s?.id === p.id && i !== pizzaActiveSlot);
                    return (
                      <button
                        key={p.id}
                        onClick={() => pickFlavor(p)}
                        className={`relative text-left rounded-xl border transition overflow-hidden ${
                          isInSlot
                            ? "border-orange-500 bg-orange-500/10"
                            : usedInOther
                              ? "border-green-500/30 bg-green-500/5 opacity-70"
                              : "border-slate-800 bg-slate-900 hover:border-orange-500/50"
                        }`}
                      >
                        {/* Imagem */}
                        <div className="h-16 bg-slate-800 overflow-hidden">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🍕</div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-2">
                          <p className="text-xs font-semibold leading-tight line-clamp-2">{p.name}</p>
                          <p className="text-orange-400 text-xs font-bold mt-1">R$ {Number(p.salePrice).toFixed(2)}</p>
                        </div>
                        {/* Check */}
                        {isInSlot && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black">✓</div>
                        )}
                        {usedInOther && !isInSlot && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500/80 flex items-center justify-center text-white text-xs font-black">✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer fixo: resumo + botões */}
            <div className="shrink-0 border-t border-slate-800 px-5 py-4 bg-slate-950">
              {flavorSlots.some(Boolean) && (
                <div className="bg-slate-900 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
                  <div className="min-w-0 mr-4">
                    <p className="text-xs text-slate-500 font-semibold">
                      Pizza {pizzaSize}{pizzaBorder !== "Sem borda" ? ` · Borda ${pizzaBorder}` : ""}
                    </p>
                    <p className="text-sm font-semibold mt-0.5 truncate">
                      {flavorSlots.filter(Boolean).map((f) => f!.name).join(" + ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-xl font-black text-orange-400">
                      R$ {Math.max(...flavorSlots.filter(Boolean).map((f) => Number(f!.salePrice))).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowFlavorModal(false)} className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold text-sm text-slate-300">
                  Cancelar
                </button>
                <button
                  onClick={confirmFlavors}
                  disabled={!flavorSlots.some(Boolean)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Controle de Caixa</h2>
              <button onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-white"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Saldo", value: cash?.balance || 0, color: "text-green-400" },
                { label: "Entradas", value: cash?.entries || 0, color: "text-blue-400" },
                { label: "Saídas", value: cash?.exits || 0, color: "text-red-400" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`font-bold text-sm mt-1 ${s.color}`}>R$ {Number(s.value).toFixed(2)}</p>
                </div>
              ))}
            </div>
            {!cash?.isOpen ? (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">Informe o valor inicial para abrir o caixa:</p>
                <input type="number" value={openingValue} onChange={(e) => setOpeningValue(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500" />
                <button onClick={async () => { await openCash(); setShowCashModal(false); }}
                  className="w-full bg-green-500 hover:bg-green-600 transition py-3 rounded-xl font-bold">
                  Abrir Caixa
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">Reforço ou sangria de caixa:</p>
                <select value={movType} onChange={(e) => setMovType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none">
                  <option value="SUPPLY">Reforço de caixa</option>
                  <option value="WITHDRAW">Sangria</option>
                </select>
                <input type="number" value={movValue} onChange={(e) => setMovValue(e.target.value)}
                  placeholder="Valor (R$)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500" />
                <button onClick={async () => { await movement(); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 transition py-3 rounded-xl font-semibold">
                  Registrar Movimentação
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Order success ────────────────────────────────────────────────────── */}
      {orderDone && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-green-500/30 rounded-3xl p-10 text-center max-w-sm w-full">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-black text-green-400 mb-2">Pedido Enviado!</h2>
            <p className="text-slate-400 mb-2">Pedido <span className="text-white font-bold">{orderDone}</span></p>
            <p className="text-slate-500 text-sm mb-8">Enviado para a cozinha e registrado no sistema.</p>
            <button onClick={() => setOrderDone(null)} className="w-full bg-green-500 hover:bg-green-600 transition py-3 rounded-xl font-bold text-lg">
              Novo Pedido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
