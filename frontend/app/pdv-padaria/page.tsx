"use client";

/**
 * Frente de Caixa — Padaria / Confeitaria / Açaí (ver isPadariaStylePdv em
 * lib/segmentLabels.ts). Visual aprovado pelo usuário como mockup ("Ponto do
 * Pão POS" — topo marrom, categorias em blocos coloridos, cliente em
 * destaque no topo do pedido) e portado aqui para dados e ações reais:
 * categorias/produtos vêm de /categories e /products, caixa via /cash/*,
 * fechamento de venda via /orders + confirmação de status (mesmo fluxo do
 * /pdv clássico e do /pdv-marmitaria-restaurante).
 *
 * Diferente da Marmitaria (que tem um construtor obrigatório "monte sua
 * marmita"), venda de padaria é predominantemente balcão simples — clique no
 * produto já soma no pedido. Endereço/entrega só aparece se o operador abrir
 * "Entrega" no rodapé de pagamento (reaproveita o mesmo OrderDetailsForm
 * compartilhado, com autocomplete de CEP e busca de cliente por telefone).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { getCategoryColor } from "@/lib/categoryColors";
import { getProductPlaceholderImage } from "@/lib/productPlaceholder";
import {
  OrderDetailsForm,
  type OrderDetails,
} from "@/components/shared/OrderDetailsForm";
import {
  DoorOpen,
  Search,
  Minus,
  Plus,
  UserRound,
  Repeat,
  CreditCard,
  Wallet,
  QrCode,
  Receipt,
  Cloud,
  Settings,
  Croissant,
  CakeSlice,
  CupSoda,
  PackageOpen,
  Utensils,
} from "lucide-react";

type ProductSize = { size: string; price: number };
type Product = {
  id: string;
  name: string;
  salePrice: number;
  imageUrl?: string | null;
  sizes?: ProductSize[];
  categoryId?: string;
};
type Category = { id: string; name: string; color?: string | null };
type CartLine = {
  key: string;
  productId: string;
  name: string;
  imageUrl?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
type Cash = { id: string; balance: number; isOpen: boolean };

const TOPBAR = "#4B2F1F";
const TOPBAR_2 = "#5c3a26";
const PAGE_BG = "#F4F1EC";
const SURFACE = "#FFFFFF";
const INK = "#2B2320";
const INK_SOFT = "#6b6560";
const MUTED = "#8a8480";
const PAY_TOTAL = "#21A661";
const PAY_PIX = "#26C6DA";
const PAY_CARTAO = "#009688";
const PAY_DINHEIRO = "#546E7A";

const CATEGORY_ICONS = [Croissant, CakeSlice, CupSoda, PackageOpen, Utensils];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function priceLabel(p: Product) {
  if (p.sizes && p.sizes.length > 0) {
    const prices = p.sizes.map((s) => Number(s.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt(Number(p.salePrice || 0));
}

export default function PadariaPdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");
  const [cashModalOpen, setCashModalOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [companyName, setCompanyName] = useState("Padaria");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [businessSegment, setBusinessSegment] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    const tok = localStorage.getItem("token") || "";
    if (tok) setAuthToken(tok);
    api
      .get("/company/settings")
      .then((r) => {
        if (r.data?.name) setCompanyName(r.data.name);
        if (r.data?.city) setCompanyCity(r.data.city);
        if (r.data?.state) setCompanyState(r.data.state);
        if (r.data?.businessSegment) setBusinessSegment(r.data.businessSegment);
      })
      .catch(() => {});
  }, []);

  const placeholderImg = useMemo(
    () => getProductPlaceholderImage(businessSegment ?? "PADARIA"),
    [businessSegment],
  );

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({ orderType: "PICKUP" });

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);

  const loadCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/categories"), api.get("/products")]);
      const nextProducts: Product[] = Array.isArray(pRes.data) ? pRes.data : [];
      const productCategoryIds = new Set(nextProducts.map((p) => p.categoryId).filter(Boolean));
      setCategories(
        (Array.isArray(cRes.data) ? cRes.data : []).filter((c) => productCategoryIds.has(c.id)),
      );
      setProducts(nextProducts);
    } catch {
      toast.error("Erro ao carregar cardápio");
    }
  }, []);
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const checkCash = useCallback(async () => {
    setCheckingCash(true);
    try {
      const r = await api.get("/cash/current");
      setCash(r.data && r.data.isOpen ? r.data : null);
    } catch {
      /* silent */
    } finally {
      setCheckingCash(false);
    }
  }, []);
  useEffect(() => {
    checkCash();
  }, [checkCash]);

  async function openRegister() {
    const value = Number(openingValue.replace(",", "."));
    if (!openingValue || isNaN(value) || value < 0) {
      toast.error("Informe o valor de abertura");
      return;
    }
    try {
      const r = await api.post("/cash/open", { openingValue: value });
      setCash(r.data);
      setCashModalOpen(false);
      setOpeningValue("");
      toast.success("Caixa aberto");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao abrir caixa");
    }
  }

  const filteredProducts = useMemo(() => {
    let list = activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, activeCategory, search]);

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "Todos os produtos";
    return categories.find((c) => c.id === activeCategory)?.name ?? "Itens";
  }, [activeCategory, categories]);

  function addLine(product: Product) {
    const unitPrice =
      product.sizes && product.sizes.length > 0
        ? Number(product.sizes[0].price)
        : Number(product.salePrice || 0);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: product.id,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          qty: 1,
          unitPrice,
          lineTotal: unitPrice,
        },
      ];
    });
    toast.success(`${product.name} adicionado`, { duration: 1200 });
  }
  function incLine(key: string) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice } : l)),
    );
  }
  function decLine(key: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty - 1, lineTotal: (l.qty - 1) * l.unitPrice } : l))
        .filter((l) => l.qty > 0),
    );
  }

  const detailsReady =
    orderDetails.orderType === "PICKUP" ||
    (orderDetails.orderType === "DINE_IN" && Boolean(orderDetails.tableNumber?.trim())) ||
    (orderDetails.orderType === "DELIVERY" &&
      Boolean(orderDetails.address?.trim()) &&
      Boolean(orderDetails.addressNumber?.trim()));

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0) return;
    if (!cash) {
      toast.error("Abra o caixa antes de finalizar a venda");
      setPaymentOpen(false);
      return;
    }
    if (!detailsReady) {
      toast.error(
        orderDetails.orderType === "DINE_IN"
          ? "Informe o número da mesa"
          : "Informe rua e número do endereço de entrega",
      );
      return;
    }
    const deliveryFee =
      orderDetails.orderType === "DELIVERY"
        ? parseFloat((orderDetails.deliveryFee ?? "").replace(",", ".")) || 0
        : 0;
    const fullAddress =
      orderDetails.orderType === "DELIVERY"
        ? [orderDetails.address, orderDetails.addressNumber, orderDetails.complement, orderDetails.bairro, orderDetails.cidade]
            .filter(Boolean)
            .join(", ")
        : "BALCAO";
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: orderDetails.customerName || "Cliente balcão",
        customerPhone: orderDetails.customerPhone || "",
        deliveryAddress: fullAddress,
        neighborhood: orderDetails.orderType === "DELIVERY" ? orderDetails.bairro || "" : undefined,
        orderType: orderDetails.orderType,
        tableNumber: orderDetails.orderType === "DINE_IN" ? orderDetails.tableNumber : undefined,
        deliveryZoneId: orderDetails.deliveryZoneId || undefined,
        channel: "PDV",
        cashId: cash.id,
        paymentMethod,
        notes: "",
        items: cart.map((l) => ({ productId: l.productId, quantity: l.qty, unitPrice: l.unitPrice })),
        subtotal: total,
        deliveryFee,
        total: total + deliveryFee,
      });
      if (orderRes.data?.id) await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      toast.success(`Pedido #${orderRes.data?.number ?? "—"} fechado — R$ ${fmt(total + deliveryFee)}`);
      setCart([]);
      setPaymentOpen(false);
      setOrderDetails({ orderType: "PICKUP" });
      if (orderRes.data?.number) setLastOrderNumber(orderRes.data.number);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao fechar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="min-h-[600px] flex flex-col" style={{ background: PAGE_BG }}>
        {checkingCash ? (
          <div className="flex items-center justify-center py-24 text-sm" style={{ color: MUTED }}>
            Carregando...
          </div>
        ) : (
          <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg m-3" style={{ background: SURFACE }}>
            {/* Topbar */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ background: `linear-gradient(180deg, ${TOPBAR_2}, ${TOPBAR})` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: "rgba(255,255,255,0.16)" }}>
                  🥖
                </span>
                <span className="text-white font-bold text-[15px] truncate uppercase tracking-wide">
                  {companyName} POS
                </span>
              </div>
              <div className="flex items-center gap-4 text-white/85 shrink-0">
                <Cloud size={16} aria-hidden />
                {cash ? (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/90">
                    <DoorOpen size={15} />
                    Caixa aberto — R$ {fmt(cash.balance)}
                  </span>
                ) : (
                  <button
                    onClick={() => setCashModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white transition active:scale-[.97]"
                    style={{ background: PAY_TOTAL }}
                  >
                    <DoorOpen size={15} />
                    Abrir Caixa
                  </button>
                )}
                <Link
                  href="/configuracoes"
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold hover:text-white transition"
                >
                  <Settings size={15} />
                  Configurações
                </Link>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Coluna esquerda: categorias + busca + produtos */}
              <div className="flex-1 min-w-0 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
                  <button
                    onClick={() => setActiveCategory("all")}
                    className="rounded-2xl py-4 px-2 flex flex-col items-center gap-1.5 text-white font-bold text-[11px] uppercase tracking-wide transition active:scale-[.97] shadow-sm"
                    style={{ background: activeCategory === "all" ? INK : `${INK}99` }}
                  >
                    <Utensils size={24} />
                    Todos
                  </button>
                  {categories.map((c, i) => {
                    const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
                    const color = getCategoryColor(c, i);
                    const isActive = activeCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActiveCategory(c.id)}
                        className="rounded-2xl py-4 px-2 flex flex-col items-center gap-1.5 text-white font-bold text-[11px] uppercase tracking-wide transition active:scale-[.97] shadow-sm"
                        style={{ background: isActive ? color : `${color}c8` }}
                      >
                        <Icon size={24} />
                        <span className="truncate max-w-full">{c.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4"
                  style={{ background: PAGE_BG, border: "1px solid #E1DEDA" }}
                >
                  <Search size={16} style={{ color: MUTED }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar produto ou código..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: INK }}
                  />
                </div>

                <p className="text-[11px] font-black uppercase tracking-wider mb-2.5" style={{ color: INK_SOFT }}>
                  {activeCategoryLabel}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine(p)}
                      className="rounded-2xl border p-3 flex flex-col items-center gap-2 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.98]"
                      style={{ background: SURFACE, borderColor: "#E1DEDA" }}
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0" style={{ background: PAGE_BG }}>
                        <img
                          src={p.imageUrl || placeholderImg}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            if (e.currentTarget.src !== placeholderImg) e.currentTarget.src = placeholderImg;
                          }}
                        />
                      </div>
                      <p className="text-[12.5px] font-semibold leading-tight" style={{ color: INK }}>
                        {p.name}
                      </p>
                      <p className="text-[11.5px]" style={{ color: MUTED }}>
                        R$ {priceLabel(p)}
                      </p>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="col-span-full text-sm text-center py-10" style={{ color: MUTED }}>
                      Nenhum produto encontrado
                    </p>
                  )}
                </div>

              </div>

              {/* Coluna direita: cliente + pedido + pagamento */}
              <aside className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l" style={{ borderColor: "#E1DEDA" }}>
                <div className="p-4 border-b" style={{ borderColor: "#E1DEDA" }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide mb-3" style={{ color: PAY_TOTAL }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PAY_TOTAL }} />
                    Venda em andamento
                  </div>

                  {!cash && !checkingCash && (
                    <button
                      onClick={() => setCashModalOpen(true)}
                      className="text-[11px] mb-2 underline decoration-dotted"
                      style={{ color: "#9F1239" }}
                    >
                      Caixa fechado — clique pra abrir e registrar vendas
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <UserRound size={15} style={{ color: MUTED }} />
                    <input
                      value={orderDetails.customerName ?? ""}
                      onChange={(e) => setOrderDetails((d) => ({ ...d, customerName: e.target.value }))}
                      placeholder="Nome do cliente (opcional)"
                      className="flex-1 rounded-lg px-2.5 py-2 text-[13px] outline-none border"
                      style={{ color: INK, borderColor: "#E1DEDA", background: PAGE_BG }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Repeat size={15} style={{ color: MUTED }} />
                    <input
                      value={orderDetails.customerPhone ?? ""}
                      onChange={(e) => setOrderDetails((d) => ({ ...d, customerPhone: e.target.value }))}
                      placeholder="Telefone (opcional)"
                      className="flex-1 rounded-lg px-2.5 py-2 text-[13px] outline-none border"
                      style={{ color: INK, borderColor: "#E1DEDA", background: PAGE_BG }}
                    />
                  </div>
                </div>

                <div className="p-3 max-h-[38vh] overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="text-xs text-center py-10" style={{ color: MUTED }}>
                      Clique num produto pra começar
                    </p>
                  ) : (
                    cart.map((l) => (
                      <div key={l.key} className="flex items-center gap-2 py-2.5 border-b last:border-b-0" style={{ borderColor: "#F0EDE8" }}>
                        <span
                          className="w-6 h-6 rounded-md text-[11px] font-black flex items-center justify-center shrink-0"
                          style={{ background: PAGE_BG, color: INK_SOFT }}
                        >
                          {l.qty}x
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold truncate" style={{ color: INK }}>
                            {l.name}
                          </p>
                          <p className="text-[11px]" style={{ color: MUTED }}>
                            R$ {fmt(l.unitPrice)} / un.
                          </p>
                        </div>
                        <span className="text-[13px] font-bold shrink-0" style={{ color: INK }}>
                          R$ {fmt(l.lineTotal)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => decLine(l.key)}
                            aria-label={`Diminuir ${l.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: PAGE_BG, color: INK_SOFT }}
                          >
                            <Minus size={12} />
                          </button>
                          <button
                            onClick={() => incLine(l.key)}
                            aria-label={`Aumentar ${l.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                            style={{ background: PAY_TOTAL }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t" style={{ borderColor: "#E1DEDA" }}>
                  {lastOrderNumber !== null && (
                    <p className="text-[11px] mb-2" style={{ color: PAY_TOTAL }}>
                      Último pedido fechado: #{lastOrderNumber}
                    </p>
                  )}
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-[13px] font-bold" style={{ color: INK }}>
                      Total
                    </span>
                    <span className="text-[26px] font-black" style={{ color: PAY_TOTAL }}>
                      R${fmt(total)}
                    </span>
                  </div>
                  <button
                    onClick={() => cart.length && setPaymentOpen(true)}
                    disabled={!cart.length}
                    className="w-full h-13 py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 transition active:scale-[.98] disabled:opacity-40"
                    style={{ background: PAY_TOTAL }}
                  >
                    <Receipt size={17} />
                    PAGAR R${fmt(total)}
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {cashModalOpen && (
          <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={() => setCashModalOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <DoorOpen size={20} style={{ color: PAY_TOTAL }} />
                <h2 className="text-base font-black" style={{ color: INK }}>
                  Abrir caixa
                </h2>
              </div>
              <label className="block text-[11px] font-black uppercase mb-1.5" style={{ color: MUTED }}>
                Valor de abertura
              </label>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={openingValue}
                onChange={(e) => setOpeningValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && openRegister()}
                className="w-full border rounded-xl px-3 py-2.5 text-lg font-black mb-4"
                style={{ color: INK, borderColor: "#E1DEDA" }}
              />
              <button
                onClick={openRegister}
                className="w-full h-11 rounded-full text-white font-black transition active:scale-[.98] mb-2"
                style={{ background: PAY_TOTAL }}
              >
                Abrir Caixa
              </button>
              <button
                onClick={() => setCashModalOpen(false)}
                className="w-full h-9 text-[13px] font-semibold"
                style={{ color: MUTED }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {paymentOpen && (
          <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={() => setPaymentOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <p className="text-xs mb-1" style={{ color: MUTED }}>
                Total a pagar
              </p>
              <p className="text-2xl font-black mb-4" style={{ color: INK }}>
                R${" "}
                {fmt(
                  total +
                    (orderDetails.orderType === "DELIVERY"
                      ? parseFloat((orderDetails.deliveryFee ?? "").replace(",", ".")) || 0
                      : 0),
                )}
              </p>

              <div className="mb-4">
                <OrderDetailsForm
                  value={orderDetails}
                  onChange={setOrderDetails}
                  compact
                  companyId={user?.companyId}
                  token={authToken}
                  cityHint={companyCity}
                  stateHint={companyState}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { m: "PIX", l: "Pix", icon: QrCode, color: PAY_PIX },
                  { m: "CREDIT_CARD", l: "Cartão", icon: CreditCard, color: PAY_CARTAO },
                  { m: "DEBIT_CARD", l: "Débito", icon: CreditCard, color: PAY_CARTAO },
                  { m: "CASH", l: "Dinheiro", icon: Wallet, color: PAY_DINHEIRO },
                ].map((p) => (
                  <button
                    key={p.m}
                    disabled={submitting || !detailsReady}
                    onClick={() => finalizeSale(p.m)}
                    className="h-11 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-1.5 disabled:opacity-40 transition active:scale-[.98]"
                    style={{ background: p.color }}
                  >
                    <p.icon size={15} />
                    {p.l}
                  </button>
                ))}
              </div>
              {!detailsReady && (
                <p className="text-[11px] text-center mt-2" style={{ color: "#9F1239" }}>
                  {orderDetails.orderType === "DINE_IN"
                    ? "Informe o número da mesa pra liberar o pagamento"
                    : "Informe rua e número pra liberar o pagamento"}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}
