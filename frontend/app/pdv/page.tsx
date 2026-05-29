"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { PaymentModal } from "@/components/pdv/PaymentModal";
import { PizzaBuilder } from "@/components/pdv/PizzaBuilder";
import { OrderDetailsForm, OrderDetails } from "@/components/shared/OrderDetailsForm";

type PdvOrderDetails = OrderDetails;
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  UtensilsCrossed,
  DollarSign,
  Package,
  Tags,
  Pizza,
  Boxes,
  FlaskConical,
  BookOpen,
  Sparkles,
  Plug,
  Palette,
  QrCode,
  LogOut,
  Search,
  ArrowLeftRight,
  Receipt,
  Trash2,
  ShoppingBag,
  Eye,
  EyeOff,
  X,
} from "lucide-react";


interface Category { id: string; name: string; categoryType?: string; }
interface ProductSize { size: string; price: number; }
interface Product {
  id: string; name: string; description?: string;
  salePrice?: number; costPrice?: number; imageUrl?: string;
  videoUrl?: string; hasVideo?: boolean;
  categoryId?: string; isActive: boolean;
  sizes?: ProductSize[];
  orderProductId?: string;
  notes?: string;
}

interface CartItem { product: Product; qty: number; }

const PIZZA_SIZE_ORDER: Record<string, number> = {
  BIG: 0,
  FAMILIA: 1,
  FAMÍLIA: 1,
  GRANDE: 2,
  MEDIA: 3,
  MÉDIA: 3,
  PEQUENA: 4,
};

function getPizzaSizeOrder(size: string) {
  const normalized = size.toUpperCase();
  return PIZZA_SIZE_ORDER[normalized] ?? 99;
}

// ── Pizza deduplication ────────────────────────────────────────────────────────
// "CALABRESA (Pequena 4 fatias)" + "CALABRESA (Média 6 fatias)" → 1 card "CALABRESA"

// Maps the text found inside parens or as suffix → Prisma enum key
const SIZE_LABEL_TO_KEY: Record<string, string> = {
  "pequena":      "PEQUENA",
  "média":        "MEDIA",
  "media":        "MEDIA",
  "grande":       "GRANDE",
  "família":      "FAMILIA",
  "familia":      "FAMILIA",
  "big":          "BIG",
  "extra grande": "EXTRA_GRANDE",
  "extra_grande": "EXTRA_GRANDE",
};

/**
 * Returns the base name and the size enum key for a product.
 *
 * Handles two formats:
 *   A) "CALABRESA (Pequena 4 fatias)"  → baseName="CALABRESA", sizeKey="PEQUENA"
 *   B) "Calabresa Média"               → baseName="Calabresa", sizeKey="MEDIA"
 *   C) "Portuguesa"                    → baseName="Portuguesa", sizeKey=null (no change)
 */
function parseProductName(name: string): { baseName: string; sizeKey: string | null } {
  // Format A: anything in parentheses at the end
  const parenMatch = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const base = parenMatch[1].trim();
    const content = parenMatch[2].trim().toLowerCase();
    if (base) {
      // Try to detect size from paren content (first 1 or 2 words)
      const w1 = content.split(/\s+/)[0];
      const w2 = content.split(/\s+/).slice(0, 2).join(" ");
      const sizeKey = SIZE_LABEL_TO_KEY[w2] ?? SIZE_LABEL_TO_KEY[w1] ?? null;
      return { baseName: base, sizeKey };
    }
  }

  // Format B: known size label as bare suffix
  for (const [label, sizeKey] of Object.entries(SIZE_LABEL_TO_KEY)) {
    // skip multi-word entries on the first pass (checked below)
    if (label.includes(" ")) continue;
    const re = new RegExp(`[\\s\\-–]+(${label})\\s*$`, "i");
    if (re.test(name)) {
      return { baseName: name.replace(re, "").trim(), sizeKey };
    }
  }
  // multi-word suffixes (Extra Grande)
  for (const [label, sizeKey] of Object.entries(SIZE_LABEL_TO_KEY)) {
    if (!label.includes(" ")) continue;
    const re = new RegExp(`[\\s\\-–]+(${label})\\s*$`, "i");
    if (re.test(name)) {
      return { baseName: name.replace(re, "").trim(), sizeKey };
    }
  }

  return { baseName: name, sizeKey: null };
}

/**
 * Groups product variants by their base name and returns one merged Product per group.
 * Safe no-op for products without size in their name.
 */
