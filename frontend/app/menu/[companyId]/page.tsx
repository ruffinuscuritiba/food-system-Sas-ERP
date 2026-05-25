"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  ShoppingCart, X, Plus, Minus, Trash2, ChevronRight,
  RefreshCw, CreditCard, Loader2, Star, Tag, CheckCircle,
  MapPin, Clock, Phone, Search,
} from "lucide-react";
import { MetaPixel, trackPixelPurchase, trackPixelAddToCart } from "@/components/tracking/MetaPixel";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { GoogleAnalytics, trackGAPurchase, trackGAAddToCart } from "@/components/tracking/GoogleAnalytics";

type Product = {
  id: string;
  name: string;
  description: string;
  salePrice: number;
  imageUrl: string | null;
  category?: { name: string };
  isActive: boolean;
};

type CartItem = { cartKey: string; product: Product; quantity: number; notes: string; flavors?: Product[] };

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  orderType: "DELIVERY" | "PICKUP";
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
};

export default function MenuPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("Cardápio");
  const [orderSent, setOrderSent] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [loyaltyPointsEarned, setLoyaltyPointsEarned] = useState(0);
  const [metaPixelId, setMetaPixelId] = useState<string | null>(null);
  const [gaId, setGaId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; valid: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [flavorParts, setFlavorParts] = useState(2);
  const [flavorSlots, setFlavorSlots] = useState<(Product | null)[]>([null, null]);
  const [flavorFilter, setFlavorFilter] = useState("");

  const [form, setForm] = useState<CustomerForm>({
    name: "", phone: "", address: "", orderType: "DELIVERY", paymentMethod: "PIX",
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("table");
    if (t) setTableNumber(t);
  }, []);

  async function loadMenu(attempt = 1) {
    setLoading(true);
    setLoadError(false);
    try {
      const [menuRes, companyRes, themeRes] = await Promise.all([
        fetch(`${apiBaseUrl}/products/public/menu/${companyId}`),
        fetch(`${apiBaseUrl}/company/${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/themes/${companyId}`).catch(() => null),
      ]);

      if (!menuRes.ok) {
        if (attempt < 3) {
          setTimeout(() => loadMenu(attempt + 1), 6000);
          return;
        }
        setLoadError(true);
        setLoading(false);
        return;
      }

      const menuData = await menuRes.json();
      const list: Product[] = Array.isArray(menuData) ? menuData : (menuData.products || []);
      setProducts(list);

      const catNames = Array.from(new Set<string>(
        list.map((p) => p.category?.name?.trim() || "Outros")
      ));
      setCategories(["Todos", ...catNames.sort((a, b) => a === "Outros" ? 1 : b === "Outros" ? -1 : a.localeCompare(b, "pt-BR"))]);

      if (companyRes?.ok) {
        const cd = await companyRes.json().catch(() => null);
        if (cd?.name) setCompanyName(cd.name);
      }

      if (themeRes?.ok) {
        const td = await themeRes.json().catch(() => null);
        if (td?.metaPixelId) setMetaPixelId(td.metaPixelId);
        if (td?.gaId) setGaId(td.gaId);
      }

      setLoading(false);
    } catch {
      if (attempt < 3) {
        setTimeout(() => loadMenu(attempt + 1), 6000);
        return;
      }
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => { loadMenu(); }, [companyId]);

  const fetchLoyaltyBalance = useCallback(async (phone: string) => {
    if (!phone || phone.length < 8 || !companyId) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/loyalty/balance?phone=${encodeURIComponent(phone)}&companyId=${companyId}`
      );
      if (res.ok) {
        const data = await res.json();
        setLoyaltyPoints(data.points || 0);
        setLoyaltyDiscount(data.discountValue || 0);
      }
    } catch { /* silent */ }
  }, [companyId]);

  async function validateCoupon(code: string) {
    if (!code.trim()) { setCouponMsg(null); setCouponDiscount(0); setCouponId(null); return; }
    setCouponLoading(true);
    setCouponMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), companyId, orderTotal: cartTotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponDiscount(data.discount);
        setCouponId(data.couponId);
        setCouponMsg({ text: data.message, valid: true });
      } else {
        setCouponDiscount(0);
        setCouponId(null);
        setCouponMsg({ text: data.message, valid: false });
      }
    } catch {
      setCouponMsg({ text: "Erro ao validar cupom.", valid: false });
    } finally {
      setCouponLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === product.id);
      if (existing) return prev.map((i) => i.cartKey === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartKey: product.id, product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
    trackPixelAddToCart(Number(product.salePrice), product.name);
    trackGAAddToCart(product.name, Number(product.salePrice));
  }

  function updateQuantity(cartKey: string, delta: number) {
    setCart((prev) => prev.map((i) => i.cartKey !== cartKey ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }

  function openFlavorModal(product?: Product) {
    setFlavorParts(2);
    setFlavorSlots(product ? [product, null] : [null, null]);
    setFlavorFilter("");
    setShowFlavorModal(true);
  }

  function changeFlavorParts(n: number) {
    setFlavorParts(n);
    setFlavorSlots((prev) => {
      const next: (Product | null)[] = Array(n).fill(null);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }

  function setFlavorSlot(index: number, product: Product | null) {
    setFlavorSlots((prev) => prev.map((s, i) => i === index ? product : s));
  }

  function confirmFlavors() {
    const chosen = flavorSlots.filter(Boolean) as Product[];
    if (chosen.length < 2) { toast.error("Selecione ao menos 2 sabores"); return; }
    const highestPrice = Math.max(...chosen.map((f) => Number(f.salePrice)));
    const base = chosen.find((f) => Number(f.salePrice) === highestPrice) || chosen[0];
    const fraction = flavorParts === 2 ? "1/2" : flavorParts === 3 ? "1/3" : "1/4";
    const noteText = chosen.map((f) => `${fraction} ${f.name}`).join(" | ");
    const composedName = `Pizza ${chosen.length} sabores: ${chosen.map((f) => f.name).join(" + ")}`;
    setCart((prev) => [...prev, {
      cartKey: `pizza-${Date.now()}`,
      product: { ...base, name: composedName },
      quantity: 1,
      notes: noteText,
      flavors: chosen,
    }]);
    setShowFlavorModal(false);
    toast.success("Pizza montada adicionada!");
  }

  const cartTotal = cart.reduce((acc, i) => acc + Number(i.product.salePrice) * i.quantity, 0);
  const totalDiscount = (usePoints ? loyaltyDiscount : 0) + couponDiscount;
  const finalCartTotal = Math.max(0, cartTotal - totalDiscount);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "Todos" || (p.category?.name?.trim() || "Outros") === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  async function submitOrder() {
    if (!form.name || !form.phone) { toast.error("Informe seu nome e telefone"); return; }
    if (form.orderType === "DELIVERY" && !form.address) { toast.error("Informe o endereço"); return; }
    if (cart.length === 0) { toast.error("Carrinho vazio"); return; }
    setSubmitting(true);
    try {
      const pointsToRedeem = usePoints ? loyaltyPoints : 0;
      const res = await fetch(`${apiBaseUrl}/orders/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          customerName: form.name,
          customerPhone: form.phone,
          deliveryAddress: form.address,
          orderType: tableNumber ? "DINE_IN" : form.orderType,
          paymentMethod: form.paymentMethod,
          items: cart.map((i) => ({
            productId: i.flavors ? i.flavors[0].id : i.product.id,
            quantity: i.quantity,
            notes: i.notes || "",
          })),
          total: finalCartTotal,
          redeemPoints: pointsToRedeem,
          notes: tableNumber ? `Mesa ${tableNumber}` : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const orderData = await res.json().catch(() => null);
      const createdOrderId: string | null = orderData?.id ?? null;
      const cartSnapshot = cart.slice();
      const capturedFinalTotal = finalCartTotal;

      if (couponId) {
        fetch(`${apiBaseUrl}/coupons/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ couponId }),
        }).catch(() => {});
      }

      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setOrderId(createdOrderId);
      setLoyaltyPointsEarned(orderData?.loyaltyPointsEarned ?? 0);
      setUsePoints(false);
      setLoyaltyPoints(0);
      setLoyaltyDiscount(0);
      setCouponCode("");
      setCouponDiscount(0);
      setCouponId(null);
      setCouponMsg(null);
      setOrderSent(true);

      trackPixelPurchase(capturedFinalTotal);
      trackGAPurchase(
        createdOrderId || "unknown",
        capturedFinalTotal,
        cartSnapshot.map((i) => ({ name: i.product.name, price: Number(i.product.salePrice), quantity: i.quantity })),
      );

      const isOnlinePayment =
        form.paymentMethod === "PIX" ||
        form.paymentMethod === "CREDIT_CARD" ||
        form.paymentMethod === "DEBIT_CARD";

      if (isOnlinePayment && createdOrderId) {
        setLoadingPayment(true);
        try {
          const payRes = await fetch(`${apiBaseUrl}/payments/order-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: createdOrderId, companyId }),
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            if (payData?.checkoutUrl) setPaymentUrl(payData.checkoutUrl);
          }
        } catch { /* silent */ } finally {
          setLoadingPayment(false);
        }
      }
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pedido enviado ──────────────────────────────────────────────────────────
  if (orderSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-sm w-full flex flex-col items-center gap-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Pedido recebido!</h1>
          <p className="text-gray-500 text-sm">
            Seu pedido foi enviado para <strong>{companyName}</strong>. Aguarde a confirmação.
          </p>
          {loyaltyPointsEarned > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 text-yellow-700 font-bold text-sm">
              <Star size={16} fill="currentColor" />
              +{loyaltyPointsEarned} pontos de fidelidade!
            </div>
          )}
          {loadingPayment && (
            <div className="flex items-center gap-2 text-gray-400 text-sm animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              Gerando link de pagamento...
            </div>
          )}
          {paymentUrl && !loadingPayment && (
            <a
              href={paymentUrl}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-2xl font-bold text-sm transition w-full justify-center"
            >
              <CreditCard size={18} />
              Pagar agora
            </a>
          )}
          <button
            onClick={() => { setOrderSent(false); setOrderId(null); setPaymentUrl(null); }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl font-bold text-sm transition"
          >
            Fazer novo pedido
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Carregando cardápio...</p>
        <p className="text-gray-400 text-xs">Se demorar, o servidor pode estar acordando</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="text-gray-700 text-lg font-semibold">Cardápio indisponível no momento</p>
        <p className="text-gray-400 text-sm max-w-xs">O servidor pode estar iniciando. Aguarde alguns segundos.</p>
        <button
          onClick={() => loadMenu(1)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition"
        >
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: "12px", fontWeight: 600 } }} />

      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <ChatWidget companyId={companyId} companyName={companyName} />

      {/* ─── Header ────────────────────────────────────────────────────────────── */}
      <header className="bg-orange-500 text-white px-4 pt-8 pb-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-black tracking-tight">{companyName}</h1>
          {tableNumber && (
            <span className="inline-block mt-1 bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
              Mesa {tableNumber}
            </span>
          )}
          <div className="flex items-center gap-4 mt-3 text-orange-100 text-xs">
            <span className="flex items-center gap-1"><Clock size={12} /> Aberto agora</span>
            <span className="flex items-center gap-1"><MapPin size={12} /> Delivery e Retirada</span>
          </div>
        </div>
      </header>

      {/* ─── Painel flutuante sobre o header ───────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-md px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Seu pedido</p>
            <p className="text-gray-800 font-bold">{cartCount > 0 ? `${cartCount} ite${cartCount > 1 ? "ns" : "m"}` : "Nenhum item"}</p>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition"
          >
            <ShoppingCart size={16} />
            {cartCount > 0 ? `R$ ${cartTotal.toFixed(2)}` : "Ver cardápio"}
          </button>
        </div>
      </div>

      {/* ─── Categorias + Busca ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm mt-4">
        <div className="px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 max-w-2xl mx-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${
                  activeCategory === cat
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 pb-3 max-w-2xl mx-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Produtos ───────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-20">Nenhum produto disponível</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex"
              >
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-snug">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                    <span className="text-orange-500 font-black text-lg">
                      R$ {Number(product.salePrice).toFixed(2)}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openFlavorModal(product)}
                        className="border border-orange-200 text-orange-500 hover:bg-orange-50 px-3 py-1.5 rounded-xl font-bold text-xs transition"
                        title="Meio a meio"
                      >
                        🍕 Meio a meio
                      </button>
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-1 transition text-sm"
                      >
                        <Plus size={14} /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-28 h-28 flex-shrink-0 relative">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const t = e.currentTarget;
                        t.onerror = null;
                        t.style.display = "none";
                        const ph = t.nextElementSibling as HTMLElement;
                        if (ph) ph.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full bg-orange-50 flex items-center justify-center text-3xl"
                    style={{ display: product.imageUrl ? "none" : "flex" }}
                  >
                    🍽️
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Botão flutuante de carrinho (mobile) ─────────────────────────────── */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4">
          <button
            onClick={() => setShowCart(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black text-base shadow-xl shadow-orange-500/40 flex items-center gap-3 transition max-w-sm w-full justify-between"
          >
            <span className="bg-white/20 rounded-xl px-2.5 py-0.5 text-sm font-black">{cartCount}</span>
            <span>Ver pedido</span>
            <span className="font-black">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* ─── Carrinho Drawer ─────────────────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white w-full max-w-md flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">Seu pedido</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-center py-10">Carrinho vazio</p>
              ) : cart.map((item) => (
                <div key={item.cartKey} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{item.product.name}</p>
                    {item.notes && item.flavors && (
                      <p className="text-orange-500 text-xs mt-0.5">{item.notes}</p>
                    )}
                    <p className="text-orange-500 font-bold text-sm mt-1">
                      R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.cartKey, -1)} className="bg-gray-200 hover:bg-gray-300 p-1.5 rounded-lg transition">
                      <Minus size={14} />
                    </button>
                    <span className="font-black w-5 text-center text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartKey, 1)} className="bg-gray-200 hover:bg-gray-300 p-1.5 rounded-lg transition">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setCart((p) => p.filter((i) => i.cartKey !== item.cartKey))} className="ml-1 text-red-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-5 border-t border-gray-100">
              <div className="flex justify-between text-lg font-black text-gray-900 mb-4">
                <span>Total</span>
                <span className="text-orange-500">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                disabled={cart.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition"
              >
                Finalizar pedido <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Pizza meio a meio ─────────────────────────────────────────────── */}
      {showFlavorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFlavorModal(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-gray-900">Montar Pizza</h2>
                <p className="text-gray-400 text-xs mt-0.5">Preço = maior valor entre os sabores</p>
              </div>
              <button onClick={() => setShowFlavorModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-sm text-gray-500 shrink-0">Dividir em:</span>
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => changeFlavorParts(n)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${flavorParts === n ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {n === 2 ? "Meio" : n === 3 ? "3 sab." : "4 sab."}
                </button>
              ))}
            </div>
            <input
              value={flavorFilter}
              onChange={(e) => setFlavorFilter(e.target.value)}
              placeholder="Filtrar sabores..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 mb-4 focus:outline-none focus:border-orange-400"
            />
            <div className="space-y-3 mb-5">
              {Array.from({ length: flavorParts }).map((_, i) => {
                const fraction = flavorParts === 2 ? "1/2" : flavorParts === 3 ? "1/3" : "1/4";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-400 w-8 text-center bg-gray-100 rounded-lg py-1 shrink-0">{fraction}</span>
                    <select
                      value={flavorSlots[i]?.id || ""}
                      onChange={(e) => setFlavorSlot(i, products.find((p) => p.id === e.target.value) || null)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
                    >
                      <option value="">— Sabor {i + 1} —</option>
                      {products.filter((p) => !flavorFilter || p.name.toLowerCase().includes(flavorFilter.toLowerCase())).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.salePrice).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {flavorSlots.some(Boolean) && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-5 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">Composição</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {flavorSlots.filter(Boolean).map((f) => f!.name).join(" + ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-xl font-black text-orange-500">
                    R$ {Math.max(...flavorSlots.filter(Boolean).map((f) => Number(f!.salePrice))).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowFlavorModal(false)} className="flex-1 border border-gray-200 hover:bg-gray-50 transition py-3 rounded-xl font-semibold text-sm text-gray-600">Cancelar</button>
              <button onClick={confirmFlavors} className="flex-1 bg-orange-500 hover:bg-orange-600 transition py-3 rounded-xl font-bold text-sm text-white">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Checkout Modal ──────────────────────────────────────────────────────── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-gray-900">Seus dados</h2>
              <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <input
              placeholder="Seu nome *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-orange-400 text-sm"
            />
            <input
              placeholder="Telefone / WhatsApp *"
              value={form.phone}
              onChange={(e) => {
                const phone = e.target.value;
                setForm((f) => ({ ...f, phone }));
                setUsePoints(false);
                setLoyaltyPoints(0);
                setLoyaltyDiscount(0);
                if (phone.length >= 8) fetchLoyaltyBalance(phone);
              }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-orange-400 text-sm"
            />

            {loyaltyPoints > 0 && (
              <label className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-yellow-700 font-bold text-sm">
                    <Star size={13} fill="currentColor" /> {loyaltyPoints} pontos disponíveis
                  </div>
                  <div className="text-gray-400 text-xs">= R$ {loyaltyDiscount},00 de desconto</div>
                </div>
              </label>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg(null); setCouponDiscount(0); setCouponId(null); }}
                  onKeyDown={(e) => e.key === "Enter" && validateCoupon(couponCode)}
                  placeholder="CUPOM DE DESCONTO"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-gray-900 text-sm outline-none focus:border-orange-400 font-mono uppercase tracking-wider placeholder-gray-300"
                />
              </div>
              <button
                onClick={() => validateCoupon(couponCode)}
                disabled={!couponCode.trim() || couponLoading}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 px-4 rounded-xl font-bold text-sm transition flex-shrink-0"
              >
                {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
              </button>
            </div>
            {couponMsg && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${couponMsg.valid ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
                {couponMsg.valid ? <CheckCircle size={14} /> : <X size={14} />}
                {couponMsg.text}
              </div>
            )}

            {!tableNumber && (
              <div className="grid grid-cols-2 gap-3">
                {(["DELIVERY", "PICKUP"] as const).map((type) => (
                  <button key={type} onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                    className={`py-3 rounded-xl font-bold transition text-sm ${form.orderType === type ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {type === "DELIVERY" ? "Entrega" : "Retirada"}
                  </button>
                ))}
              </div>
            )}
            {!tableNumber && form.orderType === "DELIVERY" && (
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  placeholder="Endereço de entrega *"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-gray-900 outline-none focus:border-orange-400 text-sm"
                />
              </div>
            )}
            {tableNumber && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 text-sm">
                Pedido para Mesa {tableNumber}
              </div>
            )}

            <select
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as CustomerForm["paymentMethod"] }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-orange-400 text-sm"
            >
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
            </select>

            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </div>
              {usePoints && loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-yellow-600">
                  <span className="flex items-center gap-1"><Star size={11} fill="currentColor" /> Fidelidade</span>
                  <span>- R$ {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1"><Tag size={11} /> Cupom</span>
                  <span>- R$ {couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span className="text-orange-500">R$ {finalCartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base transition"
            >
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
