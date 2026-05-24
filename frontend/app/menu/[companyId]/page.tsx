"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { ShoppingCart, X, Plus, Minus, Trash2, ChevronRight, RefreshCw, CreditCard, Loader2, Star, Tag, CheckCircle } from "lucide-react";
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

type CartItem = { product: Product; quantity: number; notes: string };

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
  const [form, setForm] = useState<CustomerForm>({
    name: "", phone: "", address: "", orderType: "DELIVERY", paymentMethod: "PIX",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("table");
    if (t) setTableNumber(t);
  }, []);

  async function loadMenu() {
    setLoading(true);
    setLoadError(false);
    try {
      const [menuRes, companyRes, themeRes] = await Promise.all([
        fetch(`${apiBaseUrl}/products/public/menu/${companyId}`),
        fetch(`${apiBaseUrl}/company/${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/themes/${companyId}`).catch(() => null),
      ]);

      if (!menuRes.ok) {
        setLoadError(true);
        return;
      }

      const menuData = await menuRes.json();
      const list: Product[] = Array.isArray(menuData) ? menuData : (menuData.products || []);
      setProducts(list);
      setCategories(["Todos", ...Array.from(new Set<string>(list.map((p) => p.category?.name || "Outros")))]);

      if (companyRes?.ok) {
        const cd = await companyRes.json().catch(() => null);
        if (cd?.name) setCompanyName(cd.name);
      }

      if (themeRes?.ok) {
        const td = await themeRes.json().catch(() => null);
        if (td?.metaPixelId) setMetaPixelId(td.metaPixelId);
        if (td?.gaId) setGaId(td.gaId);
      }
    } catch {
      setLoadError(true);
    } finally {
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
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
    trackPixelAddToCart(Number(product.salePrice), product.name);
    trackGAAddToCart(product.name, Number(product.salePrice));
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => prev.map((i) => i.product.id !== productId ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }

  const cartTotal = cart.reduce((acc, i) => acc + Number(i.product.salePrice) * i.quantity, 0);
  const totalDiscount = (usePoints ? loyaltyDiscount : 0) + couponDiscount;
  const finalCartTotal = Math.max(0, cartTotal - totalDiscount);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const filtered = activeCategory === "Todos" ? products : products.filter((p) => (p.category?.name || "Outros") === activeCategory);

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
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity, notes: i.notes })),
          total: finalCartTotal,
          redeemPoints: pointsToRedeem,
          notes: tableNumber ? `Mesa ${tableNumber}` : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const orderData = await res.json().catch(() => null);
      const createdOrderId: string | null = orderData?.id ?? null;
      // Capture cart snapshot before clearing for tracking events
      const cartSnapshot = cart.slice();
      const capturedFinalTotal = finalCartTotal;

      // Redeem coupon (fire-and-forget)
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

      // Fire tracking events on purchase
      trackPixelPurchase(capturedFinalTotal);
      trackGAPurchase(
        createdOrderId || "unknown",
        capturedFinalTotal,
        cartSnapshot.map((i) => ({ name: i.product.name, price: Number(i.product.salePrice), quantity: i.quantity })),
      );

      // For online payments (PIX / card), auto-trigger gateway checkout
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
            if (payData?.checkoutUrl) {
              setPaymentUrl(payData.checkoutUrl);
            }
          }
        } catch {
          // Payment link failed — still show order received, customer can retry
        } finally {
          setLoadingPayment(false);
        }
      }
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (orderSent) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="text-4xl font-black text-green-400">Pedido recebido!</h1>
        <p className="text-slate-400 text-lg max-w-sm">
          Seu pedido foi enviado para {companyName}. Você será notificado em breve.
        </p>
        {loyaltyPointsEarned > 0 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-6 py-3 text-yellow-400 font-bold">
            <Star size={18} fill="currentColor" />
            +{loyaltyPointsEarned} pontos de fidelidade ganhos!
          </div>
        )}

        {/* Payment button for PIX / card orders */}
        {loadingPayment && (
          <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
            <Loader2 size={18} className="animate-spin" />
            Gerando link de pagamento...
          </div>
        )}
        {paymentUrl && !loadingPayment && (
          <a
            href={paymentUrl}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-lg transition"
          >
            <CreditCard size={22} />
            Pagar agora
          </a>
        )}

        <button
          onClick={() => {
            setOrderSent(false);
            setOrderId(null);
            setPaymentUrl(null);
          }}
          className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition"
        >
          Fazer novo pedido
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Tracking */}
      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
      {gaId && <GoogleAnalytics gaId={gaId} />}

      {/* Chatbot */}
      <ChatWidget companyId={companyId} companyName={companyName} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-red-400 truncate max-w-[200px]">{companyName}</h1>
            {tableNumber && (
              <span className="text-xs font-semibold text-slate-300 bg-slate-700 px-2 py-0.5 rounded-full">
                Mesa {tableNumber}
              </span>
            )}
          </div>
          <button onClick={() => setShowCart(true)} className="relative bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition">
            <ShoppingCart size={18} />
            <span>R$ {cartTotal.toFixed(2)}</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[65px] z-30 bg-slate-950 border-b border-slate-800 px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 max-w-3xl mx-auto">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeCategory === cat ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 animate-pulse">Carregando cardápio...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <p className="text-slate-400 text-lg">Não foi possível carregar o cardápio.</p>
            <p className="text-slate-500 text-sm">O servidor pode estar iniciando. Tente novamente em alguns segundos.</p>
            <button onClick={loadMenu} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition">
              <RefreshCw size={18} /> Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-center py-20">Nenhum produto disponível</p>
        ) : (
          <div className="grid gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex">
                {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="w-28 h-28 object-cover flex-shrink-0" />}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{product.name}</h3>
                    {product.description && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{product.description}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-green-400 font-black text-xl">R$ {Number(product.salePrice).toFixed(2)}</span>
                    <button onClick={() => addToCart(product)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition text-sm">
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="relative bg-slate-900 w-full max-w-md flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold">Seu pedido</h2>
              <button onClick={() => setShowCart(false)}><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? <p className="text-slate-400 text-center py-10">Carrinho vazio</p> : cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="font-bold">{item.product.name}</p>
                    <p className="text-green-400 font-bold">R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="bg-slate-700 hover:bg-slate-600 p-1 rounded-lg transition"><Minus size={16} /></button>
                    <span className="font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="bg-slate-700 hover:bg-slate-600 p-1 rounded-lg transition"><Plus size={16} /></button>
                    <button onClick={() => setCart((p) => p.filter((i) => i.product.id !== item.product.id))} className="ml-2 text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-800">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total</span><span className="text-green-400">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={() => { setShowCart(false); setShowCheckout(true); }} disabled={cart.length === 0}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition">
                Finalizar pedido <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Seus dados</h2>
              <button onClick={() => setShowCheckout(false)}><X size={24} /></button>
            </div>
            <input placeholder="Seu nome *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500" />
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
            />
            {loyaltyPoints > 0 && (
              <label className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="w-4 h-4 accent-yellow-400"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                    <Star size={14} fill="currentColor" />
                    {loyaltyPoints} pontos disponíveis
                  </div>
                  <div className="text-slate-400 text-xs">
                    Usar agora = R$ {loyaltyDiscount},00 de desconto
                  </div>
                </div>
              </label>
            )}
            {/* Coupon field */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponMsg(null);
                    setCouponDiscount(0);
                    setCouponId(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && validateCoupon(couponCode)}
                  placeholder="CUPOM DE DESCONTO"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-red-500 placeholder-slate-500 font-mono uppercase tracking-wider"
                />
              </div>
              <button
                onClick={() => validateCoupon(couponCode)}
                disabled={!couponCode.trim() || couponLoading}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-4 rounded-xl font-bold text-sm transition flex-shrink-0"
              >
                {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
              </button>
            </div>
            {couponMsg && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${couponMsg.valid ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                {couponMsg.valid ? <CheckCircle size={14} /> : <X size={14} />}
                {couponMsg.text}
              </div>
            )}

            {!tableNumber && (
              <div className="grid grid-cols-2 gap-3">
                {(["DELIVERY", "PICKUP"] as const).map((type) => (
                  <button key={type} onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                    className={`py-3 rounded-xl font-bold transition ${form.orderType === type ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                    {type === "DELIVERY" ? "Entrega" : "Retirada"}
                  </button>
                ))}
              </div>
            )}
            {!tableNumber && form.orderType === "DELIVERY" && (
              <input placeholder="Endereço de entrega *" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500" />
            )}
            {tableNumber && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm">
                Pedido para Mesa {tableNumber}
              </div>
            )}
            <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as CustomerForm["paymentMethod"] }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500">
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
            </select>
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Subtotal</span>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </div>
              {usePoints && loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-yellow-400">
                  <span className="flex items-center gap-1"><Star size={12} fill="currentColor" /> Fidelidade</span>
                  <span>- R$ {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span className="flex items-center gap-1"><Tag size={12} /> Cupom</span>
                  <span>- R$ {couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1 border-t border-slate-700">
                <span>Total</span>
                <span className="text-green-400">R$ {finalCartTotal.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={submitOrder} disabled={submitting} className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg transition">
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
