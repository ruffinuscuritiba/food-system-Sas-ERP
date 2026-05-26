"use client";

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
    name: "Picanha ao Fogo",
    price: "34,90",
    old: "39,90",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
  },
  {
    name: "Black Angus Truffle",
    price: "44,90",
    old: "49,90",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600",
  },
  {
    name: "Costela 12 Horas",
    price: "39,90",
    old: "45,90",
    image:
      "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600",
  },
];

export default function PDVPage() {
  return (
    <div className="h-screen bg-[#030712] text-white flex overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-[220px] bg-[#050816] border-r border-[#161b2d] flex flex-col shrink-0">

        {/* HEADER */}
        <div className="h-[92px] border-b border-[#161b2d] px-5 flex items-center gap-4">

          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black">
            F
          </div>

          <div>
            <h1 className="text-xl font-bold leading-tight">
              FoodSaaS ERP
            </h1>

            <p className="text-zinc-400 text-sm">
              Gestão
            </p>
          </div>

        </div>

        {/* MENU */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          <MenuSection
            title=""
            items={[
              {
                icon: <LayoutDashboard size={18} />,
                label: "Dashboard",
                green: true,
              },
            ]}
          />

          <MenuSection
            title="OPERAÇÃO"
            items={[
              {
                icon: <ShoppingCart size={18} />,
                label: "Pedidos",
              },
              {
                icon: <ChefHat size={18} />,
                label: "Cozinha",
              },
              {
                icon: <UtensilsCrossed size={18} />,
                label: "Mesas",
              },
              {
                icon: <DollarSign size={18} />,
                label: "PDV / Caixa",
                active: true,
              },
            ]}
          />

          <MenuSection
            title="CARDÁPIO"
            items={[
              {
                icon: <Package size={18} />,
                label: "Produtos",
              },
              {
                icon: <Tags size={18} />,
                label: "Categorias",
              },
              {
                icon: <Pizza size={18} />,
                label: "Bordas de Pizza",
              },
            ]}
          />

          <MenuSection
            title="ESTOQUE"
            items={[
              {
                icon: <Boxes size={18} />,
                label: "Movimentações",
              },
              {
                icon: <FlaskConical size={18} />,
                label: "Ingredientes",
              },
              {
                icon: <BookOpen size={18} />,
                label: "Receitas",
              },
            ]}
          />

          <MenuSection
            title="IA"
            items={[
              {
                icon: <Sparkles size={18} />,
                label: "Cadastro por Imagem",
              },
            ]}
          />

          <MenuSection
            title="MARKETPLACE"
            items={[
              {
                icon: <Plug size={18} />,
                label: "Integrações",
              },
            ]}
          />

          <MenuSection
            title="CONFIGURAÇÕES"
            items={[
              {
                icon: <Palette size={18} />,
                label: "Tema / Visual",
              },
              {
                icon: <QrCode size={18} />,
                label: "QR Code Mesas",
              },
            ]}
          />

        </div>

        {/* FOOTER */}
        <div className="border-t border-[#161b2d] p-5">
          <button className="flex items-center gap-3 text-zinc-300">
            <LogOut size={18} />
            Sair
          </button>
        </div>

      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* TOPBAR */}
        <header className="h-[92px] border-b border-[#161b2d] px-5 flex items-center justify-between gap-5 overflow-hidden">

          <div className="flex items-center gap-4 min-w-0">

            {/* LOGO */}
            <div className="flex items-center gap-4 shrink-0">

              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black">
                F
              </div>

              <div>
                <h1 className="text-[20px] font-bold leading-tight whitespace-nowrap">
                  FoodSaaS-ERP - PDV
                </h1>

                <p className="text-zinc-400 text-sm">
                  Sistema de Caixa
                </p>
              </div>

            </div>

            {/* SEARCH */}
            <div className="w-[260px] xl:w-[360px] h-[54px] rounded-2xl bg-[#070b17] border border-[#1b2337] flex items-center gap-4 px-5 shrink-0">

              <Search
                size={18}
                className="text-zinc-500 shrink-0"
              />

              <input
                placeholder="Buscar produto, código ou cliente..."
                className="bg-transparent outline-none w-full text-sm"
              />

            </div>

            {/* TABLE */}
            <div className="w-[90px] h-[54px] rounded-2xl bg-[#070b17] border border-[#1b2337] flex items-center justify-center gap-3 shrink-0">

              <div className="w-3 h-3 rounded-full bg-green-500" />

              <div className="leading-none">

                <div className="text-[10px] uppercase text-zinc-400">
                  Mesa
                </div>

                <div className="text-2xl font-bold">
                  29
                </div>

              </div>

            </div>

          </div>

          {/* BUTTONS */}
          <div className="flex items-center gap-3 shrink-0">

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

            <button className="relative h-[54px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3 font-semibold shrink-0">

              <ShoppingBag size={20} />

              Carrinho

              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-xs flex items-center justify-center">
                0
              </div>

            </button>

          </div>

        </header>

        {/* CONTENT */}
        <div className="flex-1 min-w-0 grid grid-cols-[150px_minmax(0,1fr)] overflow-hidden">

          {/* CATEGORY */}
          <aside className="border-r border-[#161b2d] overflow-y-auto p-4 bg-[#050816]">

            <div className="space-y-4">

              {categories.map((cat, i) => (
                <button
                  key={cat}
                  className={`
                    w-full
                    min-h-[84px]
                    rounded-3xl
                    px-3
                    text-center
                    text-sm
                    transition
                    ${
                      i === 2
                        ? "bg-blue-600"
                        : "bg-[#0b1020] hover:bg-[#12192b]"
                    }
                  `}
                >
                  {cat}
                </button>
              ))}

            </div>

          </aside>

          {/* PRODUCTS */}
          <section className="min-w-0 overflow-x-hidden overflow-y-auto p-5">

            {/* HERO */}
            <div className="relative w-full h-[220px] rounded-[32px] overflow-hidden mb-6">

              <img
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400"
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute inset-0 bg-black/60" />

              <div className="relative z-10 p-8 max-w-[700px]">

                <h1
                  className="
                    text-2xl
                    xl:text-4xl
                    font-black
                    mb-4
                    leading-tight
                    break-words
                  "
                >
                  Hambúrgueres Gourmet
                </h1>

                <p className="text-zinc-300 text-sm xl:text-lg leading-relaxed">
                  Conheça nossos hambúrgueres especiais premium,
                  cortes selecionados e sabores artesanais exclusivos.
                </p>

              </div>

            </div>

            {/* LIST */}
            <div className="space-y-5">

              {products.map((product) => (
                <div
                  key={product.name}
                  className="
                    w-full
                    overflow-hidden
                    rounded-[32px]
                    bg-[#0b1020]
                    border
                    border-[#161b2d]
                    grid
                    grid-cols-[90px_minmax(0,1fr)_90px]
                    xl:grid-cols-[140px_minmax(0,1fr)_140px]
                    gap-4
                    items-center
                    p-4
                  "
                >

                  {/* IMAGE */}
                  <img
                    src={product.image}
                    className="
                      w-[90px]
                      h-[90px]
                      xl:w-[140px]
                      xl:h-[120px]
                      object-cover
                      rounded-3xl
                    "
                  />

                  {/* INFO */}
                  <div className="min-w-0 overflow-hidden">

                    <h2
                      className="
                        text-sm
                        xl:text-2xl
                        font-bold
                        leading-tight
                        break-words
                      "
                    >
                      {product.name}
                    </h2>

                    <p
                      className="
                        text-zinc-400
                        mt-3
                        leading-relaxed
                        text-xs
                        xl:text-base
                      "
                    >
                      Hambúrguer premium artesanal com ingredientes
                      selecionados e sabor exclusivo.
                    </p>

                  </div>

                  {/* PRICE */}
                  <div
                    className="
                      w-full
                      flex
                      flex-col
                      items-center
                      justify-center
                    "
                  >

                    <span
                      className="
                        text-zinc-500
                        line-through
                        text-xs
                        xl:text-lg
                      "
                    >
                      R$ {product.old}
                    </span>

                    <span
                      className="
                        text-lg
                        xl:text-3xl
                        font-black
                        whitespace-nowrap
                      "
                    >
                      R$ {product.price}
                    </span>

                    <button
                      className="
                        mt-2
                        h-[34px]
                        w-full
                        rounded-xl
                        bg-blue-600
                        hover:bg-blue-500
                        transition
                        font-bold
                        text-xs
                      "
                    >
                      ADD
                    </button>

                  </div>

                </div>
              ))}

            </div>

          </section>

        </div>

        {/* FOOTER */}
        <footer className="h-[58px] border-t border-[#161b2d] px-6 flex items-center justify-between text-zinc-400 text-sm">

          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            Sistema Online
          </div>

          <div className="flex items-center gap-10">
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
    <button className="h-[54px] px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 transition flex items-center gap-3 shrink-0">

      {icon}

      <div className="text-left leading-none">

        <div className="font-semibold text-sm">
          {title}
        </div>

        <div className="text-[11px] opacity-80 mt-1">
          {subtitle}
        </div>

      </div>

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
        <div className="text-[11px] tracking-[2px] text-zinc-500 font-bold mb-3">
          {title}
        </div>
      )}

      <div className="space-y-2">

        {items.map((item: any) => (
          <button
            key={item.label}
            className={`
              w-full
              h-14
              rounded-2xl
              px-4
              flex
              items-center
              gap-3
              transition
              ${
                item.green
                  ? "bg-green-700"
                  : item.active
                  ? "bg-blue-600"
                  : "hover:bg-[#12192b]"
              }
            `}
          >
            {item.icon}
            <span className="text-sm">
              {item.label}
            </span>
          </button>
        ))}

      </div>

    </div>
  );
}