function buildDedupedPizzaProducts(prods: Product[]): Product[] {
  type Group = {
    displayName: string;
    firstWithImage: Product | null;
    firstDesc: string | undefined;
    variants: { sizeKey: string | null; product: Product }[];
  };
  const map = new Map<string, Group>();

  for (const p of prods) {
    const { baseName, sizeKey } = parseProductName(p.name);
    const key = baseName.toLowerCase();
    if (!map.has(key)) map.set(key, { displayName: baseName, firstWithImage: null, firstDesc: undefined, variants: [] });
    const g = map.get(key)!;
    g.variants.push({ sizeKey, product: p });
    if (!g.firstWithImage && p.imageUrl) g.firstWithImage = p;
    if (!g.firstDesc && p.description)  g.firstDesc = p.description;
  }

  return Array.from(map.values()).map(g => {
    const first = g.variants[0].product;
    const seen = new Set<string>();
    const mergedSizes: ProductSize[] = [];

    for (const { sizeKey, product: p } of g.variants) {
      // Prefer sizes[] on the product (most accurate source)
      if (p.sizes && p.sizes.length > 0) {
        for (const s of p.sizes) {
          if (!seen.has(s.size)) {
            seen.add(s.size);
            mergedSizes.push({ size: s.size, price: Number(s.price) });
          }
        }
      } else if (sizeKey && !seen.has(sizeKey)) {
        // Fall back: infer size from name, use salePrice as price
        seen.add(sizeKey);
        mergedSizes.push({ size: sizeKey, price: Number(p.salePrice) || 0 });
      }
    }

    mergedSizes.sort((a, b) => getPizzaSizeOrder(a.size) - getPizzaSizeOrder(b.size));

    const minPrice = mergedSizes.length > 0
      ? Math.min(...mergedSizes.map(s => s.price))
      : Number(first.salePrice) || 0;

    return {
      ...first,
      name:        g.displayName,
      description: g.firstDesc,
      imageUrl:    g.firstWithImage?.imageUrl ?? first.imageUrl,
      salePrice:   minPrice,
      sizes:       mergedSizes.length > 0 ? mergedSizes : (first.sizes ?? []),
    } as Product;
  });
}

