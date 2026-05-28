"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { PaymentModal } from "@/components/pdv/PaymentModal";
import { PizzaBuilder } from "@/components/pdv/PizzaBuilder";
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

interface Category { id: string; name: string; }
interface ProductSize { size: string; price: number; }
interface Product {
  id: string; name: string; description?: string;
  salePrice?: number; costPrice?: number; imageUrl?: string;
  videoUrl?: string; hasVideo?: boolean;
  categoryId?: string; isActive: boolean;
  sizes?: ProductSize[];
}

interface CartItem { product: Product; qty: number; }

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
  const [companyId, setCompanyId]               = useState<string>("");
  const [now, setNow]                           = useState(new Date());
  const [pizzaCategories, setPizzaCategories]   = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.companyId) setCompanyId(user.companyId);
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

  const filteredProducts = products.filter(p => {
    if (!p.isActive) return false;
    const matchCat = selectedCategory === "all" || p.categoryId === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const activeCategoryName = selectedCategory === "all"
    ? "Todos os Produtos"
    : categories.find(c => c.id === selectedCategory)?.name ?? "Produtos";

  const fmt = (v?: number) => v != null
    ? `R$ ${Number(v).toFixed(2).replace(".", ",")}`
    : "—";

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-[240px] bg-[#050816] border-r border-[#161b2d] flex flex-col overflow-hidden">

        {/* LOGO */}
        <div className="h-[92px] shrink-0 border-b border-[#161b2d] flex items-center px-5 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black">
            F
          </div>

          <div>
            <h1 className="text-[20px] font-bold leading-none">
              FoodSaaS-ERP - PDV
            </h1>

            <p className="text-zinc-400 text-sm mt-1">
              Sistema de Caixa
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
        <header className="h-[92px] border-b border-[#161b2d] flex items-center justify-between px-6">

          <div className="flex items-center gap-5">

            {/* SEARCH */}
            <div className="w-[420px] h-[54px] bg-[#0c101d] border border-[#1d2336] rounded-2xl flex items-center px-5 gap-4">
              <Search size={18} className="text-zinc-400" />

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto, código ou cliente..."
                className="bg-transparent outline-none w-full text-sm"
              />
            </div>

            {/* MESA */}
            <div className="w-[100px] h-[54px] rounded-2xl bg-[#0c101d] border border-[#1d2336] flex items-center justify-center gap-3">

              <div className="w-3 h-3 rounded-full bg-green-500" />

              <div className="leading-none">
                <div className="text-[10px] text-zinc-400 uppercase">
                  Mesa
                </div>

                <div className="font-bold text-2xl">
                  29
                </div>
              </div>

            </div>

          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-3">

            <TopButton
              icon={<ArrowLeftRight size={18} />}
              title="Trocar"
              subtitle="Mesa"
            />

            <TopButton
              icon={<Receipt size={18} />}
              title="Criar"
              subtitle="Cupom"
            />

            <button
              onClick={clearCart}
              className="h-[54px] px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3"
            >
              <Trash2 size={18} />
              <div className="text-left leading-none">
                <div className="font-semibold">Limpar</div>
                <div className="text-xs opacity-80 mt-1">Conta</div>
              </div>
            </button>

            <button
              onClick={() => setShowCart(true)}
              className="h-[54px] px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3 font-semibold relative"
            >
              <ShoppingBag size={20} />
              Carrinho
              {cartCount > 0 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-xs flex items-center justify-center font-bold">
                  {cartCount}
                </div>
              )}
            </button>

          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 grid grid-cols-[220px_1fr] overflow-hidden">

          {/* CATEGORY COLUMN */}
          <aside className="w-full border-r border-[#161b2d] p-5 overflow-y-auto scrollbar-hide bg-[#050816]">
            <div className="space-y-4">

              {/* "Todos" button */}
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
                    {cat.name}
                  </button>
                ))
              )}

            </div>
          </aside>

          {/* PRODUCTS */}
          <section className="flex-1 min-w-0 overflow-y-auto scrollbar-hide p-6 bg-[#030712]">

            {/* HERO banner */}
            <div className="relative h-[220px] w-full rounded-[32px] overflow-hidden mb-6">
              <img
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400"
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

            {/* PRODUCTS LIST */}
            <div className="space-y-5">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="min-h-[160px] w-full rounded-[32px] bg-[#0b0f1b] animate-pulse" />
                ))
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                  <span className="text-5xl mb-4">🍽️</span>
                  <p className="font-semibold text-lg">Nenhum produto nesta categoria</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
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
                      <span className="text-2xl xl:text-3xl font-black whitespace-nowrap">
                        {fmt(product.salePrice)}
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
                ))
              )}
            </div>

          </section>

        </div>

        {/* FOOTER */}
        <footer className="h-[58px] border-t border-[#161b2d] flex items-center justify-between px-6">

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
          <div className="flex-1 bg-black/60" onClick={() => setShowCart(false)} />
          <aside className="w-[380px] bg-[#050816] border-l border-[#161b2d] flex flex-col h-full">
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
                <div className="flex items-center justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-blue-400">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={() => { setShowCart(false); setShowPayment(true); }}
                  className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-500 transition font-bold text-sm"
                >
                  Finalizar Pedido →
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* PAYMENT MODAL */}
      <PaymentModal
        open={showPayment}
        total={cartTotal}
        onClose={() => setShowPayment(false)}
        onConfirm={(method, received, splits) => {
          const fmtTotal = cartTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          if (splits) {
            toast.success(`Pedido fechado! Dividido em ${splits.length} formas`, { duration: 3000 });
          } else {
            toast.success(`Pedido fechado — ${method} ${fmtTotal}`, { duration: 3000 });
          }
          clearCart();
          setShowPayment(false);
        }}
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
                sizes={pizzaProduct.sizes?.map(s => ({
                  size: s.size,
                  label: s.size.charAt(0).toUpperCase() + s.size.slice(1).toLowerCase().replace("_", " "),
                  price: Number(s.price) || 0,
                }))}
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