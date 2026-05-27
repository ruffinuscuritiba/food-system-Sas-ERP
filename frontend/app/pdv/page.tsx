"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/services/api";

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
  EyeOff,
  Pencil,
} from "lucide-react";

interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; description?: string;
  salePrice?: number; costPrice?: number; imageUrl?: string;
  categoryId?: string; isActive: boolean;
}

export default function PDVPage() {
  const [categories, setCategories]           = useState<Category[]>([]);
  const [products, setProducts]               = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch]                   = useState("");
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/categories"),
      api.get("/products"),
    ]).then(([catRes, prodRes]) => {
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
              href="/menu"
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

            <TopButton
              icon={<Trash2 size={18} />}
              title="Limpar"
              subtitle="Conta"
            />

            <button className="h-[54px] px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3 font-semibold relative">
              <ShoppingBag size={20} />
              Carrinho

              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-xs flex items-center justify-center">
                0
              </div>
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

            {/* HERO banner — shows active category name */}
            <div className="relative h-[160px] w-full rounded-[32px] overflow-hidden mb-6 bg-gradient-to-br from-blue-900 to-slate-900">
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #3b82f6 0%, transparent 60%)" }} />
              <div className="relative z-10 p-8 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-black shadow-lg">
                  🍽️
                </div>
                <div>
                  <h1 className="text-2xl xl:text-3xl font-black leading-tight">
                    {activeCategoryName}
                  </h1>
                  <p className="text-zinc-400 text-sm mt-1">
                    {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""} disponível{filteredProducts.length !== 1 ? "is" : ""}
                  </p>
                </div>
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
                        <IconBtn icon={<Pencil size={16} />} />
                        <IconBtn icon={<EyeOff size={16} />} />
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
                      <button className="mt-4 h-[50px] px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 transition text-base font-bold">
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
            <span>05/03/2026</span>
            <span>13:27</span>
          </div>

        </footer>

      </main>

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

function IconBtn({ icon }: { icon: any }) {
  return (
    <button className="w-12 h-12 rounded-xl border border-[#1d2336] flex items-center justify-center hover:bg-[#151c2d] transition">
      {icon}
    </button>
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