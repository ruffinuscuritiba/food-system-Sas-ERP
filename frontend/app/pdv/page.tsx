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
type CartItem = { product: Product; quantity: number; notes: string };
type OrderType = "DINE_IN" | "PHONE" | "DELIVERY";
type PayMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";

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
      const ex = prev.find((i) => i.product.id === product.id);
      if (ex) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev.map((i) => i.product.id !== id ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }

  function removeItem(id: string) { setCart((prev) => prev.filter((i) => i.product.id !== id)); }
  function clearCart() { setCart([]); setCustomerName(""); setCustomerPhone(""); setTableNumber(""); setAddress(""); }

  const cartTotal = cart.reduce((acc, i) => acc + Number(i.product.salePrice) * i.quantity, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // ── Submit order ───────────────────────────────────────────────────────────
  async function submitOrder() {
    if (cart.length === 0) { toast.error("Adicione produtos ao pedido"); return; }
    if (orderType === "PHONE" && !customerPhone) { toast.error("Informe o telefone do cliente"); return; }
    if (orderType === "DELIVERY" && !address) { toast.error("Informe o endereço de entrega"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        customerName: customerName || (orderType === "DINE_IN" ? `Mesa ${tableNumber || "—"}` : "Cliente"),
        customerPhone: customerPhone || "PDV",
        deliveryAddress: address || "INTERNO",
        orderType,
        paymentMethod: payMethod,
        items: cart.map((i) => ({
          productId: i.product.id,
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
                  const inCart = cart.find((i) => i.product.id === product.id);
                  return (
                    <div key={product.id}
                      onClick={() => addToCart(product)}
                      className={`relative bg-slate-900 border rounded-2xl overflow-hidden cursor-pointer hover:border-green-500/50 transition group ${inCart ? "border-green-500/40 bg-slate-800/80" : "border-slate-800"}`}>
                      {/* Image */}
                      <div className="h-32 bg-slate-800 overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-700">
                            <Package size={28} />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-sm leading-tight line-clamp-1">{product.name}</p>
                        {product.description && (
                          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-tight">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-green-400 font-bold text-sm">R$ {Number(product.salePrice).toFixed(2)}</span>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${inCart ? "bg-green-500 text-white" : "bg-slate-700 text-slate-300 group-hover:bg-green-500 group-hover:text-white"}`}>
                            {inCart ? <span className="text-xs font-bold">{inCart.quantity}</span> : <Plus size={14} />}
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
              <div key={item.product.id} className="flex items-center gap-2 bg-slate-800 rounded-xl p-2.5">
                {item.product.imageUrl && (
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-1">{item.product.name}</p>
                  <p className="text-green-400 text-xs font-bold">R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition">
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => removeItem(item.product.id)} className="w-6 h-6 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center ml-1 transition">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Payment + total */}
          <div className="px-4 pb-4 pt-3 border-t border-slate-800 space-y-3 shrink-0">
            {/* Payment */}
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Pagamento</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_OPTIONS.map((p) => (
                  <button key={p.key} onClick={() => setPayMethod(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${payMethod === p.key ? "bg-green-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>

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

      {/* ── Cash Modal ──────────────────────────────────────────────────────── */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Controle de Caixa</h2>
              <button onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-white"><X size={22} /></button>
            </div>

            {/* Stats */}
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
