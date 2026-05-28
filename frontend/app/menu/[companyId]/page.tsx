"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  ShoppingCart, X, Plus, Minus, Trash2, ChevronRight,
  RefreshCw, CreditCard, Loader2, Star, Tag, CheckCircle,
  MapPin, Clock, Phone, Search, Copy, Timer,
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
  orderType: "DELIVERY" | "PICKUP";
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  complement: string;
};

type PixData = {
  pixCopyPaste: string;
  pixQrcode: string | null;
  expiresAt: Date;
  paymentId: string;
  mock?: boolean;
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
  const [theme, setTheme] = useState<{
    primaryColor: string; logoUrl?: string | null; bannerUrl?: string | null;
    pizzaPricingMode?: string;
  }>({ primaryColor: "#f97316" });
  const [cepLoading, setCepLoading] = useState(false);
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
    name: "", phone: "", orderType: "DELIVERY", paymentMethod: "PIX",
    street: "", number: "", neighborhood: "", city: "", state: "", zipcode: "", complement: "",
  });
  const [onlineOrderId, setOnlineOrderId] = useState<string | null>(null);
  const [showPixScreen, setShowPixScreen] = useState(false);
  const [pixData, setPixData]             = useState<PixData | null>(null);
  const [pixCountdown, setPixCountdown]   = useState(0);
  const [pixPaid, setPixPaid]             = useState(false);

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
        // Render free tier pode demorar até 50s para acordar — tentar até 8x
        if (attempt < 8) {
          setTimeout(() => loadMenu(attempt + 1), attempt <= 2 ? 5000 : 8000);
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
        if (td) setTheme({
          primaryColor: td.primaryColor || "#f97316",
          logoUrl: td.logoUrl || null,
          bannerUrl: td.bannerUrl || null,
          pizzaPricingMode: td.pizzaPricingMode || "MAX",
        });
      }

      setLoading(false);
    } catch {
      if (attempt < 8) {
        setTimeout(() => loadMenu(attempt + 1), attempt <= 2 ? 5000 : 8000);
        return;
      }
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => { loadMenu(); }, [companyId]);

  /* ── PIX countdown ────────────────────────────────────────────── */
  useEffect(() => {
    if (!showPixScreen || !pixData?.expiresAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(pixData.expiresAt).getTime() - Date.now()) / 1000));
      setPixCountdown(secs);
      if (secs === 0) setPixPaid(false);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [showPixScreen, pixData?.expiresAt]);

  /* ── PIX payment polling ──────────────────────────────────────── */
  useEffect(() => {
    if (!showPixScreen || !onlineOrderId || pixPaid) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/payments/status/${onlineOrderId}?companyId=${companyId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.paymentStatus === "APPROVED") {
          setPixPaid(true);
          clearInterval(poll);
        } else if (data.paymentStatus === "REJECTED" || data.paymentStatus === "EXPIRED") {
          clearInterval(poll);
          toast.error("Pagamento não confirmado. Tente novamente.");
          setShowPixScreen(false);
        }
      } catch { /* silent */ }
    }, 4000);
    return () => clearInterval(poll);
  }, [showPixScreen, onlineOrderId, pixPaid, companyId]);

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

  async function fetchByCep(cep: string) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.erro) return;
      setForm((f) => ({
        ...f,
        street: d.logradouro || f.street,
        neighborhood: d.bairro || f.neighborhood,
        city: d.localidade || f.city,
        state: d.uf || f.state,
      }));
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }

  function calcPizzaPrice(flavors: Product[]) {
    const prices = flavors.map((f) => Number(f.salePrice));
    if (theme.pizzaPricingMode === "HALF") {
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    return Math.max(...prices);
  }

  function confirmFlavors() {
    const chosen = flavorSlots.filter(Boolean) as Product[];
    if (chosen.length < 2) { toast.error("Selecione ao menos 2 sabores"); return; }
    const finalPrice = calcPizzaPrice(chosen);
    const base = chosen.find((f) => Number(f.salePrice) === Math.max(...chosen.map(f => Number(f.salePrice)))) || chosen[0];
    const fraction = flavorParts === 2 ? "1/2" : flavorParts === 3 ? "1/3" : "1/4";
    const noteText = chosen.map((f) => `${fraction} ${f.name}`).join(" | ");
    const composedName = `Pizza ${chosen.length} sabores: ${chosen.map((f) => f.name).join(" + ")}`;
    setCart((prev) => [...prev, {
      cartKey: `pizza-${Date.now()}`,
      product: { ...base, name: composedName, salePrice: finalPrice as any },
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
    if (!tableNumber && form.orderType === "DELIVERY" && !form.street) { toast.error("Informe o endereço de entrega"); return; }
    if (cart.length === 0) { toast.error("Carrinho vazio"); return; }
    setSubmitting(true);

    try {
      const capturedFinalTotal = finalCartTotal;
      const cartSnapshot = cart.slice();

      const addressLine = form.orderType === "DELIVERY"
        ? [form.street, form.number, form.complement, form.neighborhood, form.city, form.state].filter(Boolean).join(", ")
        : "";

      // Step 1 — create OnlineOrder
      const orderRes = await fetch(`${apiBaseUrl}/online-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          customerName:  form.name,
          customerPhone: form.phone,
          orderType:     tableNumber ? "DINE_IN" : form.orderType,
          address:       form.street,
          addressNumber: form.number,
          neighborhood:  form.neighborhood,
          city:          form.city,
          state:         form.state,
          zipcode:       form.zipcode,
          complement:    form.complement,
          items: cartSnapshot.map((i) => ({
            productId:   i.flavors ? i.flavors[0].id : i.product.id,
            productName: i.product.name,
            quantity:    i.quantity,
            unitPrice:   Number(i.product.salePrice),
            notes:       i.notes || "",
          })),
          subtotal:      cartTotal,
          discount:      (usePoints ? loyaltyDiscount : 0) + couponDiscount,
          deliveryFee:   0,
          total:         capturedFinalTotal,
          paymentMethod: form.paymentMethod,
          notes:         tableNumber ? `Mesa ${tableNumber}` : undefined,
        }),
      });

      if (!orderRes.ok) throw new Error(await orderRes.text());
      const orderData = await orderRes.json();
      const createdOrderId: string = orderData.id;
      setOnlineOrderId(createdOrderId);

      // Step 2 — redeem coupon async (fire-and-forget)
      if (couponId) {
        fetch(`${apiBaseUrl}/coupons/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ couponId }),
        }).catch(() => {});
      }

      // Step 3 — analytics
      trackPixelPurchase(capturedFinalTotal);
      trackGAPurchase(createdOrderId, capturedFinalTotal,
        cartSnapshot.map((i) => ({ name: i.product.name, price: Number(i.product.salePrice), quantity: i.quantity })));

      // Step 4 — clear cart / form state
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setUsePoints(false);
      setLoyaltyPoints(0);
      setLoyaltyDiscount(0);
      setCouponCode("");
      setCouponDiscount(0);
      setCouponId(null);
      setCouponMsg(null);

      // Step 5 — PIX flow: generate QR code and show payment screen
      if (form.paymentMethod === "PIX") {
        setLoadingPayment(true);
        try {
          const pixRes = await fetch(`${apiBaseUrl}/payments/online-order/${createdOrderId}/pix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId }),
          });
          if (!pixRes.ok) throw new Error(await pixRes.text());
          const pix = await pixRes.json();
          setPixData({
            pixCopyPaste: pix.pixCopyPaste,
            pixQrcode:    pix.pixQrcode,
            expiresAt:    new Date(pix.expiresAt),
            paymentId:    pix.paymentId,
            mock:         pix.mock,
          });
          setShowPixScreen(true);
        } catch (e) {
          console.error(e);
          toast.error("Erro ao gerar PIX. Pedido criado — pague na entrega.");
          setOrderSent(true);
        } finally {
          setLoadingPayment(false);
        }
      } else {
        // CASH / CARD — show confirmation screen
        setOrderId(createdOrderId);
        setOrderSent(true);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Tela PIX ────────────────────────────────────────────────────────────────
  if (showPixScreen && pixData) {
    const mins = String(Math.floor(pixCountdown / 60)).padStart(2, "0");
    const secs = String(pixCountdown % 60).padStart(2, "0");

    if (pixPaid) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="bg-white rounded-3xl shadow-lg p-10 max-w-sm w-full flex flex-col items-center gap-5">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Pagamento confirmado!</h1>
            <p className="text-gray-500 text-sm">Seu pedido foi recebido por <strong>{companyName}</strong> e já está sendo preparado.</p>
            <button
              onClick={() => { setShowPixScreen(false); setPixPaid(false); setPixData(null); }}
              className="w-full py-3.5 rounded-2xl font-black text-white text-base transition"
              style={{ background: theme.primaryColor }}
            >
              Fazer novo pedido
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-white rounded-3xl shadow-lg p-7 max-w-sm w-full flex flex-col items-center gap-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "#e8f5e9" }}>
              <span className="text-3xl">💸</span>
            </div>
            <h1 className="text-xl font-black text-gray-900">Pague com PIX</h1>
            <p className="text-gray-400 text-sm mt-1">Escaneie o QR Code ou copie o código</p>
          </div>

          {/* QR Code */}
          {pixData.pixQrcode && !pixData.mock ? (
            <img
              src={`data:image/png;base64,${pixData.pixQrcode}`}
              alt="QR Code PIX"
              className="w-52 h-52 rounded-2xl border border-gray-100 shadow-sm"
            />
          ) : (
            <div className="w-52 h-52 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50">
              <span className="text-4xl">📱</span>
              <p className="text-xs text-center px-4">QR Code disponível após configurar chave PIX no Mercado Pago</p>
            </div>
          )}

          {/* Valor */}
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Valor a pagar</p>
            <p className="text-3xl font-black text-gray-900 mt-0.5">
              R$ {cart.length > 0
                ? finalCartTotal.toFixed(2)
                : (onlineOrderId ? "—" : "0,00")}
            </p>
          </div>

          {/* Copy-paste */}
          <div className="w-full">
            <p className="text-xs text-gray-400 mb-2 text-center">Copia e cola:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={pixData.pixCopyPaste}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 font-mono truncate focus:outline-none"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(pixData.pixCopyPaste); toast.success("Código copiado!"); }}
                className="px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
                style={{ background: theme.primaryColor }}
              >
                <Copy size={13} /> Copiar
              </button>
            </div>
          </div>

          {/* Countdown */}
          {pixCountdown > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Timer size={14} />
              <span>Expira em <strong className="text-gray-900">{mins}:{secs}</strong></span>
            </div>
          )}

          {/* Polling indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse">
            <Loader2 size={12} className="animate-spin" />
            Aguardando confirmação do pagamento...
          </div>

          {pixData.mock && (
            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 text-center">
              Modo teste — configure <strong>MERCADOPAGO_ACCESS_TOKEN</strong> no Render para ativar PIX real.
            </div>
          )}

          <button
            onClick={() => { setShowPixScreen(false); setPixData(null); setOnlineOrderId(null); }}
            className="text-gray-400 hover:text-gray-600 text-sm transition"
          >
            Cancelar e voltar ao cardápio
          </button>
        </div>
      </div>
    );
  }

  // ─── Pedido enviado (dinheiro/cartão) ────────────────────────────────────────
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
        <p className="text-gray-400 text-xs">Aguarde, o servidor pode levar até 1 minuto para acordar</p>
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
      <header className="relative text-white pb-24 sm:pb-16 overflow-hidden" style={{ minHeight: 180 }}>
        {/* Banner image or solid color */}
        {theme.bannerUrl ? (
          <>
            <img
              src={theme.bannerUrl}
              alt="banner"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)" }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: theme.primaryColor }} />
        )}

        {/* Content */}
        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-8">
          <div className="flex items-center gap-4">
            {theme.logoUrl && (
              <img
                src={theme.logoUrl}
                alt="logo"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg shrink-0"
              />
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight drop-shadow">{companyName}</h1>
              {tableNumber && (
                <span className="inline-block mt-1 bg-white/25 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Mesa {tableNumber}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-white/80 text-xs">
            <span className="flex items-center gap-1"><Clock size={12} /> Aberto agora</span>
            <span className="flex items-center gap-1"><MapPin size={12} /> Delivery e Retirada</span>
          </div>
        </div>
      </header>

      {/* ─── Painel flutuante sobre o header ───────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 -mt-16 sm:-mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-md px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Seu pedido</p>
            <p className="text-gray-800 font-bold">{cartCount > 0 ? `${cartCount} ite${cartCount > 1 ? "ns" : "m"}` : "Nenhum item"}</p>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition"
            style={{ background: theme.primaryColor }}
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
                className="px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition"
                style={activeCategory === cat
                  ? { background: theme.primaryColor, color: "#fff" }
                  : { background: "#f3f4f6", color: "#4b5563" }}
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
                <p className="text-gray-400 text-xs mt-0.5">
                  {theme.pizzaPricingMode === "HALF" ? "Preço = média dos sabores" : "Preço = sabor mais caro"}
                </p>
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
                    R$ {calcPizzaPrice(flavorSlots.filter(Boolean) as Product[]).toFixed(2)}
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
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">
            {/* Header fixo */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-black text-gray-900">Seus dados</h2>
              <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

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
              <div className="space-y-2">
                {/* CEP primeiro — preenche os demais automaticamente */}
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="CEP *"
                    value={form.zipcode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                      const formatted = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v;
                      setForm((f) => ({ ...f, zipcode: formatted }));
                      if (v.length === 8) fetchByCep(v);
                    }}
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                    inputMode="numeric"
                    maxLength={9}
                  />
                  {cepLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      placeholder="Rua / Av. *"
                      value={form.street}
                      onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <input
                    placeholder="Nº"
                    value={form.number}
                    onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                    className="w-16 flex-shrink-0 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                    inputMode="numeric"
                  />
                </div>
                <input
                  placeholder="Complemento (apto, bloco…)"
                  value={form.complement}
                  onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Bairro *"
                    value={form.neighborhood}
                    onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                    className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                  />
                  <input
                    placeholder="UF"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                    className="w-14 flex-shrink-0 border border-gray-200 rounded-xl px-2 py-3 text-gray-900 outline-none focus:border-primary text-sm text-center uppercase"
                    maxLength={2}
                  />
                </div>
                <input
                  placeholder="Cidade *"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-primary text-sm"
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

            </div>{/* fim scroll area */}

            {/* Botão fixo no rodapé do modal */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100">
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base transition"
              >
                {submitting ? "Enviando..." : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
