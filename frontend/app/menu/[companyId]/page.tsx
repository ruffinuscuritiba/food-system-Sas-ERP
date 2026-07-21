"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  ShoppingCart, X, Plus, Minus, Trash2, ChevronRight,
  RefreshCw, CreditCard, Loader2, Star, Tag, CheckCircle,
  MapPin, Clock, Phone, Search, Copy, Timer, Eye, Sparkles,
} from "lucide-react";
import { MetaPixel, trackPixelPurchase, trackPixelAddToCart } from "@/components/tracking/MetaPixel";
import { WhatsAppFloatButton } from "@/components/chat/WhatsAppFloatButton";
import { GoogleAnalytics, trackGAPurchase, trackGAAddToCart } from "@/components/tracking/GoogleAnalytics";
import { ComplementsModal, ComplementGroup, SelectedComplement } from "@/components/shared/ComplementsModal";

type Product = {
  id: string;
  name: string;
  description: string;
  salePrice: number;
  originalPrice?: number | null;
  featuredLabel?: string | null;
  imageUrl: string | null;
  imageZoom?: number;
  videoUrl?: string | null;
  hasVideo?: boolean;
  sizes?: { size: string; price: number }[];
  category?: { name: string; categoryType?: string; displayColumns?: number; sortOrder?: number };
  isActive: boolean;
};

/** Returns the minimum price across sizes (or salePrice when no sizes) */
function productMinPrice(product: Product): number {
  if (product.sizes && product.sizes.length > 0) {
    return Math.min(...product.sizes.map(s => Number(s.price)));
  }
  return Number(product.salePrice) || 0;
}

/** "A partir de R$ X,XX" for multi-size products, else "R$ X,XX" */
function productPriceLabel(product: Product, primaryColor?: string): string {
  if (product.sizes && product.sizes.length > 1) {
    const min = productMinPrice(product);
    return `A partir de R$ ${min.toFixed(2).replace(".", ",")}`;
  }
  return `R$ ${Number(product.salePrice).toFixed(2).replace(".", ",")}`;
}

/** % off when originalPrice is set and genuinely higher than salePrice, else null */
function discountPercent(product: Product): number | null {
  const original = Number(product.originalPrice) || 0;
  const current = Number(product.salePrice) || 0;
  if (original <= 0 || current <= 0 || original <= current) return null;
  return Math.round(((original - current) / original) * 100);
}

const FEATURED_LABEL_STYLES: Record<string, { text: string; className: string }> = {
  DESTAQUE: { text: "Destaque", className: "bg-orange-500 text-white" },
  NOVIDADE: { text: "Novidade", className: "bg-blue-500 text-white" },
  RECOMENDADO: { text: "Recomendado", className: "bg-emerald-500 text-white" },
};

/** Champion card v2 — apanhado de 3 referências reais (Hamburgueria do Airton,
 *  Toca do Lanche, Aliança Pizzaria): foto quadrada em destaque, badge de
 *  desconto pill verde no canto superior-esquerdo (estilo Toca do Lanche),
 *  botão "+" flutuante no canto superior-direito da foto (estilo Aliança
 *  Pizzaria — mais fácil de tocar sem abrir o produto), bloco de preço em
 *  2 linhas (riscado em cima, valor final grande embaixo). */
function FeaturedProductCard({ product, onAdd, primaryColor }: {
  product: Product; onAdd: (p: Product) => void; primaryColor: string;
}) {
  const discount = discountPercent(product);
  const labelStyle = !discount && product.featuredLabel ? FEATURED_LABEL_STYLES[product.featuredLabel] : null;

  return (
    <button onClick={() => onAdd(product)}
      className="flex-shrink-0 w-40 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left hover:shadow-md active:scale-95 transition">
      <div className="relative w-full aspect-square bg-gray-100">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover"
            style={{ transform: `scale(${(product.imageZoom ?? 100) / 100})`, transformOrigin: "center center" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
        )}
        {discount ? (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm">
            -{discount}%
          </span>
        ) : labelStyle ? (
          <span className={`absolute top-2 left-2 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm ${labelStyle.className}`}>
            {labelStyle.text}
          </span>
        ) : null}
        <span
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus size={15} strokeWidth={3} />
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem] leading-snug">{product.name}</p>
        {discount ? (
          <div className="mt-1 leading-tight">
            <p className="text-[11px] text-gray-400 line-through">
              R$ {Number(product.originalPrice).toFixed(2).replace(".", ",")}
            </p>
            <p className="text-base font-black text-emerald-600">
              R$ {Number(product.salePrice).toFixed(2).replace(".", ",")}
            </p>
          </div>
        ) : (
          <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
            {productPriceLabel(product)}
          </p>
        )}
      </div>
    </button>
  );
}

type BusinessHourDay = { open: string; close: string; isOpen: boolean };
type BusinessHours = Record<string, BusinessHourDay>;

/** Dia da semana (0=domingo…6=sábado, igual Date.getDay()) + faixa que cruza a meia-noite. */
function isStoreOpenNow(hours: BusinessHours | null | undefined): boolean {
  if (!hours) return true; // sem configuração — não bloqueia (comportamento anterior)
  const now = new Date();
  const day = hours[String(now.getDay())];
  if (!day || !day.isOpen) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const startMin = oh * 60 + (om || 0);
  const endMin = ch * 60 + (cm || 0);
  if (endMin > startMin) return cur >= startMin && cur <= endMin;
  return cur >= startMin || cur <= endMin; // horário atravessa a meia-noite
}

type CartComplement = {
  complementOptionId: string;
  complementName:     string;
  optionName:         string;
  price:              number;
  quantity:           number;
};
type CartItem = {
  cartKey: string;
  product: Product;
  quantity: number;
  notes: string;
  flavors?: Product[];
  complements?: CartComplement[];
};