export default function PDVPage() {
  const [categories, setCategories]             = useState<Category[]>([]);
  const [products, setProducts]                 = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch]                     = useState("");
  const [loading, setLoading]                   = useState(true);
  const [videoProduct, setVideoProduct]         = useState<Product | null>(null);
  const [cart, setCart]                         = useState<CartItem[]>([]);
  const [showCart, setShowCart]                 = useState(false);
  const [showPayment, setShowPayment]           = useState(false);
  const [pizzaProduct, setPizzaProduct]         = useState<Product | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [pdvOrderDetails, setPdvOrderDetails] = useState<PdvOrderDetails>({
    orderType: "DINE_IN",
    tableNumber: "",
    customerName: "",
    customerPhone: "",
    address: "",
    addressNumber: "",
    complement: "",
    bairro: "",
    cidade: "",
    cep: "",
  });
  const [companyId, setCompanyId]               = useState<string>("");
  const [now, setNow]                           = useState(new Date());
  const [pizzaCategories, setPizzaCategories]   = useState<Set<string>>(new Set());
  const [pizzaSizeConfigs, setPizzaSizeConfigs] = useState<Record<string, { maxFlavors: number }>>({});

  // Trocar Mesa
  const [showTrocarMesa, setShowTrocarMesa]     = useState(false);
  const [tables, setTables]                     = useState<any[]>([]);
  const [loadingTables, setLoadingTables]       = useState(false);

  // Criar Cupom
  const [showCriarCupom, setShowCriarCupom]     = useState(false);
  const [cupomForm, setCupomForm]               = useState({
    code: "", type: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING",
    value: "", usageLimit: "", expiresAt: "",
  });
  const [cupomSaving, setCupomSaving]           = useState(false);
  const [cupomCreated, setCupomCreated]         = useState<string | null>(null);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.companyId) {
        setCompanyId(user.companyId);
        // Fetch pizza size configs for dynamic maxFlavors
        fetch(`/api/pizza-size-configs/public?companyId=${user.companyId}`)
          .then(r => r.ok ? r.json() : [])
          .then((configs: any[]) => {
            const map: Record<string, { maxFlavors: number }> = {};
            if (Array.isArray(configs)) {
              configs.forEach(c => { map[c.size] = { maxFlavors: c.maxFlavors ?? 2 }; });
            }
            setPizzaSizeConfigs(map);
          })
          .catch(() => {});
      }
    } catch {}
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get("/categories"),
      api.get("/products"),
    ]).then(([catRes, prodRes]) => {
      const cats: Category[] = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(cats);
      const pizzaCatIds = new Set(
        cats.filter(c => c.name.toLowerCase().includes("pizza")).map(c => c.id)
      );
      setPizzaCategories(pizzaCatIds);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addToCart = useCallback((product: Product) => {
    // Pizza category → open builder for meio a meio
    if (product.categoryId && pizzaCategories.has(product.categoryId)) {
      setPizzaProduct(product);
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    toast.success(`${product.name} adicionado`, { duration: 1500, icon: "🛒" });
  }, [pizzaCategories]);

  const addPizzaToCart = useCallback((pizza: any) => {
    const pizzaItem: CartItem = {
      product: {
        id: `pizza-${Date.now()}`,
        name: pizza.name,
        salePrice: pizza.price,
        categoryId: pizza.categoryId,
        isActive: true,
        orderProductId: pizza.flavors?.[0]?.id,
        notes: [
          `Pizza ${pizza.sizeLabel || pizza.size}: ${pizza.name}`,
          pizza.border ? `Borda: ${pizza.border.name}` : "",
          pizza.notes || "",
        ].filter(Boolean).join(" | "),
      },
      qty: 1,
    };
    setCart(prev => [...prev, pizzaItem]);
    setPizzaProduct(null);
    toast.success(`${pizza.name} adicionada`, { duration: 1500, icon: "🍕" });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }, []);

  const clearCart = useCallback(() => { setCart([]); }, []);

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const cartTotal = cart.reduce((a, i) => a + (Number(i.product.salePrice) || 0) * i.qty, 0);
  const canProceedToPayment =
    cart.length > 0 &&
    (pdvOrderDetails.orderType === "PICKUP" ||
      (pdvOrderDetails.orderType === "DINE_IN" && Boolean(pdvOrderDetails.tableNumber?.trim())) ||
      (pdvOrderDetails.orderType === "DELIVERY" && Boolean((pdvOrderDetails.address ?? pdvOrderDetails.bairro)?.trim())));

  const filteredProducts = products.filter(p => {
    if (!p.isActive) return false;
    const matchCat = selectedCategory === "all" || p.categoryId === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const activeCategory = selectedCategory === "all"
    ? null
    : categories.find(c => c.id === selectedCategory) ?? null;

  const activeCategoryName    = activeCategory?.name ?? (selectedCategory === "all" ? "Todos os Produtos" : "Produtos");
  const activeIsBeverage      = activeCategory?.categoryType === "bebidas";
  const activeCategoryIsPizza = activeCategory != null && pizzaCategories.has(activeCategory.id);

  // Banner: first image of the first active product in the selected category
  const bannerImageUrl =
    products.find(
      p => p.isActive &&
           (selectedCategory === "all" || p.categoryId === selectedCategory) &&
           p.imageUrl,
    )?.imageUrl ??
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400";

  const fmt = (v?: number) => v != null
    ? `R$ ${Number(v).toFixed(2).replace(".", ",")}`
    : "—";

  // Returns the minimum price of a product (lowest size price or salePrice)
  function productMinPrice(product: Product): number {
    if (product.sizes && product.sizes.length > 0) {
      return Math.min(...product.sizes.map(s => Number(s.price)));
    }
    return Number(product.salePrice) || 0;
  }

  // Returns price label: "A partir de R$ X,XX" when multiple sizes, else "R$ X,XX"
  function productPriceLabel(product: Product): string {
    if (product.sizes && product.sizes.length > 1) {
      return `A partir de ${fmt(productMinPrice(product))}`;
    }
    return fmt(productMinPrice(product));
  }

  async function closePaidOrder(method: string, splits: { method: string; amount: string }[] | undefined, details: PdvOrderDetails) {
    if (cart.length === 0 || paymentSubmitting) return;

    const paymentMethod = splits?.[0]?.method || method;
    const serviceLabel =
      details.orderType === "DINE_IN"
        ? `Mesa ${details.tableNumber}`
        : details.orderType === "DELIVERY"
          ? `Entrega${details.address ? ` - ${details.address}` : ""}`
          : "Retirada";

    setPaymentSubmitting(true);
    try {
      const orderItems = cart.map(({ product, qty }) => ({
        productId: product.orderProductId || product.id,
        quantity: qty,
        notes: product.notes || "",
      }));

      // Validate all item IDs are real UUIDs/cuid before sending
      const invalidItem = orderItems.find(i => !i.productId || i.productId.startsWith("pizza-"));
      if (invalidItem) {
        toast.error("Item inválido no carrinho. Remova e adicione novamente.");
        return;
      }

      const splitNote = splits
        ? `Pgto dividido: ${splits.map(s => `${s.method} R$${s.amount}`).join(" + ")}`
        : "";

      // Build full delivery address string
      const fullAddress = details.orderType === "DELIVERY"
        ? [
            details.address,
            details.addressNumber,
            details.complement,
            details.bairro,
            details.cidade,
          ].filter(Boolean).join(", ")
        : "INTERNO";

      const orderRes = await api.post("/orders", {
        customerName: details.customerName || serviceLabel,
        customerPhone: details.customerPhone || "",
        deliveryAddress: fullAddress,
        orderType: details.orderType,
        paymentMethod,
        notes: [serviceLabel, splitNote].filter(Boolean).join(" | "),
        items: orderItems,
        subtotal: cartTotal,
        total: cartTotal,
        deliveryFee: 0,
      });

      if (orderRes.data?.id) {
        try {
          await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
        } catch (confirmErr: any) {
          // Order was created but confirmation failed — show warning but don't rollback
          const msg = confirmErr?.response?.data?.message || "Pedido criado mas não confirmado automaticamente.";
          toast(`⚠️ ${Array.isArray(msg) ? msg.join(", ") : msg}`, { duration: 5000 });
        }
      }

      toast.success(`Pedido fechado — ${serviceLabel}`, { duration: 3000 });
      clearCart();
      setShowPayment(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || "Erro ao fechar pedido";
      const detail = Array.isArray(message) ? message.join(" | ") : String(message);
      console.error("[PDV] closePaidOrder error:", error?.response?.data);
      toast.error(detail, { duration: 6000 });
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function openPayment() {
    if (!canProceedToPayment) {
      toast.error(
        pdvOrderDetails.orderType === "DINE_IN"
          ? "Informe o numero da mesa"
          : pdvOrderDetails.orderType === "DELIVERY"
            ? "Informe o endereco de entrega"
            : "Adicione itens ao carrinho",
      );
      return;
    }
    setShowCart(false);
    setShowPayment(true);
  }

  async function openTrocarMesa() {
    setShowTrocarMesa(true);
    setLoadingTables(true);
    try {
      const r = await api.get("/tables");
      setTables(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast.error("Erro ao carregar mesas");
    } finally {
      setLoadingTables(false);
    }
  }

  function trocarMesa(tableNumber: string) {
    setPdvOrderDetails(p => ({
      ...p,
      orderType: "DINE_IN",
      tableNumber,
      address: "", addressNumber: "", complement: "", bairro: "", cidade: "", cep: "",
    }));
    setShowTrocarMesa(false);
    toast.success(`Mesa ${tableNumber} selecionada`);
  }

  function gerarCodigoCupom() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  function openCriarCupom() {
    setCupomCreated(null);
    setCupomForm({ code: gerarCodigoCupom(), type: "PERCENTAGE", value: "", usageLimit: "", expiresAt: "" });
    setShowCriarCupom(true);
  }

  async function saveCupom() {
    if (!cupomForm.value || Number(cupomForm.value) <= 0) {
      toast.error("Informe o valor do desconto"); return;
    }
    if (!cupomForm.code.trim()) {
      toast.error("Informe o código do cupom"); return;
    }
    setCupomSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const payload: any = {
        companyId: user.companyId || companyId,
        code:      cupomForm.code.trim().toUpperCase(),
        type:      cupomForm.type,
        value:     Number(cupomForm.value),
        active:    true,
      };
      if (cupomForm.usageLimit) payload.usageLimit = Number(cupomForm.usageLimit);
      if (cupomForm.expiresAt)  payload.expiresAt  = cupomForm.expiresAt;
      await api.post("/coupons", payload);
      setCupomCreated(payload.code);
      toast.success(`Cupom ${payload.code} criado!`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erro ao criar cupom";
      toast.error(Array.isArray(msg) ? msg.join(" | ") : String(msg));
    } finally {
      setCupomSaving(false);
    }
  }

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">

      {/* SIDEBAR — hidden on mobile */}
      <aside className="hidden md:flex w-[240px] bg-[#050816] border-r border-[#161b2d] flex-col overflow-hidden">

        {/* LOGO */}
        <div className="h-[92px] shrink-0 border-b border-[#161b2d] flex items-center px-5 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black">
            F
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-bold leading-none">
                FoodSaaS-ERP
              </h1>
              <span className="text-[9px] font-mono text-zinc-600 bg-[#0b0f1b] border border-[#1d2336] px-1.5 py-0.5 rounded-md shrink-0 select-none">
                {process.env.NEXT_PUBLIC_COMMIT_SHA || "dev"}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              PDV / Caixa
            </p>
          </div>
        </div>

        {/* MENU */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">

            <MenuSection
              title=""
              items={[
                { icon: <LayoutDashboard size={18} />, label: "Dashboard", href: "/", green: true },
              ]}
            />

            <MenuSection
              title="OPERAÇÃO"
              items={[
                { icon: <ShoppingCart size={18} />,   label: "Pedidos",    href: "/orders" },
                { icon: <ChefHat size={18} />,        label: "Cozinha",    href: "/kitchen" },
                { icon: <UtensilsCrossed size={18} />, label: "Mesas",     href: "/tables" },
                { icon: <DollarSign size={18} />,     label: "PDV / Caixa", href: "/pdv", active: true },
              ]}
            />

            <MenuSection
              title="CARDÁPIO"
              items={[
                { icon: <Package size={18} />, label: "Produtos",        href: "/products" },
                { icon: <Tags size={18} />,    label: "Categorias",      href: "/categories" },
                { icon: <Pizza size={18} />,   label: "Bordas de Pizza", href: "/pizza-borders" },
              ]}
            />

            <MenuSection
              title="ESTOQUE"
              items={[
                { icon: <Boxes size={18} />,       label: "Movimentações", href: "/stock" },
                { icon: <FlaskConical size={18} />, label: "Ingredientes",  href: "/ingredients" },
                { icon: <BookOpen size={18} />,    label: "Receitas",       href: "/recipes" },
              ]}
            />

            <MenuSection
              title="IA"
              items={[
                { icon: <Sparkles size={18} />, label: "Cadastro por Imagem", href: "/cadastro-inteligente" },
              ]}
            />

            <MenuSection
              title="MARKETPLACE"
              items={[
                { icon: <Plug size={18} />, label: "Módulos de Integração", href: "/modulos" },
              ]}
            />

            <MenuSection
              title="CONFIGURAÇÕES"
              items={[
                { icon: <Palette size={18} />, label: "Tema / Visual",  href: "/theme" },
                { icon: <QrCode size={18} />,  label: "QR Code Mesas",  href: "/tables/qrcode" },
              ]}
            />

            <Link
              href={companyId ? `/menu/${companyId}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-[42px] rounded-2xl border border-green-700 text-green-400 flex items-center justify-between px-4 text-sm hover:bg-green-700/10 transition"
            >
              <span>Ver Cardápio Online</span>
              <span>›</span>
            </Link>

          </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-[#161b2d] p-5">
          <button className="flex items-center gap-3 text-zinc-300">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 flex flex-col">

        {/* HEADER */}
        <header className="shrink-0 border-b border-[#161b2d] flex items-center justify-between px-3 md:px-6 h-16 md:h-[92px] gap-2">

          {/* Search */}
          <div className="flex-1 max-w-xs md:max-w-[420px] h-10 md:h-[54px] bg-[#0c101d] border border-[#1d2336] rounded-2xl flex items-center px-3 md:px-5 gap-2 md:gap-4">
            <Search size={16} className="text-zinc-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-transparent outline-none w-full text-sm"
            />
          </div>

          {/* MESA indicator + actions */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">

            {/* Mesa indicator — shown when DINE_IN + table set */}
            {pdvOrderDetails.orderType === "DINE_IN" && pdvOrderDetails.tableNumber && (
              <div className="hidden sm:flex flex-col items-center justify-center h-10 md:h-[54px] px-3 md:px-4 rounded-2xl border border-[#1d2336] bg-[#0c101d] min-w-[72px]">
                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wide leading-none">MESA</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="font-black text-white text-base leading-none">{pdvOrderDetails.tableNumber}</span>
                </div>
              </div>
            )}

            {/* Trocar Mesa */}
            <button
              onClick={openTrocarMesa}
              title="Trocar mesa"
              className="h-10 md:h-[54px] px-3 md:px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex flex-col items-center justify-center gap-0 md:gap-0.5"
            >
              <ArrowLeftRight size={15} className="shrink-0" />
              <span className="hidden md:block text-[10px] font-bold leading-none">Trocar</span>
              <span className="hidden md:block text-[10px] leading-none">Mesa</span>
            </button>

            {/* Criar Cupom */}
            <button
              onClick={openCriarCupom}
              title="Criar cupom"
              className="h-10 md:h-[54px] px-3 md:px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex flex-col items-center justify-center gap-0 md:gap-0.5"
            >
              <Receipt size={15} className="shrink-0" />
              <span className="hidden md:block text-[10px] font-bold leading-none">Criar</span>
              <span className="hidden md:block text-[10px] leading-none">Cupom</span>
            </button>

            {/* Limpar Conta */}
            <button
              onClick={clearCart}
              title="Limpar conta"
              className="h-10 md:h-[54px] px-3 md:px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex flex-col items-center justify-center gap-0 md:gap-0.5"
            >
              <Trash2 size={15} className="shrink-0" />
              <span className="hidden md:block text-[10px] font-bold leading-none">Limpar</span>
              <span className="hidden md:block text-[10px] leading-none">Conta</span>
            </button>

            {/* Carrinho */}
            <button
              onClick={() => setShowCart(true)}
              className="h-10 md:h-[54px] px-3 md:px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex items-center gap-2 font-semibold relative"
            >
              <ShoppingBag size={18} />
              <span className="hidden md:block text-sm">Carrinho</span>
              {cartCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-500 text-xs flex items-center justify-center font-bold">
                  {cartCount}
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Mobile: categories horizontal scroll */}
        <div className="md:hidden shrink-0 flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide bg-[#050816] border-b border-[#161b2d]">
          {[{ id: "all", name: "Todos", categoryType: undefined }, ...categories].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white"
                  : "bg-[#0c101d] text-zinc-300"
              }`}
            >
              {(cat as any).categoryType === "bebidas" ? "Bebidas" : cat.name}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="flex-1 hidden md:grid grid-cols-[220px_1fr] overflow-hidden">

          {/* CATEGORY COLUMN — desktop only */}
          <aside className="w-full border-r border-[#161b2d] p-5 overflow-y-auto scrollbar-hide bg-[#050816]">
            <div className="space-y-4">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`w-full min-h-[64px] rounded-3xl text-center px-4 transition font-semibold text-sm ${
                  selectedCategory === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-[#0c101d] hover:bg-[#151c2d] text-zinc-300"
                }`}
              >
                Todos
              </button>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-full min-h-[64px] rounded-3xl bg-[#0c101d] animate-pulse" />
                ))
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full min-h-[64px] rounded-3xl text-center px-4 transition font-semibold text-sm ${
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white"
                        : "bg-[#0c101d] hover:bg-[#151c2d] text-zinc-300"
                    }`}
                  >
                    {cat.categoryType === "bebidas" ? "Bebidas" : cat.name}
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* PRODUCTS — desktop */}
          <section className="flex-1 min-w-0 overflow-y-auto scrollbar-hide p-6 bg-[#030712]">

            {/* HERO banner */}
            <div className="relative h-[220px] w-full rounded-[32px] overflow-hidden mb-6">
              <img
                src={bannerImageUrl}
                className="absolute inset-0 w-full h-full object-cover"
                alt="hero"
              />
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative z-10 p-10">
                <h1 className="text-3xl xl:text-5xl font-black mb-2 leading-tight break-words max-w-[700px]">
                  {activeCategoryName}
                </h1>
                <p className="text-base text-zinc-300">
                  {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""} disponível{filteredProducts.length !== 1 ? "is" : ""}
                </p>
              </div>
            </div>

            {/* PRODUCTS LIST / GRID */}
            {loading ? (
              <div className="space-y-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="min-h-[160px] w-full rounded-[32px] bg-[#0b0f1b] animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <span className="text-5xl mb-4">🍽️</span>
                <p className="font-semibold text-lg">Nenhum produto nesta categoria</p>
              </div>
            ) : activeIsBeverage ? (
              /* ── BEVERAGES GRID — desktop 5 cols, tablet 3 ── */
              <div className="grid grid-cols-3 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-[#0b0f1b] border border-[#161b2d] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-blue-600 transition group"
                    onClick={() => addToCart(product)}
                  >
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-[#161b2d] flex items-center justify-center text-4xl">🥤</div>
                    )}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-bold text-sm leading-tight line-clamp-2 flex-1">{product.name}</p>
                      <p className="text-blue-400 font-black text-base mt-2 leading-tight">{productPriceLabel(product)}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        className="mt-2 w-full py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-500 active:scale-95 transition text-xs font-bold"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── DEFAULT LIST ── */
              <div className="space-y-5">
                {buildDedupedPizzaProducts(filteredProducts).map((product) => (
                  <div
                    key={product.id}
                    className="min-h-[160px] w-full overflow-hidden rounded-[32px] bg-[#0b0f1b] border border-[#161b2d] flex items-center px-6"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-[120px] xl:w-[160px] h-[100px] xl:h-[130px] object-cover rounded-3xl shrink-0"
                      />
                    ) : (
                      <div className="w-[120px] xl:w-[160px] h-[100px] xl:h-[130px] rounded-3xl bg-[#161b2d] flex items-center justify-center shrink-0 text-4xl">
                        🍽️
                      </div>
                    )}

                    <div className="flex-1 px-5 xl:px-8 min-w-0 overflow-hidden">
                      <h2 className="text-xl xl:text-2xl font-bold mb-2 leading-tight break-words max-w-full">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="text-zinc-400 text-sm xl:text-base leading-relaxed break-words max-w-full line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex gap-3 mt-4">
                        <VideoEyeBtn product={product} onOpen={setVideoProduct} />
                      </div>
                    </div>

                    <div className="w-[160px] xl:w-[200px] shrink-0 flex flex-col items-end pl-4">
                      <span className={`font-black whitespace-nowrap text-right leading-tight ${product.sizes && product.sizes.length > 1 ? "text-lg xl:text-xl" : "text-2xl xl:text-3xl"}`}>
                        {productPriceLabel(product)}
                      </span>
                      {product.costPrice != null && (
                        <span className="text-zinc-600 text-xs mt-1">
                          Custo: {fmt(product.costPrice)}
                        </span>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-4 h-[50px] px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition text-base font-bold"
                      >
                        ADICIONAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </section>

        </div>

        {/* PRODUCTS — mobile only (full width list or beverages grid) */}
        <div className="md:hidden flex-1 overflow-y-auto scrollbar-hide bg-[#030712] px-3 py-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-[#0b0f1b] animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <span className="text-4xl mb-3">🍽️</span>
              <p className="text-sm font-semibold">Nenhum produto nesta categoria</p>
            </div>
          ) : activeIsBeverage ? (
            /* ── BEVERAGES GRID — mobile 2 cols ── */
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-[#0b0f1b] border border-[#161b2d] rounded-2xl overflow-hidden flex flex-col"
                  onClick={() => addToCart(product)}
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-[#161b2d] flex items-center justify-center text-3xl">🥤</div>
                  )}
                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="font-bold text-xs leading-tight line-clamp-2 flex-1">{product.name}</p>
                    <p className="text-blue-400 font-black text-xs mt-1.5 leading-tight">{productPriceLabel(product)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      className="mt-2 w-full py-1.5 rounded-xl bg-blue-600 active:scale-95 transition text-xs font-bold"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── DEFAULT LIST ── */
            <div className="space-y-3">
              {buildDedupedPizzaProducts(filteredProducts).map(product => (
                <div key={product.id} className="flex items-center gap-3 bg-[#0b0f1b] border border-[#161b2d] rounded-2xl p-3">
                  {product.imageUrl
                    ? <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                    : <div className="w-16 h-16 rounded-xl bg-[#161b2d] flex items-center justify-center text-2xl shrink-0">🍽️</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight">{product.name}</p>
                    {product.description && (
                      <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{product.description}</p>
                    )}
                    <p className="text-blue-400 font-black text-sm mt-1 leading-tight">{productPriceLabel(product)}</p>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="shrink-0 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER — hidden on mobile */}
        <footer className="hidden md:flex h-[58px] border-t border-[#161b2d] items-center justify-between px-6">

          <div className="flex items-center gap-3 text-zinc-400">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            Sistema Online
          </div>

          <div className="flex items-center gap-10 text-zinc-400">
            <span>Operador: Caixa 01</span>
            <span>{now.toLocaleDateString("pt-BR")}</span>
            <span>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

        </footer>

      </main>

      {/* CART DRAWER */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 hidden md:block" onClick={() => setShowCart(false)} />
          <aside className="w-full md:w-[380px] bg-[#050816] border-l border-[#161b2d] flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#161b2d]">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShoppingBag size={20} className="text-blue-400" /> Carrinho
              </h2>
              <button onClick={() => setShowCart(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 py-20">
                  <ShoppingBag size={48} className="mb-4 opacity-30" />
                  <p className="text-sm font-medium">Carrinho vazio</p>
                </div>
              ) : (
                cart.map(({ product, qty }) => (
                  <div key={product.id} className="bg-[#0b0f1b] rounded-2xl p-4 flex items-center gap-3">
                    {product.imageUrl
                      ? <img src={product.imageUrl} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      : <div className="w-14 h-14 rounded-xl bg-[#161b2d] flex items-center justify-center text-2xl shrink-0">🍽️</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{product.name}</p>
                      <p className="text-zinc-400 text-xs mt-0.5">{fmt(product.salePrice)} × {qty}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-blue-400">{fmt((Number(product.salePrice) || 0) * qty)}</span>
                      <button onClick={() => removeFromCart(product.id)} className="w-7 h-7 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-700/40 flex items-center justify-center transition">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-[#161b2d] p-5 space-y-3">
                <div className="rounded-2xl border border-[#1d2336] bg-[#0b0f1b] p-4">
                  <OrderDetailsForm
                    value={pdvOrderDetails}
                    onChange={setPdvOrderDetails}
                    compact
                  />
                </div>

                <div className="flex items-center justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-blue-400">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={openPayment}
                  disabled={!canProceedToPayment}
                  className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold text-sm"
                >
                  Finalizar Pedido →
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ─── TROCAR MESA MODAL ─────────────────────────────────── */}
      {showTrocarMesa && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#050816] border border-[#1d2336] rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#161b2d]">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <ArrowLeftRight size={20} className="text-blue-400" /> Trocar Mesa
                </h2>
                {pdvOrderDetails.tableNumber && (
                  <p className="text-zinc-400 text-sm mt-0.5">
                    Mesa atual: <span className="text-white font-bold">{pdvOrderDetails.tableNumber}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setShowTrocarMesa(false)} className="w-9 h-9 rounded-xl bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {/* Manual entry */}
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 font-bold uppercase mb-2">Digite o número da mesa</label>
                <div className="flex gap-2">
                  <input
                    id="trocar-mesa-input"
                    type="text"
                    placeholder="Ex: 12"
                    defaultValue={pdvOrderDetails.tableNumber}
                    className="flex-1 bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("trocar-mesa-input") as HTMLInputElement;
                      const v = input?.value?.trim();
                      if (!v) { toast.error("Digite o número da mesa"); return; }
                      trocarMesa(v);
                    }}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm transition"
                  >
                    Confirmar
                  </button>
                </div>
              </div>

              {/* Table list from API */}
              {loadingTables ? (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                  Carregando mesas…
                </div>
              ) : tables.length > 0 ? (
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Ou escolha uma mesa disponível</p>
                  <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                    {tables.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => trocarMesa(String(t.number))}
                        className={`py-3 rounded-xl border text-sm font-bold transition ${
                          String(t.number) === pdvOrderDetails.tableNumber
                            ? "bg-blue-600 border-blue-600 text-white"
                            : t.status === "FREE"
                              ? "bg-[#0c101d] border-green-700/40 text-green-400 hover:border-green-600"
                              : t.status === "OCCUPIED"
                                ? "bg-[#0c101d] border-red-700/40 text-red-400 hover:border-red-600"
                                : "bg-[#0c101d] border-yellow-700/40 text-yellow-400"
                        }`}
                        title={`Mesa ${t.number} — ${t.status}`}
                      >
                        {t.number}
                        <div className="text-[8px] mt-0.5 opacity-60">
                          {t.status === "FREE" ? "livre" : t.status === "OCCUPIED" ? "ocup." : "reserv."}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Livre</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Ocupada</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Reservada</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ─── CRIAR CUPOM MODAL ─────────────────────────────────── */}
      {showCriarCupom && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#050816] border border-[#1d2336] rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#161b2d]">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Receipt size={20} className="text-blue-400" /> Criar Cupom
              </h2>
              <button onClick={() => { setShowCriarCupom(false); setCupomCreated(null); }} className="w-9 h-9 rounded-xl bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {cupomCreated ? (
                /* ── SUCCESS STATE ── */
                <div className="text-center py-4 space-y-4">
                  <div className="text-5xl">🎉</div>
                  <p className="text-white font-bold text-lg">Cupom criado com sucesso!</p>
                  <div className="bg-[#0c101d] border border-blue-600/40 rounded-2xl px-6 py-4">
                    <p className="text-xs text-zinc-500 mb-1">Código do cupom</p>
                    <p className="text-3xl font-black text-blue-400 tracking-widest">{cupomCreated}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(cupomCreated); toast.success("Código copiado!"); }}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm transition"
                  >
                    Copiar código
                  </button>
                  <button
                    onClick={() => { setCupomCreated(null); setCupomForm({ code: gerarCodigoCupom(), type: "PERCENTAGE", value: "", usageLimit: "", expiresAt: "" }); }}
                    className="w-full py-3 rounded-xl bg-[#0c101d] border border-[#1d2336] text-zinc-400 hover:text-white font-semibold text-sm transition"
                  >
                    Criar outro cupom
                  </button>
                </div>
              ) : (
                /* ── FORM STATE ── */
                <div className="space-y-4">
                  {/* Code */}
                  <div>
                    <label className="block text-xs text-zinc-500 font-bold uppercase mb-1.5">Código do cupom</label>
                    <div className="flex gap-2">
                      <input
                        value={cupomForm.code}
                        onChange={e => setCupomForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                        className="flex-1 bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-sm font-mono font-bold uppercase outline-none focus:border-blue-500 tracking-widest"
                        placeholder="PROMO10"
                      />
                      <button
                        onClick={() => setCupomForm(f => ({ ...f, code: gerarCodigoCupom() }))}
                        title="Gerar código aleatório"
                        className="px-3 py-3 rounded-xl bg-[#0c101d] border border-[#1d2336] text-zinc-400 hover:text-white transition text-xs font-bold"
                      >
                        ↻
                      </button>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs text-zinc-500 font-bold uppercase mb-1.5">Tipo de desconto</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: "PERCENTAGE",  label: "%",            desc: "Percentual" },
                        { v: "FIXED_AMOUNT",label: "R$",           desc: "Valor fixo" },
                        { v: "FREE_SHIPPING",label: "🚚",          desc: "Frete grátis" },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setCupomForm(f => ({ ...f, type: opt.v }))}
                          className={`py-2.5 rounded-xl border text-xs font-semibold transition flex flex-col items-center gap-0.5 ${
                            cupomForm.type === opt.v
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-[#0c101d] border-[#1d2336] text-zinc-400 hover:border-blue-600/40"
                          }`}
                        >
                          <span className="text-base">{opt.label}</span>
                          <span className="text-[9px]">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Value */}
                  {cupomForm.type !== "FREE_SHIPPING" && (
                    <div>
                      <label className="block text-xs text-zinc-500 font-bold uppercase mb-1.5">
                        {cupomForm.type === "PERCENTAGE" ? "Percentual de desconto (%)" : "Valor do desconto (R$)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={cupomForm.type === "PERCENTAGE" ? 100 : undefined}
                        value={cupomForm.value}
                        onChange={e => setCupomForm(f => ({ ...f, value: e.target.value }))}
                        placeholder={cupomForm.type === "PERCENTAGE" ? "Ex: 10" : "Ex: 5.00"}
                        className="w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Optional: usage limit + expiry */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 font-bold uppercase mb-1.5">Limite de usos</label>
                      <input
                        type="number"
                        min={1}
                        value={cupomForm.usageLimit}
                        onChange={e => setCupomForm(f => ({ ...f, usageLimit: e.target.value }))}
                        placeholder="Ilimitado"
                        className="w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 font-bold uppercase mb-1.5">Validade</label>
                      <input
                        type="date"
                        value={cupomForm.expiresAt}
                        onChange={e => setCupomForm(f => ({ ...f, expiresAt: e.target.value }))}
                        className="w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={saveCupom}
                    disabled={cupomSaving}
                    className="w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-black text-sm transition mt-2"
                  >
                    {cupomSaving ? "Criando…" : "Criar Cupom"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      <PaymentModal
        open={showPayment}
        total={cartTotal}
        onClose={() => !paymentSubmitting && setShowPayment(false)}
        orderDetails={pdvOrderDetails}
        onConfirm={(method, _received, splits, details) => closePaidOrder(method, splits, details)}
      />

      {/* PIZZA BUILDER MODAL */}
      {pizzaProduct && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#050816] border border-[#1d2336] rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#161b2d]">
              <h2 className="font-black text-lg">🍕 Monte sua Pizza — {pizzaProduct.name}</h2>
              <button onClick={() => setPizzaProduct(null)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <PizzaBuilder
                flavors={filteredProducts
                  .filter(p => p.categoryId && pizzaCategories.has(p.categoryId || ""))
                  .map(p => ({ id: p.id, name: p.name, price: Number(p.salePrice) || 0 }))}
                borders={[]}
                sizes={pizzaProduct.sizes
                  ?.slice()
                  .sort((a, b) => getPizzaSizeOrder(a.size) - getPizzaSizeOrder(b.size))
                  .map(s => ({
                    size: s.size,
                    label: s.size.charAt(0).toUpperCase() + s.size.slice(1).toLowerCase().replace("_", " "),
                    price: Number(s.price) || 0,
                  }))}
                sizeConfigs={pizzaSizeConfigs}
                onAdd={addPizzaToCart}
              />
            </div>
          </div>
        </div>
      )}

      {/* VIDEO MODAL */}
      {videoProduct && (
        <VideoModal product={videoProduct} onClose={() => setVideoProduct(null)} />
      )}

    </div>
  );
}

function TopButton({
  icon,
  title,
  subtitle,
}: any) {
  return (
    <button className="h-[54px] px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3">
      {icon}

      <div className="text-left leading-none">
        <div className="font-semibold">{title}</div>
        <div className="text-xs opacity-80 mt-1">{subtitle}</div>
      </div>
    </button>
  );
}

/** Botão de olho: ativo se o produto tem vídeo, desabilitado caso contrário */
function VideoEyeBtn({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const active = !!(product.videoUrl);
  return (
    <button
      onClick={() => active && onOpen(product)}
      title={active ? "Visualizar vídeo do produto" : "Sem vídeo cadastrado"}
      disabled={!active}
      className={`
        w-12 h-12 rounded-xl border flex items-center justify-center transition
        ${active
          ? "border-blue-600/40 text-blue-400 hover:bg-blue-600/20 cursor-pointer"
          : "border-[#1d2336] text-zinc-600 opacity-40 cursor-not-allowed"
        }
      `}
    >
      {active ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  );
}

/** Modal de vídeo — desktop: modal centralizado | mobile: fullscreen estilo reels */
function VideoModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Tentar fullscreen nativo em iOS/Android
  useEffect(() => {
    if (!isMobile || !videoRef.current) return;
    const el = videoRef.current as any;
    const req =
      el.requestFullscreen ??
      el.webkitRequestFullscreen ??
      el.webkitEnterFullscreen;
    if (req) req.call(el).catch(() => {});
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400 mb-0.5">Visualizando</p>
            <h3 className="font-bold text-white text-lg truncate">{product.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition ml-4 shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        {/* Video fullscreen */}
        <div className="flex-1 flex items-center justify-center px-2 pb-8">
          <video
            ref={videoRef}
            src={product.videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full max-h-full rounded-2xl object-contain"
          />
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0b0f1b] rounded-3xl overflow-hidden w-full max-w-3xl shadow-2xl border border-[#1d2336]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#161b2d]">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Vídeo do produto</p>
            <h3 className="font-bold text-white text-xl">{product.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>
        {/* Video */}
        <div className="p-3">
          <video
            ref={videoRef}
            src={product.videoUrl}
            controls
            autoPlay
            className="w-full max-h-[70vh] rounded-2xl bg-black object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function MenuSection({
  title,
  items,
}: any) {
  return (
    <div>

      {title && (
        <div className="text-[10px] font-bold tracking-[2px] text-zinc-500 mb-1.5 px-1">
          {title}
        </div>
      )}

      <div className="space-y-1">

        {items.map((item: any) => (
          <Link
            key={item.label}
            href={item.href ?? "#"}
            className={`w-full h-[40px] rounded-xl px-3 flex items-center gap-2.5 text-sm transition ${
              item.green
                ? "bg-green-700"
                : item.active
                ? "bg-blue-600"
                : "hover:bg-[#151c2d]"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

      </div>

    </div>
  );
}
