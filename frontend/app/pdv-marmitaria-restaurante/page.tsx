"use client";

/**
 * Frente de Caixa — Marmitaria & Restaurante.
 *
 * Interface própria, construída do zero (não é o /pdv genérico de pizzaria
 * com cor trocada, nem o /pdv-marmitaria anterior — esse arquivo aposenta
 * os dois pra esses 2 segmentos). Paleta e regra de negócio vieram de uma
 * especificação real trazida pelo usuário (design.md + catalog.ts de um
 * protótipo React Native descartado — o app em si não rodava aqui, mas a
 * paleta de cor e os limites por categoria são fiéis a ele):
 *   Laranja #F97316 · Verde #16A34A · Cacau #43220F · Creme #FFF7ED ·
 *   Vinho #9F1239 · Grafite #292524.
 *
 * O construtor de composição ("monte sua marmita") fica EMBUTIDO no painel
 * principal (não é um modal por cima) — grupos de Complementos reais da
 * empresa (item 24), renderizados por FORMATO do grupo, não por nome fixo:
 *   - obrigatório + escolha única      → linha "hero" (Proteína)
 *   - obrigatório + múltipla escolha   → linha com contador "Faltam N" +
 *                                         setas de rolagem (Acompanhamentos)
 *   - opcional                          → cards lado a lado (Salada/Sobremesa)
 * Isso funciona pra qualquer configuração real de Complementos da loja, não
 * só pro exemplo específico da referência.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { getCategoryColor } from "@/lib/categoryColors";
import {
  OrderDetailsForm,
  type OrderDetails,
} from "@/components/shared/OrderDetailsForm";
import {
  DoorOpen,
  ChefHat,
  CheckCircle2,
  CreditCard,
  Bell,
  Minus,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  UtensilsCrossed,
  ClipboardList,
  Salad,
} from "lucide-react";
import { getProductPlaceholderImage } from "@/lib/productPlaceholder";

// ── Paleta (design.md) ───────────────────────────────────────────────────
const LARANJA = "#F47B18";
const VERDE = "#12A844";
const CACAU = "#5A250E";
const CACAU_ESCURO = "#241005";
const CREME = "#F7F2ED";
const VINHO = "#D45273";
const GRAFITE = "#3B241A";

type ProductSize = { size: string; price: number };
type Product = {
  id: string;
  name: string;
  salePrice: number;
  imageUrl?: string | null;
  description?: string | null;
  sizes?: ProductSize[];
  categoryId?: string;
};
type Category = { id: string; name: string; color?: string | null };

type ComplementOption = {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
  imageUrl?: string | null;
};
type ComplementGroup = {
  id: string;
  name: string;
  required: boolean;
  chargesExtra: boolean;
  multipleChoice: boolean;
  minOptions: number;
  maxOptions: number;
  options: ComplementOption[];
};
type Selection = {
  complementOptionId: string;
  complementName: string;
  optionName: string;
  price: number;
  imageUrl?: string | null;
};

type CartLine = {
  key: string;
  productId: string;
  name: string;
  imageUrl?: string | null;
  size?: string;
  notes?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
type Cash = {
  id: string;
  registerNumber?: number | null;
  balance: number;
  isOpen: boolean;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const PLACEHOLDER_IMG = getProductPlaceholderImage("MARMITARIA");

function priceLabel(p: Product) {
  if (p.sizes && p.sizes.length > 0) {
    const prices = p.sizes.map((s) => Number(s.price));
    const min = Math.min(...prices),
      max = Math.max(...prices);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt(Number(p.salePrice || 0));
}

export default function MarmitariaRestaurantePdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [companyName, setCompanyName] = useState<string>("MARMITARIA DO CHEF");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
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
      })
      .catch(() => {});
  }, []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  // Balcão/Mesa/Entrega — reaproveita o MESMO componente e as mesmas
  // configurações (autocomplete de endereço por CEP/rua, busca de cliente
  // por telefone, cálculo de taxa por zona de entrega) já usadas no /pdv
  // clássico, em vez de um formulário próprio. Antes o pedido sempre saía
  // gravado como "BALCAO"/DINE_IN fixo, sem opção nenhuma de escolher
  // entrega — achado ao vivo pelo usuário.
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({
    orderType: "PICKUP",
  });

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const loadCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products"),
      ]);
      const nextProducts: Product[] = Array.isArray(pRes.data) ? pRes.data : [];
      const productCategoryIds = new Set(
        nextProducts.map((p) => p.categoryId).filter(Boolean),
      );
      setCategories(
        (Array.isArray(cRes.data) ? cRes.data : []).filter((c) =>
          productCategoryIds.has(c.id),
        ),
      );
      setProducts(nextProducts);
    } catch {
      toast.error("Erro ao carregar cardápio");
    }
  }, []);

  // Grade e carrinho funcionam sem caixa aberto — só a finalização exige
  // (banner avisa, não bloqueia; mesmo padrão do /pdv clássico, item 151).
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Tela inicial já abre no construtor (igual referência) quando existe um
  // produto de composição (preço R$0 sem tamanho — convenção "Monte a sua",
  // ver priceLabel/badge abaixo). Sem produto assim, cai pra grade normal.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || products.length === 0) return;
    autoOpenedRef.current = true;
    const composeProduct = products.find(
      (p) => Number(p.salePrice) === 0 && (!p.sizes || p.sizes.length === 0),
    );
    if (composeProduct) openBuilder(composeProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

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
      toast.success("Caixa aberto");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao abrir caixa");
    }
  }

  const filteredProducts = useMemo(
    () =>
      activeCategory === "all"
        ? products
        : products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory],
  );
  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "Cardápio";
    return categories.find((c) => c.id === activeCategory)?.name ?? "Itens";
  }, [activeCategory, categories]);

  function addLine(
    product: Product,
    size: string | undefined,
    unitPrice: number,
    notes?: string,
  ) {
    setCart((prev) => {
      const key = notes
        ? `${product.id}-${Date.now()}`
        : size
          ? `${product.id}-${size}`
          : product.id;
      if (!notes) {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) =>
            l.key === key
              ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice }
              : l,
          );
        }
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          size,
          notes,
          qty: 1,
          unitPrice,
          lineTotal: unitPrice,
        },
      ];
    });
  }

  // ── Construtor embutido ("monte sua marmita") ──────────────────────────
  const [buildProduct, setBuildProduct] = useState<Product | null>(null);
  const [buildSize, setBuildSize] = useState<ProductSize | null>(null);
  const [buildGroups, setBuildGroups] = useState<ComplementGroup[]>([]);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildSelections, setBuildSelections] = useState<
    Record<string, Selection[]>
  >({});
  const complementsCacheRef = useRef<Map<string, ComplementGroup[]>>(new Map());

  async function openBuilder(p: Product) {
    if (p.sizes && p.sizes.length > 1) {
      setBuildProduct(p);
      setBuildSize(null);
      setBuildGroups([]);
      setBuildSelections({});
      return;
    }
    await fetchGroupsAndOpen(p, p.sizes?.[0] ?? null);
  }

  async function fetchGroupsAndOpen(p: Product, size: ProductSize | null) {
    setBuildProduct(p);
    setBuildSize(size);
    setBuildSelections({});
    const cached = complementsCacheRef.current.get(p.id);
    if (cached !== undefined) {
      if (cached.length === 0) {
        finishBuildDirect(p, size);
        return;
      }
      setBuildGroups(cached);
      return;
    }
    setBuildLoading(true);
    try {
      const res = await api.get(`/complements/public/product/${p.id}`);
      const groups: ComplementGroup[] = Array.isArray(res.data) ? res.data : [];
      complementsCacheRef.current.set(p.id, groups);
      if (groups.length === 0) {
        finishBuildDirect(p, size);
        return;
      }
      setBuildGroups(groups);
    } catch {
      finishBuildDirect(p, size);
    } finally {
      setBuildLoading(false);
    }
  }

  // Produto sem nenhum complemento configurado — vai direto pro carrinho,
  // sem passar pelo construtor (ex.: bebida avulsa).
  function finishBuildDirect(p: Product, size: ProductSize | null) {
    addLine(
      p,
      size?.size,
      size ? Number(size.price) : Number(p.salePrice || 0),
    );
    closeBuilder();
  }

  function closeBuilder() {
    setBuildProduct(null);
    setBuildSize(null);
    setBuildGroups([]);
    setBuildSelections({});
  }

  function groupQty(groupId: string) {
    return (buildSelections[groupId] || []).length;
  }

  function toggleSingle(group: ComplementGroup, option: ComplementOption) {
    const current = buildSelections[group.id] || [];
    const already = current.some((s) => s.complementOptionId === option.id);
    setBuildSelections((prev) => ({
      ...prev,
      [group.id]: already
        ? []
        : [
            {
              complementOptionId: option.id,
              complementName: group.name,
              optionName: option.name,
              price: group.chargesExtra ? Number(option.price) : 0,
              imageUrl: option.imageUrl,
            },
          ],
    }));
  }

  function toggleMulti(group: ComplementGroup, option: ComplementOption) {
    const current = buildSelections[group.id] || [];
    const already = current.some((s) => s.complementOptionId === option.id);
    if (already) {
      setBuildSelections((prev) => ({
        ...prev,
        [group.id]: current.filter((s) => s.complementOptionId !== option.id),
      }));
      return;
    }
    if (group.maxOptions > 0 && current.length >= group.maxOptions) {
      toast.error(`Máximo ${group.maxOptions} em "${group.name}"`);
      return;
    }
    setBuildSelections((prev) => ({
      ...prev,
      [group.id]: [
        ...current,
        {
          complementOptionId: option.id,
          complementName: group.name,
          optionName: option.name,
          price: group.chargesExtra ? Number(option.price) : 0,
          imageUrl: option.imageUrl,
        },
      ],
    }));
  }

  const buildExtras = Object.values(buildSelections)
    .flat()
    .reduce((s, x) => s + Number(x.price), 0);
  const buildBasePrice = buildSize
    ? Number(buildSize.price)
    : Number(buildProduct?.salePrice || 0);
  const buildTotal = buildBasePrice + buildExtras;
  const requiredGroups = buildGroups.filter((g) => g.required);
  const requiredFilled = requiredGroups.filter(
    (g) => groupQty(g.id) >= (g.minOptions || 1),
  ).length;
  const buildReady = requiredGroups.every(
    (g) => groupQty(g.id) >= (g.minOptions || 1),
  );

  function confirmBuild() {
    if (!buildProduct) return;
    if (!buildReady) {
      toast.error("Complete os itens obrigatórios antes de adicionar");
      return;
    }
    const selections = Object.values(buildSelections).flat();
    const notes = selections.map((s) => s.optionName).join(", ");
    addLine(buildProduct, buildSize?.size, buildTotal, notes || undefined);
    closeBuilder();
  }

  function incLine(key: string) {
    setCart((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice }
          : l,
      ),
    );
  }
  function decLine(key: string) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key
            ? { ...l, qty: l.qty - 1, lineTotal: (l.qty - 1) * l.unitPrice }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  // Mesmo critério de "pronto pra pagar" do /pdv clássico — Retirada não
  // exige nada extra, Mesa exige número, Entrega exige rua + número.
  const detailsReady =
    orderDetails.orderType === "PICKUP" ||
    (orderDetails.orderType === "DINE_IN" &&
      Boolean(orderDetails.tableNumber?.trim())) ||
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
        ? [
            orderDetails.address,
            orderDetails.addressNumber,
            orderDetails.complement,
            orderDetails.bairro,
            orderDetails.cidade,
          ]
            .filter(Boolean)
            .join(", ")
        : "BALCAO";
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: orderDetails.customerName || "Cliente balcão",
        customerPhone: orderDetails.customerPhone || "",
        deliveryAddress: fullAddress,
        neighborhood:
          orderDetails.orderType === "DELIVERY"
            ? orderDetails.bairro || ""
            : undefined,
        orderType: orderDetails.orderType,
        tableNumber:
          orderDetails.orderType === "DINE_IN"
            ? orderDetails.tableNumber
            : undefined,
        deliveryZoneId: orderDetails.deliveryZoneId || undefined,
        channel: "PDV",
        cashId: cash.id,
        paymentMethod,
        notes: "",
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          notes: [l.size ? `Tamanho: ${l.size}` : "", l.notes ?? ""]
            .filter(Boolean)
            .join(" — "),
          unitPrice: l.unitPrice,
        })),
        subtotal: total,
        deliveryFee,
        total: total + deliveryFee,
      });
      if (orderRes.data?.id)
        await api.patch(`/orders/${orderRes.data.id}/status`, {
          status: "CONFIRMED",
        });
      toast.success(
        `Pedido #${orderRes.data?.number ?? "—"} fechado — R$ ${fmt(total + deliveryFee)}`,
      );
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

  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  function scrollGroup(groupId: string, dir: -1 | 1) {
    scrollRefs.current[groupId]?.scrollBy({
      left: dir * 220,
      behavior: "smooth",
    });
  }

  // Seções de cada grupo obrigatório dentro do construtor — os botões
  // "Proteína"/"Acompanhamentos" da sidebar pulam pra cá (igual referência),
  // em vez de filtrar categoria de produto.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  function jumpToGroup(groupId: string) {
    sectionRefs.current[groupId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main
        className="h-screen min-h-[600px] flex flex-col overflow-hidden font-sans"
        style={{ background: CACAU_ESCURO }}
      >
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-white/60 text-sm">
            Carregando...
          </div>
        ) : (
          <div
            className="flex flex-1 min-h-0 overflow-hidden border-[5px] border-[#1b0b04]"
            style={{ background: CACAU }}
          >
            {/* Marca e atalhos — proporção da coluna esquerda da referência */}
            <aside
              className="w-[244px] shrink-0 flex flex-col p-4"
              style={{
                background: `linear-gradient(180deg, #4b1b0b 0%, ${CACAU_ESCURO} 100%)`,
              }}
            >
              <div className="flex flex-col items-center text-center mb-6 mt-1">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white mb-3 border-2 border-[#F9A35A]"
                  style={{ background: "rgba(244,123,24,.18)" }}
                >
                  <ChefHat size={30} strokeWidth={2.2} />
                </div>
                <h1 className="text-white font-black uppercase leading-[0.9] tracking-tight">
                  {(() => {
                    // Nome em 2 linhas (1ª palavra em destaque, resto embaixo)
                    // como na referência — generalizado pra qualquer nome de
                    // loja real, não só "Marmitaria do Chef" (antes era
                    // comparação exata de string, só funcionava pra 1 caso).
                    const words = companyName.trim().split(/\s+/);
                    if (words.length < 2) return companyName;
                    const [first, ...rest] = words;
                    return (
                      <>
                        <span className="block text-[25px]">{first}</span>
                        <span className="block text-[31px]">{rest.join(" ")}</span>
                      </>
                    );
                  })()}
                </h1>
                <p className="text-[12px] mt-2" style={{ color: "#F9A35A" }}>
                  — Sabor &amp; Praticidade —
                </p>
              </div>

              <nav className="space-y-3">
                {buildProduct ? (
                  requiredGroups.map((g, i) => {
                    const SideIcon = i === 0 ? UtensilsCrossed : i === 1 ? ClipboardList : Salad;
                    return (
                      <button
                        key={g.id}
                        onClick={() => jumpToGroup(g.id)}
                        className="w-full px-5 py-3 rounded-full font-black text-[14px] text-left transition active:scale-[.98] shadow-[0_4px_0_rgba(0,0,0,.22)] text-white flex items-center gap-2"
                        style={{ background: i % 2 === 0 ? LARANJA : VERDE }}
                      >
                        <SideIcon size={16} className="shrink-0" />
                        {g.name}
                      </button>
                    );
                  })
                ) : (
                  <button
                    onClick={() => setActiveCategory("all")}
                    className="w-full px-5 py-3 rounded-full font-black text-[14px] text-left transition active:scale-[.98] shadow-[0_4px_0_rgba(0,0,0,.22)] text-white flex items-center gap-2"
                    style={{ background: LARANJA }}
                  >
                    <UtensilsCrossed size={16} className="shrink-0" />
                    Cardápio
                  </button>
                )}
              </nav>

              <div className="relative mt-auto rounded-[30px] overflow-hidden border-4 border-[#7A3514] shadow-[0_8px_18px_rgba(0,0,0,.32)]">
                <img
                  src={
                    cart
                      .slice()
                      .reverse()
                      .find((l) => l.imageUrl)?.imageUrl || PLACEHOLDER_IMG
                  }
                  alt="Prato da marmitaria"
                  className="w-full h-[188px] object-cover"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMG;
                  }}
                />
                <span
                  className="absolute right-[-2px] bottom-[18px] w-14 h-14 rounded-full flex items-center justify-center text-white border-4 border-[#4b1b0b]"
                  style={{ background: VERDE }}
                >
                  <Check size={28} strokeWidth={3} />
                </span>
              </div>
            </aside>

            <div
              className="min-w-0 flex-1 flex flex-col overflow-hidden"
              style={{
                background: `linear-gradient(180deg, #64270D 0%, #7A3513 100%)`,
              }}
            >
              <header className="h-[78px] shrink-0 flex items-center justify-between gap-3 px-4 py-3">
                <div
                  className="flex items-center gap-2.5 overflow-x-auto pr-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {buildProduct ? (
                    // Antes travava em só 3 grupos (buildGroups.slice(0,3)) com
                    // ícone repetido (ChefHat aparecia 2x) pra bater com a
                    // contagem exata da imagem — quebrava produtos com mais de
                    // 3 grupos (ex.: Proteína+Acompanhamentos+Salada+Sobremesa
                    // já são 4). Mostra todos agora, com ícone e cor por índice
                    // sem repetição.
                    buildGroups.map((g, i) => {
                      const ICONS = [ChefHat, UtensilsCrossed, ClipboardList, Salad];
                      const GroupIcon = ICONS[i % ICONS.length];
                      const COLORS = [LARANJA, VERDE, VINHO];
                      return (
                        <button
                          key={g.id}
                          onClick={() => jumpToGroup(g.id)}
                          className="shrink-0 h-12 px-4 rounded-full font-black text-[13px] whitespace-nowrap transition active:scale-[.97] shadow-[0_4px_0_rgba(0,0,0,.22)] flex items-center gap-2 text-white"
                          style={{ background: COLORS[i % COLORS.length] }}
                        >
                          <GroupIcon size={17} />
                          {g.name}
                        </button>
                      );
                    })
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          closeBuilder();
                          setActiveCategory("all");
                        }}
                        className="shrink-0 h-12 px-4 rounded-full font-black text-[13px] whitespace-nowrap transition active:scale-[.97] shadow-[0_4px_0_rgba(0,0,0,.22)] text-white"
                        style={{
                          background:
                            activeCategory === "all"
                              ? LARANJA
                              : "rgba(244,123,24,.55)",
                        }}
                      >
                        Todos
                      </button>
                      {categories.map((c, i) => {
                        const isActive = activeCategory === c.id;
                        // Antes travava em só 2 categorias (categories.slice(0,2))
                        // pra bater com a contagem exata da imagem de referência
                        // — quebrava qualquer loja com 3+ categorias, que nunca
                        // conseguia nem ver a 3ª em diante. Agora mostra todas,
                        // com cor própria por categoria (mesma paleta do PDV
                        // Marmitaria antigo e do cardápio digital).
                        const color = getCategoryColor(c, i);
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              closeBuilder();
                              setActiveCategory(c.id);
                            }}
                            className="shrink-0 h-12 px-4 rounded-full font-black text-[13px] whitespace-nowrap transition active:scale-[.97] shadow-[0_4px_0_rgba(0,0,0,.22)] text-white"
                            style={{
                              background: isActive ? color : `${color}99`,
                            }}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[15px] font-black px-3 py-2 rounded-full text-white"
                    style={{ background: "rgba(36,16,5,.32)" }}
                  >
                    R$ {fmt(buildProduct ? buildTotal : total)}
                  </span>
                  <button
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_3px_0_rgba(0,0,0,.18)]"
                    style={{ background: VERDE }}
                    aria-label="Notificações"
                  >
                    <Bell size={18} />
                  </button>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black text-white shrink-0 border-2 border-white/60"
                    style={{ background: "#D88D61" }}
                    title={user?.name ?? "Operador"}
                    aria-label={`Operador: ${user?.name ?? "desconhecido"}`}
                  >
                    {(user?.name ?? "OP").slice(0, 2).toUpperCase()}
                  </div>
                </div>
              </header>

              {!cash && (
                <div
                  className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-xs font-semibold shrink-0"
                  style={{ background: `${VINHO}24`, color: "#FFE5D4" }}
                >
                  <span className="flex items-center gap-2">
                    <DoorOpen size={14} />
                    Caixa fechado — abra pra registrar vendas
                  </span>
                  <button
                    onClick={() =>
                      document
                        .getElementById("open-cash-inline")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="underline decoration-dotted"
                  >
                    Abrir agora
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
                {buildProduct ? (
                  <>
                    <div
                      className="rounded-[20px] p-3.5 shadow-[0_5px_0_rgba(54,17,4,.28)]"
                      style={{
                        background: `linear-gradient(145deg, #F47712 0%, #D9570D 72%, #C84A0B 100%)`,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          onClick={closeBuilder}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ background: "rgba(82,24,3,.28)" }}
                          aria-label="Voltar ao cardápio"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div className="min-w-0">
                          <h2 className="text-white font-black text-[19px] uppercase leading-none truncate">
                            Montar sua marmita
                          </h2>
                          {requiredGroups.length > 0 && (
                            <p className="text-white/75 text-[11px] mt-1">
                              {requiredFilled}/{requiredGroups.length}{" "}
                              obrigatórios preenchidos
                            </p>
                          )}
                        </div>
                      </div>

                      {buildProduct.sizes &&
                      buildProduct.sizes.length > 1 &&
                      !buildSize ? (
                        <div className="bg-white rounded-[16px] p-4 max-w-sm">
                          <p
                            className="text-sm font-black mb-3"
                            style={{ color: GRAFITE }}
                          >
                            Escolha o tamanho
                          </p>
                          <div className="space-y-2">
                            {buildProduct.sizes.map((s) => (
                              <button
                                key={s.size}
                                onClick={() =>
                                  fetchGroupsAndOpen(buildProduct, s)
                                }
                                className="w-full h-11 rounded-xl border flex items-center justify-between px-4 text-sm font-bold transition active:scale-[.98]"
                                style={{
                                  borderColor: "#E6D8CB",
                                  color: GRAFITE,
                                }}
                              >
                                <span>{s.size}</span>
                                <span style={{ color: LARANJA }}>
                                  R$ {fmt(Number(s.price))}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : buildLoading ? (
                        <p className="text-white/70 text-sm py-10 text-center">
                          Carregando...
                        </p>
                      ) : (
                        <div>
                          {buildGroups
                            .filter((g) => g.required && !g.multipleChoice)
                            .map((g, gi) => {
                              const selectedCount = groupQty(g.id);
                              return (
                                <div
                                  key={g.id}
                                  ref={(el) => {
                                    sectionRefs.current[g.id] = el;
                                  }}
                                  className="scroll-mt-4"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-black text-[16px]">
                                      {g.name}
                                    </p>
                                    <span className="text-white/80 text-[11px] font-bold">
                                      {selectedCount
                                        ? "Escolhido"
                                        : "Escolha 1"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {gi === 0 && (
                                      <div
                                        className="relative hidden sm:flex shrink-0 w-[92px] h-[92px] rounded-full items-center justify-center"
                                        style={{
                                          background:
                                            "conic-gradient(#FFF6E9 0deg 74deg, #8E350D 74deg 160deg, #FFF6E9 160deg 235deg, #8E350D 235deg 318deg, #FFF6E9 318deg 360deg)",
                                        }}
                                      >
                                        <div
                                          className="w-[58px] h-[58px] rounded-full flex items-center justify-center"
                                          style={{ background: "#D8590C" }}
                                        >
                                          <ChefHat
                                            size={25}
                                            className="text-white"
                                          />
                                        </div>
                                        <span
                                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-black"
                                          style={{
                                            background: "#FFF6E9",
                                            color: "#8E350D",
                                          }}
                                        >
                                          proteína
                                        </span>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-2.5 flex-1 min-w-0">
                                      {g.options.slice(0, 3).map((opt) => {
                                        const selected = (
                                          buildSelections[g.id] || []
                                        ).some(
                                          (s) =>
                                            s.complementOptionId === opt.id,
                                        );
                                        return (
                                          <button
                                            key={opt.id}
                                            onClick={() => toggleSingle(g, opt)}
                                            className="bg-[#FFF9F2] rounded-[16px] overflow-hidden text-left transition active:scale-[.98]"
                                            style={
                                              selected
                                                ? {
                                                    boxShadow: `0 0 0 3px ${VERDE}`,
                                                  }
                                                : undefined
                                            }
                                          >
                                            <div className="h-[69px] bg-[#F2EAE2] relative">
                                              <img
                                                src={
                                                  opt.imageUrl ||
                                                  PLACEHOLDER_IMG
                                                }
                                                alt=""
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                  e.currentTarget.src =
                                                    PLACEHOLDER_IMG;
                                                }}
                                              />
                                              {selected && (
                                                <span
                                                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                                                  style={{ background: VERDE }}
                                                >
                                                  <Check
                                                    size={12}
                                                    strokeWidth={3}
                                                  />
                                                </span>
                                              )}
                                            </div>
                                            <p
                                              className="text-[11px] font-black px-2 py-2 truncate"
                                              style={{ color: GRAFITE }}
                                            >
                                              {opt.name}
                                            </p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {!buildLoading &&
                      !(
                        buildProduct.sizes &&
                        buildProduct.sizes.length > 1 &&
                        !buildSize
                      ) && (
                        <>
                          {buildGroups
                            .filter((g) => g.required && g.multipleChoice)
                            .map((g) => {
                              const remaining =
                                g.maxOptions > 0
                                  ? Math.max(0, g.maxOptions - groupQty(g.id))
                                  : null;
                              return (
                                <div
                                  key={g.id}
                                  ref={(el) => {
                                    sectionRefs.current[g.id] = el;
                                  }}
                                  className="rounded-[20px] p-3.5 shadow-[0_5px_0_rgba(54,17,4,.24)] scroll-mt-4"
                                  style={{
                                    background:
                                      "linear-gradient(145deg, #8E421C 0%, #703011 100%)",
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-white font-black text-[16px]">
                                      {g.name}
                                    </p>
                                    {remaining !== null && (
                                      <span
                                        className="text-[11px] font-black px-2 py-0.5 rounded-full text-white"
                                        style={{
                                          background:
                                            remaining === 0
                                              ? VERDE
                                              : "rgba(255,255,255,.2)",
                                        }}
                                      >
                                        {remaining === 0
                                          ? "✓ Completo"
                                          : `Faltam ${remaining}`}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => scrollGroup(g.id, -1)}
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                                      style={{
                                        background: "rgba(255,255,255,.17)",
                                      }}
                                      aria-label={`Rolar ${g.name} pra esquerda`}
                                    >
                                      <ChevronLeft size={15} />
                                    </button>
                                    <div
                                      ref={(el) => {
                                        scrollRefs.current[g.id] = el;
                                      }}
                                      className="flex gap-2.5 overflow-x-auto scroll-smooth"
                                      style={{ scrollbarWidth: "none" }}
                                    >
                                      {g.options.map((opt) => {
                                        const selected = (
                                          buildSelections[g.id] || []
                                        ).some(
                                          (s) =>
                                            s.complementOptionId === opt.id,
                                        );
                                        return (
                                          <button
                                            key={opt.id}
                                            onClick={() => toggleMulti(g, opt)}
                                            className="bg-[#FFF9F2] rounded-[16px] overflow-hidden text-left shrink-0 w-[92px] transition active:scale-[.98]"
                                            style={
                                              selected
                                                ? {
                                                    boxShadow: `0 0 0 3px ${VERDE}`,
                                                  }
                                                : undefined
                                            }
                                          >
                                            <div className="h-[67px] bg-[#F2EAE2] relative">
                                              <img
                                                src={
                                                  opt.imageUrl ||
                                                  PLACEHOLDER_IMG
                                                }
                                                alt=""
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                  e.currentTarget.src =
                                                    PLACEHOLDER_IMG;
                                                }}
                                              />
                                              {selected && (
                                                <span
                                                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                                                  style={{ background: VERDE }}
                                                >
                                                  <Check
                                                    size={12}
                                                    strokeWidth={3}
                                                  />
                                                </span>
                                              )}
                                            </div>
                                            <p
                                              className="text-[11px] font-black px-2 py-1.5 truncate"
                                              style={{ color: GRAFITE }}
                                            >
                                              {opt.name}
                                            </p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      onClick={() => scrollGroup(g.id, 1)}
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                                      style={{
                                        background: "rgba(255,255,255,.17)",
                                      }}
                                      aria-label={`Rolar ${g.name} pra direita`}
                                    >
                                      <ChevronRight size={15} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                          {buildGroups.some((g) => !g.required) && (
                            <div className="grid grid-cols-2 gap-3">
                              {buildGroups
                                .filter((g) => !g.required)
                                .map((g, gi) => {
                                  const tileColor =
                                    gi % 2 === 0 ? VERDE : VINHO;
                                  return (
                                    <div
                                      key={g.id}
                                      ref={(el) => {
                                        sectionRefs.current[g.id] = el;
                                      }}
                                      className="rounded-[18px] overflow-hidden shadow-[0_5px_0_rgba(54,17,4,.2)]"
                                      style={{ background: tileColor }}
                                    >
                                      <p className="text-white font-black text-[15px] px-3 pt-2.5">
                                        {g.name}
                                      </p>
                                      <div
                                        className="flex gap-2 p-2.5 overflow-x-auto"
                                        style={{ scrollbarWidth: "none" }}
                                      >
                                        {g.options.map((opt) => {
                                          const selected = (
                                            buildSelections[g.id] || []
                                          ).some(
                                            (s) =>
                                              s.complementOptionId === opt.id,
                                          );
                                          return (
                                            <button
                                              key={opt.id}
                                              onClick={() =>
                                                g.multipleChoice
                                                  ? toggleMulti(g, opt)
                                                  : toggleSingle(g, opt)
                                              }
                                              className="rounded-xl overflow-hidden shrink-0 w-[70px] transition active:scale-[.97]"
                                              style={{
                                                boxShadow: selected
                                                  ? "0 0 0 3px rgba(255,255,255,.9)"
                                                  : undefined,
                                              }}
                                            >
                                              <img
                                                src={
                                                  opt.imageUrl ||
                                                  PLACEHOLDER_IMG
                                                }
                                                alt=""
                                                className="w-full h-[52px] object-cover"
                                                onError={(e) => {
                                                  e.currentTarget.src =
                                                    PLACEHOLDER_IMG;
                                                }}
                                              />
                                              <p className="text-[10px] font-black text-white bg-black/20 px-1 py-1 truncate">
                                                {opt.name}
                                              </p>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}

                          <button
                            onClick={confirmBuild}
                            disabled={!buildReady}
                            className="w-full h-12 rounded-full font-black uppercase text-[14px] text-white transition active:scale-[.99] disabled:opacity-40 shadow-[0_4px_0_rgba(0,0,0,.2)]"
                            style={{ background: VERDE }}
                          >
                            Adicionar ao Carrinho — R$ {fmt(buildTotal)}
                          </button>
                        </>
                      )}
                  </>
                ) : (
                  <div
                    className="rounded-[20px] p-4 shadow-[0_5px_0_rgba(54,17,4,.24)]"
                    style={{
                      background: `linear-gradient(145deg, #F47712 0%, #C84A0B 100%)`,
                    }}
                  >
                    <h2 className="text-white font-black text-[19px] uppercase mb-3">
                      {activeCategoryLabel}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => openBuilder(p)}
                          className="bg-[#FFF9F2] rounded-[16px] overflow-hidden text-left transition active:scale-[.98] hover:shadow-lg"
                        >
                          <div className="h-[86px] bg-[#F2EAE2] overflow-hidden">
                            <img
                              src={p.imageUrl || PLACEHOLDER_IMG}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.src !== PLACEHOLDER_IMG)
                                  img.src = PLACEHOLDER_IMG;
                              }}
                            />
                          </div>
                          <div className="p-2.5">
                            <h3 className="font-black text-[#3B241A] text-xs truncate">
                              {p.name}
                            </h3>
                            <p
                              className="font-black text-sm mt-0.5"
                              style={{ color: LARANJA }}
                            >
                              {Number(p.salePrice) > 0 ||
                              (p.sizes && p.sizes.length)
                                ? `R$ ${priceLabel(p)}`
                                : "Monte a sua"}
                            </p>
                          </div>
                        </button>
                      ))}
                      {filteredProducts.length === 0 && (
                        <p className="col-span-full text-sm text-white/65 text-center py-10">
                          Nenhum item nesta categoria
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!cash && (
                  <div
                    id="open-cash-inline"
                    className="mt-1 bg-white rounded-[18px] p-4 max-w-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <DoorOpen size={18} style={{ color: LARANJA }} />
                      <h2
                        className="text-sm font-black"
                        style={{ color: GRAFITE }}
                      >
                        Abrir caixa
                      </h2>
                    </div>
                    <label className="block text-[11px] font-black text-gray-500 uppercase mb-1.5">
                      Valor de abertura
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={openingValue}
                      onChange={(e) => setOpeningValue(e.target.value)}
                      className="w-full border border-[#E6D8CB] rounded-xl px-3 py-2.5 text-lg font-black mb-3"
                      style={{ color: GRAFITE }}
                    />
                    <button
                      onClick={openRegister}
                      className="w-full h-11 rounded-full text-white font-black transition active:scale-[.98]"
                      style={{ background: LARANJA }}
                    >
                      Abrir Caixa
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Carrinho com painel branco, linhas compactas e ações verdes da referência */}
            <aside
              className="w-[278px] shrink-0 flex flex-col justify-between p-3.5 border-l border-[#E8D7C8]"
              style={{ background: CREME }}
            >
              <div className="flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h2
                    className="text-[22px] font-black uppercase"
                    style={{ color: GRAFITE }}
                  >
                    Carrinho
                  </h2>
                  <span
                    className="text-[12px] font-black"
                    style={{ color: "#9A3412" }}
                  >
                    {itemCount} item(ns)
                  </span>
                </div>
                <div
                  className="rounded-[15px] bg-white overflow-y-auto max-h-[50vh]"
                  style={{ border: "1px solid #E9D9CC" }}
                >
                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-10 px-3">
                      Clique num item pra começar
                    </p>
                  ) : (
                    cart.map((l) => (
                      <div
                        key={l.key}
                        className="px-2.5 py-3"
                        style={{ borderBottom: "1px solid #EDE7E2" }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-[9px] overflow-hidden shrink-0 bg-[#F2EAE2]">
                            <img
                              src={l.imageUrl || PLACEHOLDER_IMG}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = PLACEHOLDER_IMG;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-black text-[12px] truncate"
                              style={{ color: GRAFITE }}
                            >
                              {l.name}
                            </p>
                            {l.size && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Porção {l.size.toLowerCase()}
                              </p>
                            )}
                            <p
                              className="font-black text-[12px] mt-0.5"
                              style={{ color: "#B84B16" }}
                            >
                              R$ {fmt(l.unitPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => decLine(l.key)}
                              aria-label={`Diminuir quantidade de ${l.name}`}
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                              style={{
                                background: "#F3E6DB",
                                color: "#9A3412",
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <span
                              className="text-xs font-black w-4 text-center"
                              style={{ color: GRAFITE }}
                            >
                              {l.qty}
                            </span>
                            <button
                              onClick={() => incLine(l.key)}
                              aria-label={`Aumentar quantidade de ${l.name}`}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                              style={{ background: LARANJA }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        {l.notes && (
                          <div className="flex flex-wrap gap-1 mt-2 pl-12">
                            {l.notes.split(", ").map((tag, i) => (
                              <span
                                key={i}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: CREME, color: "#6B4A3A" }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div
                className="rounded-[18px] p-3.5 mt-3 bg-white"
                style={{ border: "1px solid #E9D9CC" }}
              >
                {lastOrderNumber !== null && (
                  <p className="text-[11px] mb-2" style={{ color: LARANJA }}>
                    Último fechado: #{lastOrderNumber}
                  </p>
                )}
                <div className="flex justify-between text-[12px] mb-2">
                  <span style={{ color: "#8B6E5D" }}>Subtotal</span>
                  <span className="font-black" style={{ color: GRAFITE }}>
                    R$ {fmt(total)}
                  </span>
                </div>
                <div
                  className="flex justify-between items-center pt-2.5"
                  style={{ borderTop: "1px solid #EADDD3" }}
                >
                  <span
                    className="font-black text-[15px]"
                    style={{ color: GRAFITE }}
                  >
                    TOTAL:
                  </span>
                  <span
                    className="font-black text-[22px]"
                    style={{ color: GRAFITE }}
                  >
                    R$ {fmt(total)}
                  </span>
                </div>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full h-11 rounded-full font-black uppercase text-[13px] text-white flex items-center justify-center gap-1.5 transition active:scale-[.98] disabled:opacity-40 mt-3"
                  style={{ background: VERDE }}
                >
                  <CheckCircle2 size={16} />
                  Finalizar pedido
                </button>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full h-11 rounded-full font-black uppercase text-[13px] text-white flex items-center justify-center gap-1.5 transition active:scale-[.98] disabled:opacity-40 mt-2"
                  style={{
                    background: VERDE,
                    opacity: cart.length ? 0.9 : undefined,
                  }}
                >
                  <CreditCard size={16} />
                  Pagar agora
                </button>
              </div>
            </aside>
          </div>
        )}

        {paymentOpen && (
          <div
            className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4"
            onClick={() => setPaymentOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
              <p
                className="text-2xl font-black mb-4"
                style={{ color: GRAFITE }}
              >
                R${" "}
                {fmt(
                  total +
                    (orderDetails.orderType === "DELIVERY"
                      ? parseFloat(
                          (orderDetails.deliveryFee ?? "").replace(",", "."),
                        ) || 0
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

              <div className="space-y-2">
                {[
                  { m: "CASH", l: "Dinheiro" },
                  { m: "PIX", l: "PIX" },
                  { m: "CREDIT_CARD", l: "Cartão de crédito" },
                  { m: "DEBIT_CARD", l: "Cartão de débito" },
                ].map((p) => (
                  <button
                    key={p.m}
                    disabled={submitting || !detailsReady}
                    onClick={() => finalizeSale(p.m)}
                    className="w-full h-11 rounded-full border font-black text-sm disabled:opacity-40 transition active:scale-[.98]"
                    style={{ borderColor: "#E6D8CB", color: GRAFITE }}
                  >
                    {p.l}
                  </button>
                ))}
                {!detailsReady && (
                  <p className="text-[11px] text-center" style={{ color: VINHO }}>
                    {orderDetails.orderType === "DINE_IN"
                      ? "Informe o número da mesa pra liberar o pagamento"
                      : "Informe rua e número pra liberar o pagamento"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}