type CustomerForm = {
  name: string;
  phone: string;
  orderType: "DELIVERY" | "PICKUP" | "DINE_IN";
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  complement: string;
  marketingOptIn: boolean;
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
  const router = useRouter();
  const initialTableNumber = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("table")
    : null;
  // Modo Totem: tablet fixo na mesa (?totem=1&table=X) — trava em DINE_IN,
  // mesa não editável pelo cliente, e reseta sozinho após o pedido pro
  // próximo cliente usar o mesmo aparelho (kiosk de autoatendimento).
  const isTotem = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("totem") === "1" && !!initialTableNumber
    : false;

  // deviceId estável por aparelho (persiste no localStorage do tablet fixo)
  const totemDeviceId = typeof window !== "undefined" && isTotem
    ? (() => {
        let id = localStorage.getItem("totem_device_id");
        if (!id) {
          id = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `totem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem("totem_device_id", id);
        }
        return id;
      })()
    : null;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryObjects, setCategoryObjects] = useState<any[]>([]); // full category objects with categoryType
  const [activeCategory, setActiveCategory] = useState("Todos");
  // Pizza size configs — maxFlavors per size
  const [pizzaSizeConfigs, setPizzaSizeConfigs] = useState<{ size: string; label: string; slices: number; maxFlavors: number; isActive: boolean }[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(initialTableNumber);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("Cardápio");
  const [companyWhatsapp, setCompanyWhatsapp] = useState<string | undefined>(undefined);
  const [assistantName, setAssistantName] = useState<string | undefined>(undefined);
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
  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const [streetLoading, setStreetLoading] = useState(false);
  const streetDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; valid: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // QR Recovery promo (cookie qr_promo set by /r/:token redirect)
  const [qrPromo, setQrPromo] = useState<{
    token: string; discountType: "PERCENTUAL" | "FIXO"; discountValue: number;
    campaignName: string; minimumOrder: number;
  } | null>(null);
  const [qrPromoMsg, setQrPromoMsg] = useState<string | null>(null);
  const [qrPromoApplied, setQrPromoApplied] = useState(false);

  const [search, setSearch] = useState("");
  const [videoProduct, setVideoProduct] = useState<Product | null>(null);
  const [menuLayoutConfig, setMenuLayoutConfig] = useState<{
    layoutType?: string;
    buttonRadius?: string;
    blocks?: { id: string; visible: boolean; order: number }[];
  } | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);

  // Delivery zone state — populated after loadMenu; matched per neighborhood change
  const [deliveryZones, setDeliveryZones] = useState<{ id: string; name: string; neighborhood: string | null; clientFee: number }[]>([]);
  const [selectedZone, setSelectedZone] = useState<{ id: string; clientFee: number } | null>(null);

  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const [flavorParts, setFlavorParts] = useState(2);
  const [flavorSlots, setFlavorSlots] = useState<(Product | null)[]>([null, null]);
  const [flavorFilter, setFlavorFilter] = useState("");

  const [form, setForm] = useState<CustomerForm>({
    name: "", phone: "", orderType: initialTableNumber ? "DINE_IN" : "DELIVERY", paymentMethod: "PIX",
    street: "", number: "", neighborhood: "", city: "", state: "", zipcode: "", complement: "",
    marketingOptIn: false,
  });
  // Real company ID (resolved from slug by backend) — used in POST requests
  const [realCompanyId, setRealCompanyId] = useState<string>(companyId);

  const [onlineOrderId, setOnlineOrderId] = useState<string | null>(null);
  const [showPixScreen, setShowPixScreen] = useState(false);
  const [pixData, setPixData]             = useState<PixData | null>(null);
  const [pixCountdown, setPixCountdown]   = useState(0);
  const [pixPaid, setPixPaid]             = useState(false);
  const [pixExpired, setPixExpired]       = useState(false);
  const [regeneratingPix, setRegeneratingPix] = useState(false);

  async function loadMenu(attempt = 1) {
    setLoading(true);
    setLoadError(false);
    try {
      const [menuRes, companyRes, themeRes, sizeConfigRes, zonesRes, layoutRes] = await Promise.all([
        fetch(`${apiBaseUrl}/products/public/menu/${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/company/${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/themes/${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/pizza-size-configs/public?companyId=${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/delivery-config/public?companyId=${companyId}`).catch(() => null),
        fetch(`${apiBaseUrl}/company/layout/public?companyId=${companyId}`).catch(() => null),
      ]);

      if (!menuRes || !menuRes.ok) {
        if (attempt < 4) {
          // Backend roda em VPS sempre ativo (sem cold-start) — retry curto
          // só pra absorver uma falha de rede pontual, não pra esperar acordar.
          setTimeout(() => loadMenu(attempt + 1), 1500);
          return;
        }
        setLoadError(true);
        setLoading(false);
        return;
      }

      const menuData = await menuRes.json();
      const list: Product[] = Array.isArray(menuData) ? menuData : (menuData.products || []);
      setProducts(list);

      // Keep full category objects (with categoryType) from menu data
      const catObjs: any[] = [];
      list.forEach((p) => {
        if (p.category && !catObjs.find((c) => c.name === p.category!.name)) {
          catObjs.push(p.category);
        }
      });
      // Mesma ordem usada no PDV: Category.sortOrder, depois nome (ver categories.service.ts findAll)
      catObjs.sort((a, b) => {
        const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        return diff !== 0 ? diff : String(a.name || "").localeCompare(String(b.name || ""));
      });
      setCategoryObjects(catObjs);

      // "Outros" agrupa produtos sem categoria e fica sempre por último.
      const catNames = catObjs.map((c) => String(c.name || "").trim()).filter(Boolean);
      const hasUncategorized = list.some((p) => !p.category?.name);
      const ordered = hasUncategorized && !catNames.includes("Outros") ? [...catNames, "Outros"] : catNames;
      setCategories(["Todos", ...ordered]);

      // Pizza size configs
      if (sizeConfigRes?.ok) {
        const sc = await sizeConfigRes.json().catch(() => []);
        if (Array.isArray(sc)) setPizzaSizeConfigs(sc);
      }

      // Delivery zones (public — no auth)
      if (zonesRes?.ok) {
        const zd = await zonesRes.json().catch(() => []);
        if (Array.isArray(zd)) setDeliveryZones(zd.map((z: any) => ({ ...z, clientFee: Number(z.clientFee) })));
      }

      if (companyRes?.ok) {
        const cd = await companyRes.json().catch(() => null);
        if (cd?.name) setCompanyName(cd.name);
        if (cd?.id) setRealCompanyId(cd.id);
        if (cd?.whatsapp || cd?.phone) setCompanyWhatsapp(cd.whatsapp || cd.phone);
        if (cd?.id) {
          fetch(`${apiBaseUrl}/whatsapp-ai/settings/public/assistant-name?companyId=${cd.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.name) setAssistantName(d.name); })
            .catch(() => {});
        }
      }

      if (themeRes?.ok) {
        const td = await themeRes.json().catch(() => null);
        if (td?.metaPixelId) setMetaPixelId(td.metaPixelId);
        if (td?.gaId) setGaId(td.gaId);
        if (td) {
          const primary = td.primaryColor || "#f97316";
          setTheme({
            primaryColor: primary,
            logoUrl: td.logoUrl || null,
            bannerUrl: td.bannerUrl || null,
            pizzaPricingMode: td.pizzaPricingMode || "MAX",
          });
          document.documentElement.style.setProperty("--color-primary", primary);
        }
      }

      // Layout config (block ordering, buttonRadius, layoutType)
      if (layoutRes?.ok) {
        const ld = await layoutRes.json().catch(() => null);
        if (ld) {
          setMenuLayoutConfig(ld.layoutConfig ?? null);
          setBusinessHours(ld.businessHours ?? null);
        }
      }

      setLoading(false);
    } catch {
      if (attempt < 4) {
        setTimeout(() => loadMenu(attempt + 1), 1500);
        return;
      }
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => { loadMenu(); }, [companyId]);

  /* ── QR Recovery promo — lê cookie qr_promo após menu carregar ── */
  useEffect(() => {
    if (!realCompanyId || realCompanyId === companyId) return; // aguarda resolve do slug
    const raw = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("qr_promo="));
    if (!raw) return;
    try {
      const payload = JSON.parse(atob(raw.split("=").slice(1).join("=")));
      if (!payload?.token) return;
      // Valida no backend (verifica se não foi usado, não expirou, etc.)
      fetch(`${apiBaseUrl}/qr-campaigns/checkout/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: payload.token, subtotal: 0 }),
      }).then(r => r.ok ? r.json() : null).then(data => {
        if (!data?.valid) { setQrPromoMsg("Cupom QR inválido ou já utilizado."); return; }
        setQrPromo({
          token: payload.token,
          discountType: data.discountType ?? "FIXO",
          discountValue: Number(data.discountValue ?? 0),
          campaignName: data.campaignName ?? "Cupom de desconto",
          minimumOrder: Number(data.minimumOrder ?? 0),
        });
      }).catch(() => {});
    } catch { /* cookie malformado — ignora */ }
  }, [realCompanyId]);

  /* ── Tráfego Pago — registra 1 visualização do cardápio por carregamento ── */
  useEffect(() => {
    if (!realCompanyId || realCompanyId === companyId) return; // aguarda resolve do slug
    fetch(`${apiBaseUrl}/menu-analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ companyId: realCompanyId, type: "MENU_VIEW" }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realCompanyId]);

  function trackProductView(productId: string) {
    if (!realCompanyId) return;
    fetch(`${apiBaseUrl}/menu-analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ companyId: realCompanyId, type: "PRODUCT_VIEW", productId }),
    }).catch(() => {});
  }

  /* ── PIX countdown ────────────────────────────────────────────── */
  useEffect(() => {
    if (!showPixScreen || !pixData?.expiresAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(pixData.expiresAt).getTime() - Date.now()) / 1000));
      setPixCountdown(secs);
      if (secs === 0) setPixExpired(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [showPixScreen, pixData?.expiresAt]);

  /* ── PIX regenerar após expirar (mesmo pedido, novo QR) ──────────── */
  async function regeneratePix() {
    if (!onlineOrderId) return;
    setRegeneratingPix(true);
    try {
      const pixRes = await fetch(`${apiBaseUrl}/payments/online-order/${onlineOrderId}/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: realCompanyId }),
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
      setPixExpired(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar um novo PIX. Tente novamente em instantes.");
    } finally {
      setRegeneratingPix(false);
    }
  }

  /* ── Modo Totem: reseta sozinho após o pedido para o próximo cliente ── */
  const [totemCountdown, setTotemCountdown] = useState(0);
  useEffect(() => {
    if (!isTotem || !orderSent) return;
    setTotemCountdown(10);
    const tick = setInterval(() => {
      setTotemCountdown((s) => {
        if (s <= 1) {
          clearInterval(tick);
          setCart([]);
          setOrderSent(false);
          setOrderId(null);
          setPaymentUrl(null);
          setShowCheckout(false);
          setCouponCode(""); setCouponDiscount(0); setCouponId(null); setCouponMsg(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [isTotem, orderSent]);

  /* ── Modo Totem: heartbeat a cada 30s (dashboard de status do lojista) ── */
  useEffect(() => {
    if (!isTotem || !totemDeviceId || !realCompanyId) return;
    const send = () => {
      fetch(`${apiBaseUrl}/totem/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: realCompanyId, deviceId: totemDeviceId, tableNumber }),
        keepalive: true,
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, 30_000);
    return () => clearInterval(id);
  }, [isTotem, totemDeviceId, realCompanyId, tableNumber]);

  /* ── PIX payment polling ──────────────────────────────────────── */
  useEffect(() => {
    if (!showPixScreen || !onlineOrderId || pixPaid || pixExpired) return;
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
  }, [showPixScreen, onlineOrderId, pixPaid, pixExpired, companyId]);

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
        body: JSON.stringify({ code: code.trim(), companyId: realCompanyId, orderTotal: cartTotal }),
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

  // ── Complementos: estado e fluxo ─────────────────────────────────────────────
  const [compProduct,   setCompProduct]   = useState<Product | null>(null);
  const [compGroups,    setCompGroups]    = useState<ComplementGroup[]>([]);
  const [compLoading,   setCompLoading]   = useState(false);

  function addProductDirect(product: Product, complements?: CartComplement[]) {
    setCart((prev) => {
      // Items com complementos sempre criam nova entrada (seleção difere)
      if (complements && complements.length > 0) {
        return [...prev, {
          cartKey: `${product.id}-${Date.now()}`,
          product, quantity: 1, notes: "", complements,
        }];
      }
      const existing = prev.find((i) => i.cartKey === product.id && !i.complements?.length);
      if (existing) return prev.map((i) =>
        i.cartKey === product.id && !i.complements?.length
          ? { ...i, quantity: i.quantity + 1 } : i
      );
      return [...prev, { cartKey: product.id, product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
    trackPixelAddToCart(Number(product.salePrice), product.name);
    trackGAAddToCart(product.name, Number(product.salePrice));
  }

  async function addToCart(product: Product) {
    trackProductView(product.id);
    // Busca complementos do produto via endpoint público (multiempresa por query)
    setCompLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/complements/public/product/${product.id}?companyId=${companyId}`);
      const groups: ComplementGroup[] = res.ok ? await res.json() : [];
      if (groups.length === 0) {
        addProductDirect(product);
        return;
      }
      setCompGroups(groups);
      setCompProduct(product);
    } catch {
      // Em erro de rede, adiciona direto (não bloqueia a venda)
      addProductDirect(product);
    } finally {
      setCompLoading(false);
    }
  }

  function updateQuantity(cartKey: string, delta: number) {
    setCart((prev) => prev.map((i) => i.cartKey !== cartKey ? i : { ...i, quantity: i.quantity + delta }).filter((i) => i.quantity > 0));
  }

  function openFlavorModal(product?: Product) {
    if (product) trackProductView(product.id);
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
      const newNeighborhood = d.bairro || "";
      const zone = newNeighborhood ? deliveryZones.find(z => z.neighborhood?.toLowerCase().trim() === newNeighborhood.toLowerCase().trim()) ?? null : null;
      setSelectedZone(zone ? { id: zone.id, clientFee: zone.clientFee } : null);
      setForm((f) => ({
        ...f,
        street: d.logradouro || f.street,
        neighborhood: newNeighborhood || f.neighborhood,
        city: d.localidade || f.city,
        state: d.uf || f.state,
      }));
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }

  async function searchStreet(query: string) {
    if (query.length < 5) { setStreetSuggestions([]); return; }
    setStreetLoading(true);
    try {
      const q = encodeURIComponent(query + ', Brasil');
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=br&addressdetails=1&limit=6`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'FoodSaaS-ERP/1.0' } }
      );
      if (!r.ok) return;
      const data = await r.json();
      setStreetSuggestions(data.filter((i: any) => i.address?.road));
    } catch { /* silent */ }
    finally { setStreetLoading(false); }
  }

  function selectStreetSuggestion(item: any) {
    const addr = item.address;
    const stateIso: string = addr['ISO3166-2-lvl4'] ?? '';
    const stateCode = stateIso.length >= 2 ? stateIso.slice(-2) : (addr.state ?? '');
    setForm((f) => ({
      ...f,
      street: addr.road ?? addr.pedestrian ?? addr.footway ?? f.street,
      neighborhood: addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? f.neighborhood,
      city: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? f.city,
      state: stateCode.toUpperCase().slice(0, 2) || f.state,
      zipcode: addr.postcode ?? f.zipcode,
    }));
    setStreetSuggestions([]);
  }

  function calcPizzaPrice(flavors: Product[]) {
    const prices = flavors.map((f) => Number(f.salePrice));
    if (theme.pizzaPricingMode === "HALF") {
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    return Math.max(...prices);
  }

  // Máximo de sabores permitido — usa os configs ou default 4
  const globalMaxFlavors = pizzaSizeConfigs.length > 0
    ? Math.max(...pizzaSizeConfigs.filter((c) => c.isActive).map((c) => c.maxFlavors))
    : 4;

  function confirmFlavors() {
    const chosen = flavorSlots.filter(Boolean) as Product[];
    if (chosen.length < 1) { toast.error("Selecione ao menos 1 sabor"); return; }
    const uniqueIds = new Set(chosen.map((f) => f.id));
    if (uniqueIds.size < chosen.length) { toast.error("Cada sabor deve ser diferente"); return; }
    const finalPrice = calcPizzaPrice(chosen);
    const base = chosen.find((f) => Number(f.salePrice) === Math.max(...chosen.map(f => Number(f.salePrice)))) || chosen[0];
    const fraction = flavorParts === 1 ? "inteiro" : flavorParts === 2 ? "1/2" : flavorParts === 3 ? "1/3" : "1/4";
    const noteText = chosen.map((f) => `${fraction} ${f.name}`).join(" | ");
    const composedName = chosen.length === 1
      ? `Pizza ${chosen[0].name}`
      : `Pizza ${chosen.length} sabores: ${chosen.map((f) => f.name).join(" + ")}`;
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

  const cartTotal = cart.reduce((acc, i) => {
    const compExtra = (i.complements || []).reduce((s, c) => s + Number(c.price) * c.quantity, 0);
    return acc + (Number(i.product.salePrice) + compExtra) * i.quantity;
  }, 0);
  const qrPromoDiscount = (() => {
    if (!qrPromo || !qrPromoApplied) return 0;
    if (cartTotal < qrPromo.minimumOrder) return 0;
    if (qrPromo.discountType === "PERCENTUAL") return Math.min(cartTotal, cartTotal * qrPromo.discountValue / 100);
    return Math.min(cartTotal, qrPromo.discountValue);
  })();
  const totalDiscount = (usePoints ? loyaltyDiscount : 0) + couponDiscount + qrPromoDiscount;
  const finalCartTotal = Math.max(0, cartTotal - totalDiscount);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "Todos" || (p.category?.name?.trim() || "Outros") === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function resetOrderFlow() {
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
    setOrderSent(false);
    setOrderId(null);
    setPaymentUrl(null);
    setOnlineOrderId(null);
    setShowPixScreen(false);
    setPixPaid(false);
    setPixData(null);
    setPixExpired(false);
  }

  async function submitOrder() {
    if (!form.name || !form.phone) { toast.error("Informe seu nome e telefone"); return; }
    if (form.orderType === "DINE_IN" && !tableNumber?.trim()) { toast.error("Informe o numero da mesa"); return; }
    if (form.orderType === "DELIVERY" && !form.street) { toast.error("Informe o endereco de entrega"); return; }
    if (cart.length === 0) { toast.error("Carrinho vazio"); return; }
    setSubmitting(true);

    try {
      const capturedFinalTotal = finalCartTotal;
      const cartSnapshot = cart.slice();

      const selectedOrderType = form.orderType;

      // Step 1 — create OnlineOrder
      const orderRes = await fetch(`${apiBaseUrl}/online-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: realCompanyId,
          customerName:  form.name,
          customerPhone: form.phone,
          orderType:     selectedOrderType,
          address:       form.street,
          addressNumber: form.number,
          neighborhood:  form.neighborhood,
          city:          form.city,
          state:         form.state,
          zipcode:       form.zipcode,
          complement:    form.complement,
          items: cartSnapshot.map((i) => {
            const compExtra = (i.complements || []).reduce((s, c) => s + Number(c.price) * c.quantity, 0);
            return {
              productId:   i.flavors ? i.flavors[0].id : i.product.id,
              productName: i.product.name,
              quantity:    i.quantity,
              unitPrice:   Number(i.product.salePrice) + compExtra,
              notes:       i.notes || "",
              complements: (i.complements || []).map((c) => ({
                complementOptionId: c.complementOptionId,
                complementName:     c.complementName,
                optionName:         c.optionName,
                price:              Number(c.price),
                quantity:           c.quantity,
              })),
            };
          }),
          subtotal:      cartTotal,
          discount:      (usePoints ? loyaltyDiscount : 0) + couponDiscount + qrPromoDiscount,
          deliveryFee:   selectedZone?.clientFee ?? 0,
          deliveryZoneId: selectedZone?.id ?? undefined,
          total:         capturedFinalTotal + (selectedZone?.clientFee ?? 0),
          paymentMethod: form.paymentMethod,
          notes:         selectedOrderType === "DINE_IN" ? `Mesa ${tableNumber}` : undefined,
          channel:       isTotem ? "TOTEM" : undefined,
          marketingOptIn: form.marketingOptIn,
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

      // Step 2b — redeem QR promo (fire-and-forget)
      if (qrPromo && qrPromoApplied) {
        fetch(`${apiBaseUrl}/qr-campaigns/checkout/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: qrPromo.token, orderId: createdOrderId, orderTotal: capturedFinalTotal, customerPhone: form.phone, customerName: form.name }),
          keepalive: true,
        }).then(() => {
          // limpa o cookie para não re-aplicar
          document.cookie = "qr_promo=; path=/; max-age=0";
          setQrPromo(null);
          setQrPromoApplied(false);
        }).catch(() => {});
      }

      // Step 3 — analytics
      trackPixelPurchase(capturedFinalTotal);
      trackGAPurchase(createdOrderId, capturedFinalTotal,
        cartSnapshot.map((i) => ({ name: i.product.name, price: Number(i.product.salePrice), quantity: i.quantity })));

      // Step 4 — clear cart / form state
      setShowCheckout(false);
      setShowCart(false);

      // Step 5 — PIX flow: generate QR code and show payment screen
      if (form.paymentMethod === "PIX") {
        setLoadingPayment(true);
        try {
          const pixRes = await fetch(`${apiBaseUrl}/payments/online-order/${createdOrderId}/pix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: realCompanyId }),
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
          setPixExpired(false);
          setShowPixScreen(true);
        } catch (e) {
          console.error(e);
          toast.error("Erro ao gerar PIX. Pedido criado — pague na entrega.");
          setOrderSent(true);
        } finally {
          setLoadingPayment(false);
        }
      } else {
        // CASH / CARD — redirect to real-time tracking page
        setCart([]);
        setUsePoints(false);
        setLoyaltyPoints(0);
        setLoyaltyDiscount(0);
        setCouponCode("");
        setCouponDiscount(0);
        setCouponId(null);
        setCouponMsg(null);
        router.push(`/pedido/confirmado?orderId=${createdOrderId}`);
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
              onClick={resetOrderFlow}
              className="w-full py-3.5 rounded-2xl font-black text-white text-base transition"
              style={{ background: theme.primaryColor }}
            >
              Fazer novo pedido
            </button>
          </div>
        </div>
      );
    }

    if (pixExpired) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="bg-white rounded-3xl shadow-lg p-10 max-w-sm w-full flex flex-col items-center gap-5">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <Timer size={40} className="text-amber-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">PIX expirado</h1>
            <p className="text-gray-500 text-sm">O código expirou antes do pagamento ser confirmado. Seu pedido continua reservado — gere um novo código para pagar.</p>
            <button
              onClick={regeneratePix}
              disabled={regeneratingPix}
              className="w-full py-3.5 rounded-2xl font-black text-white text-base transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: theme.primaryColor }}
            >
              {regeneratingPix ? <Loader2 size={18} className="animate-spin" /> : null}
              {regeneratingPix ? "Gerando..." : "Gerar novo PIX"}
            </button>
            <button
              onClick={resetOrderFlow}
              className="text-gray-400 hover:text-gray-600 text-sm transition"
            >
              Cancelar e voltar ao cardápio
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
            onClick={() => { setShowPixScreen(false); setPixData(null); setOnlineOrderId(null); setPixExpired(false); }}
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
          {isTotem ? (
            <p className="text-xs text-gray-400">
              Voltando ao cardápio em {totemCountdown}s para o próximo cliente...
            </p>
          ) : (
            <button
              onClick={() => { setOrderSent(false); setOrderId(null); setPaymentUrl(null); }}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white py-3 rounded-2xl font-bold text-sm transition"
            >
              Fazer novo pedido
            </button>
          )}
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
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="text-gray-700 text-lg font-semibold">Cardápio indisponível no momento</p>
        <p className="text-gray-400 text-sm max-w-xs">Não foi possível carregar o cardápio. Tente novamente em alguns instantes.</p>
        <button
          onClick={() => loadMenu(1)}
          className="flex items-center gap-2 bg-[var(--color-primary)] hover:opacity-90 text-white px-6 py-3 rounded-xl font-bold transition"
        >
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </div>
    );
  }

  // ── Layout config helpers ────────────────────────────────────────────────────
  const lcBlocks = menuLayoutConfig?.blocks ?? [];
  const blockVisible = (id: string) => {
    if (!lcBlocks.length) return true;
    const b = lcBlocks.find(b => b.id === id);
    return b ? b.visible : true;
  };
  const blockOrder = (id: string) => {
    const b = lcBlocks.find(b => b.id === id);
    return b?.order ?? 99;
  };
  const featuredProducts = products.filter(p => !!p.featuredLabel || discountPercent(p) !== null).slice(0, 6);
  // Order bump (upsell no checkout): produtos em destaque fora do carrinho;
  // fallback para bebidas/sobremesas. Máx 4. Reaproveita publicMenu — zero backend.
  const orderBumpProducts = (() => {
    if (cart.length === 0) return [];
    const inCart = new Set(cart.map(i => i.product.id));
    const isUpsellCat = (p: Product) =>
      p.category?.categoryType === "bebidas" ||
      /bebida|sobremesa|doce|drink|refri|suco|adicional/i.test(p.category?.name || "");
    const featured = products.filter(p => p.isActive && !inCart.has(p.id) && !!p.featuredLabel);
    const extra = products.filter(p => p.isActive && !inCart.has(p.id) && !featured.some(f => f.id === p.id) && isUpsellCat(p));
    return [...featured, ...extra].slice(0, 4);
  })();
  const showFeatured = blockVisible("featured") && featuredProducts.length > 0;
  const featuredBeforeCategories = blockOrder("featured") < blockOrder("categories");
  // Estilo "App" — categorias em avatar circular + cards de produto full-bleed
  // (foto de fundo + gradiente). Ativado quando a loja escolhe layoutType=LIST
  // no Construtor (valor padrão do banco — passa a ter efeito visual real).
  const isAppStyle = (menuLayoutConfig?.layoutType ?? "LIST") === "LIST";

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: "12px", fontWeight: 600 } }} />

      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <WhatsAppFloatButton phone={companyWhatsapp} companyName={companyName} assistantName={assistantName} />

      {/* ─── Header ────────────────────────────────────────────────────────────── */}
      {blockVisible("banner") && (
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
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {isStoreOpenNow(businessHours) ? "Aberto agora" : "Fechado no momento"}
            </span>
            <span className="flex items-center gap-1"><MapPin size={12} /> Delivery e Retirada</span>
          </div>
        </div>
      </header>
      )} {/* end blockVisible("banner") */}

      {/* ─── Destaques (featured block — before categories) ─────────────────────── */}
      {showFeatured && featuredBeforeCategories && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">⭐ Destaques</h2>
          <div className="flex gap-3 overflow-x-auto pb-3 scroll-smooth">
            {featuredProducts.map((p) => (
              <FeaturedProductCard key={p.id} product={p} onAdd={addToCart} primaryColor={theme.primaryColor} />
            ))}
          </div>
        </div>
      )}

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
            {cartCount > 0 ? `R$ ${cartTotal.toFixed(2)}` : "Ver pedido"}
          </button>
        </div>
      </div>

      {/* ─── Categorias + Busca ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm mt-4">
        <div className="max-w-2xl mx-auto px-4 py-3 overflow-x-auto touch-pan-x scroll-smooth">
          {isAppStyle ? (
            <div className="flex gap-4 min-w-max">
              {categories.map((cat) => {
                const catObj = categoryObjects.find((c) => c.name?.trim() === cat);
                const firstProductImg = products.find((p) => p.category?.name?.trim() === cat && p.imageUrl)?.imageUrl;
                const avatarUrl = catObj?.bannerImage || firstProductImg || (cat === "Todos" ? theme.logoUrl : undefined);
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="flex flex-col items-center gap-1.5 shrink-0"
                  >
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl transition"
                      style={{ boxShadow: isActive ? `0 0 0 3px ${theme.primaryColor}` : "0 0 0 1px #e5e7eb" }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={cat} className="w-full h-full object-cover" />
                      ) : "🍽️"}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {cat.replace(/^[^\p{L}\p{N}]+/u, '')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition"
                style={activeCategory === cat
                  ? { background: theme.primaryColor, color: "#fff" }
                  : { background: "#f3f4f6", color: "#4b5563" }}
              >
                {cat.replace(/^[^\p{L}\p{N}]+/u, '')}
              </button>
            ))}
          </div>
          )}
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

      {/* ─── Destaques (featured block — after categories) ──────────────────────── */}
      {showFeatured && !featuredBeforeCategories && (
        <div className="max-w-2xl mx-auto px-4 pt-2">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">⭐ Destaques</h2>
          <div className="flex gap-3 overflow-x-auto pb-3 scroll-smooth">
            {featuredProducts.map((p) => (
              <FeaturedProductCard key={p.id} product={p} onAdd={addToCart} primaryColor={theme.primaryColor} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Produtos ───────────────────────────────────────────────────────────── */}
      {/* pb-44 (176px) cobre CTA flutuante (~80px) + safe-area iOS + margem confortável */}
      <main className={`max-w-2xl mx-auto px-4 py-6 ${cartCount > 0 ? "pb-44" : "pb-12"}`} style={{ paddingBottom: cartCount > 0 ? "calc(7rem + env(safe-area-inset-bottom))" : undefined }}>
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-20">Nenhum produto disponível</p>
        ) : (() => {
          // Determine active category type
          const activeCatObj = categoryObjects.find((c) => c.name?.trim() === activeCategory);
          const isBeverageCat =
            activeCatObj?.categoryType === "bebidas" ||
            activeCatObj?.name?.toLowerCase().includes("bebida");
          const isPizzaCat = !isBeverageCat && (
            activeCategory === "Todos"
              ? false
              : activeCatObj?.allowMultipleFlavors === true ||
                activeCategory.toLowerCase().includes("pizza")
          );

          // Beverage grid layout
          if (isBeverageCat) {
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="relative aspect-square bg-gray-50">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🥤</div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col gap-1 flex-1">
                      <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">{product.name}</p>
                      <p className="text-xs font-black mt-auto leading-tight" style={{ color: theme.primaryColor }}>
                        {productPriceLabel(product)}
                      </p>
                      {product.videoUrl && (
                        <button
                          onClick={() => setVideoProduct(product)}
                          className="w-full py-1 rounded-xl font-bold text-gray-500 text-xs flex items-center justify-center gap-1 transition border border-gray-100 hover:bg-gray-50 mt-1"
                          title="Ver vídeo"
                        >
                          <Eye size={12} /> Vídeo
                        </button>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full py-1.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-1 transition mt-1"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        <Plus size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          // Estilo App — cards full-bleed (foto de fundo + gradiente escuro)
          if (isAppStyle) {
            return (
              <div className="space-y-3">
                {filtered.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition"
                    style={{ minHeight: 128, backgroundColor: "#1f2937" }}
                  >
                    {product.imageUrl && (
                      <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: `scale(${(product.imageZoom ?? 100) / 100})`, transformOrigin: "center center" }} />
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.05) 60%)" }} />
                    {!product.imageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🍽️</div>
                    )}
                    <div className="relative z-10 flex flex-col justify-end h-full min-h-[128px] p-4">
                      {(() => {
                        const disc = discountPercent(product);
                        const label = !disc && product.featuredLabel ? FEATURED_LABEL_STYLES[product.featuredLabel] : null;
                        if (disc) return (
                          <span className="self-start mb-1.5 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                            -{disc}% OFF
                          </span>
                        );
                        if (label) return (
                          <span className={`self-start mb-1.5 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${label.className}`}>
                            {label.text}
                          </span>
                        );
                        return null;
                      })()}
                      <h3 className="text-white font-black text-base leading-tight line-clamp-1" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)", WebkitTextStroke: "0.4px rgba(0,0,0,0.6)" }}>{product.name}</h3>
                      {product.description && (
                        <p className="text-white text-xs mt-0.5 line-clamp-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)", WebkitTextStroke: "0.4px rgba(0,0,0,0.7)" }}>{product.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="flex items-baseline gap-1.5 shrink-0">
                          {discountPercent(product) ? (
                            <span className="text-xs text-white/60 line-through" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>
                              R$ {Number(product.originalPrice).toFixed(2).replace(".", ",")}
                            </span>
                          ) : null}
                          <span className="font-black text-lg" style={{ color: "#facc15", textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)", WebkitTextStroke: "0.4px rgba(0,0,0,0.6)" }}>{productPriceLabel(product)}</span>
                        </span>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {product.videoUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setVideoProduct(product); }}
                              className="bg-white/15 text-white p-2 rounded-xl transition"
                              title="Ver vídeo do produto"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {isPizzaCat && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openFlavorModal(product); }}
                              className="bg-white/15 text-white px-3 py-2 rounded-xl font-bold text-xs transition"
                            >
                              🍕 Meio a meio
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                            className="text-white px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1 transition shrink-0"
                            style={{ backgroundColor: theme.primaryColor }}
                          >
                            <Plus size={14} /> Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          // Default list layout
          const renderProductCard = (product: Product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex"
                >
                  <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">{product.name}</h3>
                      {product.description && (
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <span className={`font-black leading-tight truncate min-w-0 ${product.sizes && product.sizes.length > 1 ? "text-sm" : "text-lg"}`} style={{ color: theme.primaryColor }}>
                        {productPriceLabel(product)}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        {product.videoUrl && (
                          <button
                            onClick={() => setVideoProduct(product)}
                            className="border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1"
                            title="Ver vídeo do produto"
                          >
                            <Eye size={13} /> Vídeo
                          </button>
                        )}
                        {isPizzaCat && (
                          <button
                            onClick={() => openFlavorModal(product)}
                            className="border border-orange-200 text-orange-500 hover:bg-orange-50 px-3 py-1.5 rounded-xl font-bold text-xs transition"
                            title="Meio a meio"
                          >
                            🍕 Meio a meio
                          </button>
                        )}
                        <button
                          onClick={() => addToCart(product)}
                          className="text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-1 transition text-sm"
                          style={{ backgroundColor: theme.primaryColor }}
                        >
                          <Plus size={14} /> Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 relative overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        style={{ transform: `scale(${(product.imageZoom ?? 100) / 100})`, transformOrigin: "center center" }}
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
          );

          // Em "Todos" os produtos vinham em ordem alfabética misturando
          // pizza salgada, doce, esfiha e bebida — agrupa por categoria
          // (mesma ordem das abas) pra ficar navegável como um cardápio real.
          if (activeCategory === "Todos") {
            const byCategory = new Map<string, Product[]>();
            for (const p of filtered) {
              const catName = p.category?.name?.trim() || "Outros";
              if (!byCategory.has(catName)) byCategory.set(catName, []);
              byCategory.get(catName)!.push(p);
            }
            const orderedCats = categories.filter((c) => c !== "Todos" && byCategory.has(c));
            return (
              <div className="space-y-6">
                {orderedCats.map((catName) => (
                  <div key={catName}>
                    <h2 className="text-sm font-bold text-gray-700 mb-3">{catName}</h2>
                    <div className="space-y-3">
                      {byCategory.get(catName)!.map(renderProductCard)}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filtered.map(renderProductCard)}
            </div>
          );
        })()}
      </main>

      {/* ─── Complementos modal ───────────────────────────────────────────────── */}
      <ComplementsModal
        open={!!compProduct}
        productName={compProduct?.name ?? ""}
        productBasePrice={Number(compProduct?.salePrice ?? 0)}
        groups={compGroups}
        loading={compLoading}
        theme="light"
        onClose={() => { setCompProduct(null); setCompGroups([]); }}
        onConfirm={(sel: SelectedComplement[]) => {
          if (!compProduct) return;
          const mapped: CartComplement[] = sel.map((s) => ({
            complementOptionId: s.complementOptionId,
            complementName:     s.complementName,
            optionName:         s.optionName,
            price:              Number(s.price),
            quantity:           s.quantity,
          }));
          addProductDirect(compProduct, mapped);
          setCompProduct(null);
          setCompGroups([]);
        }}
      />

      {/* ─── Botão flutuante de carrinho (mobile) ─────────────────────────────── */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <button
            onClick={() => setShowCart(true)}
            className="bg-[var(--color-primary)] hover:opacity-90 text-white px-8 py-4 rounded-2xl font-black text-base shadow-xl shadow-orange-500/40 flex items-center gap-3 transition max-w-sm w-full justify-between"
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
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{item.product.name}</p>
                    {item.notes && item.flavors && (
                      <p className="text-orange-500 text-xs mt-0.5">{item.notes}</p>
                    )}
                    {item.complements && item.complements.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {item.complements.map((c, idx) => (
                          <li key={idx} className="text-[11px] text-gray-500">
                            + {c.optionName}
                            {Number(c.price) > 0 && <span className="text-orange-500 ml-1">(+R$ {Number(c.price).toFixed(2)})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-orange-500 font-bold text-sm mt-1">
                      R$ {((Number(item.product.salePrice) + (item.complements || []).reduce((s, c) => s + Number(c.price) * c.quantity, 0)) * item.quantity).toFixed(2)}
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

              {/* ─── Order bump (upsell antes de finalizar) ─── */}
              {cart.length > 0 && orderBumpProducts.length > 0 && (
                <div className="pt-3 mt-1 border-t border-dashed border-gray-200">
                  <p className="text-sm font-black text-gray-900 mb-2.5 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-orange-500" /> Que tal adicionar?
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {orderBumpProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="shrink-0 w-32 text-left bg-white border border-gray-200 rounded-2xl p-2.5 hover:border-orange-400 hover:shadow-md active:scale-95 transition"
                      >
                        <div className="w-full aspect-square rounded-xl bg-gray-100 overflow-hidden mb-2 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover"
                              style={{ transform: `scale(${(p.imageZoom ?? 100) / 100})`, transformOrigin: "center center" }} />
                          ) : (
                            <span className="text-2xl">🍽️</span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-900 leading-tight line-clamp-2 mb-1 min-h-[2rem]">{p.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-orange-500 font-black text-xs">R$ {productMinPrice(p).toFixed(2)}</span>
                          <span className="bg-[var(--color-primary)] text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                            <Plus size={14} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-5 border-t border-gray-100">
              <div className="flex justify-between text-lg font-black text-gray-900 mb-4">
                <span>Total</span>
                <span className="text-orange-500">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                disabled={cart.length === 0}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition"
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
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]">
            <div className="overflow-y-auto flex-1 p-6">
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
              <span className="text-sm text-gray-500 shrink-0">Sabores:</span>
              {[1, 2, 3, 4].filter((n) => n <= Math.max(1, globalMaxFlavors)).map((n) => (
                <button key={n} onClick={() => changeFlavorParts(n)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${flavorParts === n ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {n === 1 ? "1 sab." : n === 2 ? "Meio" : n === 3 ? "3 sab." : "4 sab."}
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
                const fraction = flavorParts === 1 ? "inteiro" : flavorParts === 2 ? "1/2" : flavorParts === 3 ? "1/3" : "1/4";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-400 w-8 text-center bg-gray-100 rounded-lg py-1 shrink-0">{fraction}</span>
                    <select
                      value={flavorSlots[i]?.id || ""}
                      onChange={(e) => setFlavorSlot(i, products.find((p) => p.id === e.target.value) || null)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
                    >
                      <option value="">— Sabor {i + 1} —</option>
                      {products
                        .filter((p) => !flavorFilter || p.name.toLowerCase().includes(flavorFilter.toLowerCase()))
                        .filter((p) => !flavorSlots.some((s, si) => si !== i && s?.id === p.id))
                        .map((p) => (
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
            </div>{/* fim scroll area */}
            <div className="flex gap-3 p-6 pt-0 shrink-0 border-t border-gray-100">
              <button onClick={() => setShowFlavorModal(false)} className="flex-1 border border-gray-200 hover:bg-gray-50 transition py-3 rounded-xl font-semibold text-sm text-gray-600">Cancelar</button>
              <button onClick={confirmFlavors} className="flex-1 bg-[var(--color-primary)] hover:opacity-90 transition py-3 rounded-xl font-bold text-sm text-white">Adicionar</button>
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

            <label className="flex items-start gap-2.5 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.marketingOptIn}
                onChange={(e) => setForm((f) => ({ ...f, marketingOptIn: e.target.checked }))}
                className="w-4 h-4 mt-0.5 accent-[var(--color-primary)] shrink-0"
              />
              <span className="text-xs text-gray-500 leading-snug">
                Quero receber novidades e promoções no WhatsApp
              </span>
            </label>

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

            {/* QR Recovery promo banner */}
            {qrPromo && (
              <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎁</span>
                    <div>
                      <div className="font-bold text-green-800 text-sm">{qrPromo.campaignName}</div>
                      <div className="text-green-700 text-xs">
                        {qrPromo.discountType === "PERCENTUAL"
                          ? `${qrPromo.discountValue}% de desconto`
                          : `R$ ${qrPromo.discountValue.toFixed(2).replace(".", ",")} de desconto`}
                        {qrPromo.minimumOrder > 0 && ` • pedido mín. R$ ${qrPromo.minimumOrder.toFixed(2).replace(".", ",")}`}
                      </div>
                    </div>
                  </div>
                  {!qrPromoApplied ? (
                    <button
                      onClick={() => {
                        if (cartTotal < qrPromo.minimumOrder) {
                          toast.error(`Pedido mínimo de R$ ${qrPromo.minimumOrder.toFixed(2)} para usar este cupom`);
                          return;
                        }
                        setQrPromoApplied(true);
                        toast.success("Desconto QR aplicado!");
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition flex-shrink-0"
                    >
                      Aplicar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-green-700 text-xs font-bold">Aplicado</span>
                      <button onClick={() => setQrPromoApplied(false)} className="text-gray-400 hover:text-gray-600 ml-1"><X size={14} /></button>
                    </div>
                  )}
                </div>
                {qrPromoApplied && qrPromoDiscount > 0 && (
                  <div className="mt-2 text-green-700 text-xs font-medium">
                    Economia: <span className="font-bold">R$ {qrPromoDiscount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </div>
            )}
            {qrPromoMsg && !qrPromo && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm bg-red-50 border border-red-200 text-red-600">
                <X size={14} /> {qrPromoMsg}
              </div>
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

            {!isTotem && (
              <div className="grid grid-cols-3 gap-2">
                  {(["DINE_IN", "DELIVERY", "PICKUP"] as const).map((type) => (
                    <button key={type} onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                      className={`py-3 rounded-xl font-bold transition text-sm ${form.orderType === type ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {type === "DINE_IN" ? "Mesa" : type === "DELIVERY" ? "Entrega" : "Retirada"}
                    </button>
                  ))}
              </div>
            )}
            {form.orderType === "DINE_IN" && isTotem && (
              <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-700 text-sm font-bold flex items-center gap-2">
                <MapPin size={14} className="text-gray-400" /> Mesa {tableNumber}
              </div>
            )}
            {form.orderType === "DINE_IN" && !isTotem && (
              <input
                placeholder="Numero da mesa *"
                value={tableNumber ?? ""}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                inputMode="numeric"
              />
            )}
            {form.orderType === "DELIVERY" && (
              <div className="space-y-2">
                {/* Rua com autocomplete Nominatim */}
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      placeholder="Rua / Av. *"
                      value={form.street}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({ ...f, street: v }));
                        if (streetDebounce.current) clearTimeout(streetDebounce.current);
                        streetDebounce.current = setTimeout(() => searchStreet(v), 500);
                      }}
                      onBlur={() => setTimeout(() => setStreetSuggestions([]), 200)}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                      autoComplete="off"
                    />
                    {streetLoading && (
                      <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                    )}
                    {streetSuggestions.length > 0 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                      >
                        {streetSuggestions.map((item, idx) => {
                          const addr = item.address;
                          const road = addr.road ?? addr.pedestrian ?? '';
                          const city = addr.city ?? addr.town ?? addr.village ?? '';
                          const state = (addr['ISO3166-2-lvl4'] ?? '').slice(-2);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onMouseDown={() => selectStreetSuggestion(item)}
                              className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0 transition"
                            >
                              <div className="text-sm font-semibold text-gray-800 truncate">{road}</div>
                              <div className="text-xs text-gray-400 truncate">{city}{state ? ` — ${state}` : ''}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                    onChange={(e) => {
                      const nb = e.target.value;
                      setForm((f) => ({ ...f, neighborhood: nb }));
                      const zone = deliveryZones.find(z => z.neighborhood?.toLowerCase().trim() === nb.toLowerCase().trim()) ?? null;
                      setSelectedZone(zone ? { id: zone.id, clientFee: zone.clientFee } : null);
                    }}
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
                <div className="flex gap-2">
                  <input
                    placeholder="Cidade *"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                  />
                  <div className="relative w-24 flex-shrink-0">
                    <input
                      placeholder="CEP"
                      value={form.zipcode}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                        const fmt = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v;
                        setForm((f) => ({ ...f, zipcode: fmt }));
                        if (v.length === 8) fetchByCep(v);
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-gray-900 outline-none focus:border-primary text-sm"
                      inputMode="numeric"
                      maxLength={9}
                    />
                    {cepLoading && (
                      <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
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
              {qrPromoApplied && qrPromoDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">🎁 {qrPromo?.campaignName ?? "Cupom QR"}</span>
                  <span>- R$ {qrPromoDiscount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              {form.orderType === "DELIVERY" && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1"><MapPin size={11} /> Taxa de entrega</span>
                  <span>
                    {selectedZone
                      ? `R$ ${selectedZone.clientFee.toFixed(2).replace(".", ",")}`
                      : form.neighborhood
                        ? "Bairro sem cobertura"
                        : "Informe o bairro"}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span className="text-orange-500">R$ {(finalCartTotal + (form.orderType === "DELIVERY" ? (selectedZone?.clientFee ?? 0) : 0)).toFixed(2)}</span>
              </div>
            </div>

            </div>{/* fim scroll area */}

            {/* Botão fixo no rodapé do modal */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100">
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base transition"
              >
                {submitting ? "Enviando..." : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modal de vídeo do produto ──────────────────────────────────────── */}
      {videoProduct && (
        <MenuVideoModal product={videoProduct} onClose={() => setVideoProduct(null)} />
      )}
    </div>
  );
}

/** Modal de vídeo para o cardápio — desktop: modal | mobile: fullscreen overlay */
function MenuVideoModal({ product, onClose }: { product: { name: string; videoUrl?: string | null }; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    if (!isMobile || !videoRef.current) return;
    const el = videoRef.current as any;
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.webkitEnterFullscreen;
    if (req) req.call(el).catch(() => {});
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Vídeo do produto</p>
            <h3 className="font-bold text-white text-lg truncate">{product.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition ml-4 shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-2 pb-8">
          <video
            ref={videoRef}
            src={product.videoUrl ?? ""}
            controls
            autoPlay
            playsInline
            className="w-full max-h-full rounded-2xl object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Vídeo do produto</p>
            <h3 className="font-bold text-gray-900 text-xl">{product.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-3">
          <video
            ref={videoRef}
            src={product.videoUrl ?? ""}
            controls
            autoPlay
            className="w-full max-h-[65vh] rounded-2xl bg-black object-contain"
          />
        </div>
      </div>
    </div>
  );
}
