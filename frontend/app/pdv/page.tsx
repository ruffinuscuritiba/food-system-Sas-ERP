"use client";

import Link from "next/link";

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

const categories = [
  "Entradas",
  "Hambúrgueres Clássico",
  "Hambúrgueres Gourmet",
  "Hambúrgueres Vegetarianos",
  "Hambúrgueres Kids",
  "Acompanhamentos",
  "Sobremesas",
  "Bebidas",
];

const products = [
  {
    name: "Picanha ao Fogo com Molho Chimichurri",
    description:
      "Suculento hambúrguer de picanha grelhado no ponto ideal, coberto com o irresistível molho chimichurri feito com especiarias frescas.",
    price: "34,90",
    old: "39,90",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
  },
  {
    name: "Black Angus Truffle",
    description:
      "Blend Black Angus 220g, queijo brie, rúcula, cebola roxa caramelizada e maionese de trufas no pão australiano.",
    price: "44,90",
    old: "49,90",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600",
  },
  {
    name: "Costela 12 Horas",
    description:
      "Hambúrguer de costela desfiada por 12h, queijo gouda defumado, anéis de cebola crocantes e molho barbecue artesanal.",
    price: "39,90",
    old: "45,90",
    image:
      "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600",
  },
];

export default function PDVPage() {
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

              {categories.map((cat, i) => (
                <button
                  key={cat}
                  className={`w-full min-h-[84px] rounded-3xl text-center px-4 transition ${
                    i === 2
                      ? "bg-blue-600"
                      : "bg-[#0c101d] hover:bg-[#151c2d]"
                  }`}
                >
                  {cat}
                </button>
              ))}

            </div>

          </aside>

          {/* PRODUCTS */}
          <section className="flex-1 min-w-0 overflow-y-auto scrollbar-hide p-6 bg-[#030712]">

            {/* HERO */}
            <div className="relative h-[220px] w-full rounded-[32px] overflow-hidden mb-6">

              <img
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400"
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute inset-0 bg-black/60" />

              <div className="relative z-10 p-10">
                <h1 className="text-3xl xl:text-5xl font-black mb-4 leading-tight break-words max-w-[700px]">
                  Hambúrgueres Gourmet
                </h1>

                <p className="text-base xl:text-xl text-zinc-300 max-w-[700px] break-words">
                  Conheça nossos Hambúrgueres de Cortes Especiais
                  suculentos, molhos exclusivos e acompanhamentos irresistíveis.
                </p>
              </div>

            </div>

            {/* PRODUCTS */}
            <div className="space-y-5">

              {products.map((product) => (
                <div
  key={product.name}
  className="min-h-[210px] w-full overflow-hidden rounded-[32px] bg-[#0b0f1b] border border-[#161b2d] flex items-center px-6"
                >

                  <img
                    src={product.image}
                    className="w-[140px] xl:w-[180px] h-[120px] xl:h-[150px] object-cover rounded-3xl"
                  />

                  <div className="flex-1 px-5 xl:px-8 min-w-0 overflow-hidden">

                    <h2 className="text-2xl xl:text-3xl font-bold mb-3 leading-tight break-words max-w-full">
                      {product.name}
                    </h2>

                    <p className="text-zinc-400 text-base xl:text-lg leading-relaxed break-words max-w-full">
                      {product.description}
                    </p>

                    <div className="flex gap-3 mt-5">

                      <IconBtn icon={<Pencil size={18} />} />
                      <IconBtn icon={<Trash2 size={18} />} />
                      <IconBtn icon={<EyeOff size={18} />} />

                    </div>
                  </div>

                  <div className="w-[160px] xl:w-[220px] shrink-0 flex flex-col items-end pl-4">

                    <span className="text-zinc-500 line-through text-2xl">
                      R$ {product.old}
                    </span>

                    <span className="text-2xl xl:text-4xl font-black whitespace-nowrap">
                      R$ {product.price}
                    </span>

                    <button className="mt-6 h-[58px] px-10 rounded-2xl bg-blue-600 hover:bg-blue-500 transition text-lg font-bold">
                      ADICIONAR
                    </button>

                  </div>

                </div>
              ))}

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