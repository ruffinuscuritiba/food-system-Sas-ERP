"use client";

/**
 * Frente de Caixa — módulo Mercado/Conveniência (mesma tela pros dois
 * segmentos, ver lib/segmentLabels.ts isMercadoStylePdv).
 *
 * Layout inspirado em terminais de varejo tipo Dynamics 365 Retail POS:
 * tabela de linhas em destaque, linha selecionável, rail de ações à direita,
 * e uma barra inferior fixa com cliente/fidelidade + resumo + total.
 * Toda ação do rail mapeia pra uma capacidade real do sistema (nada de botão
 * decorativo sem função por trás) — não existe scanner de fidelidade nem
 * cartão-presente no FoodSaaS hoje, por isso não entraram na grade.
 *
 * Suporta produto por peso (balança manual), múltiplos caixas simultâneos
 * via `Cash.registerNumber` e venda suspensa/retomada por teclado (F5/F9).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import {
  Barcode,
  DoorOpen,
  User,
  Percent,
  PauseCircle,
  CreditCard,
  Search,
  Minus,
  Plus,
  Trash2,
  PlayCircle,
  Hash,
  MessageSquare,
  Banknote,
  QrCode,
  ArrowLeft,
  Award,
  RefreshCw,
  XCircle,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  salePrice: number;
  categoryId?: string | null;
  barcode?: string | null;
  sku?: string | null;
  eanCode?: string | null;
  pluCode?: string | null;
  isWeighted?: boolean;
  pricePerKg?: number | null;
};

type Category = {
  id: string;
  name: string;
};

type CartLine = {
  key: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  isWeighted: boolean;
  note: string;
};

type Cash = {
  id: string;
  registerNumber: number | null;
  balance: number;
  isOpen: boolean;
};

type LoyaltyInfo = { totalPoints: number; totalCashback: number } | null;

const REGISTER_KEY = "mercado_register_number";
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MercadoPdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");
  const [registerChoice, setRegisterChoice] = useState<number>(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [weightPrompt, setWeightPrompt] = useState<Product | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [qtyPromptOpen, setQtyPromptOpen] = useState(false);
  const [qtyPromptValue, setQtyPromptValue] = useState("");
  const [notePromptOpen, setNotePromptOpen] = useState(false);
  const [notePromptValue, setNotePromptValue] = useState("");
  const [tab, setTab] = useState<"itens" | "pagamento">("itens");
  const [paidValue, setPaidValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [customerName, setCustomerName] = useState("Balcão");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyInfo>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((s, l) => s + l.lineTotal, 0);
  const discount = Math.min(Number(discountValue.replace(",", ".")) || 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((s, l) => s + (l.isWeighted ? 1 : l.qty), 0);
  const selectedLine = cart.find((l) => l.key === selectedKey) || null;

  const loadProducts = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([api.get("/products"), api.get("/categories")]);
      const nextProducts: Product[] = Array.isArray(pRes.data) ? pRes.data : [];
      const nextCategories: Category[] = Array.isArray(cRes.data) ? cRes.data : [];
      setProducts(nextProducts);
      const ids = new Set(nextProducts.map((p) => p.categoryId).filter(Boolean));
      setCategories(nextCategories.filter((c) => ids.has(c.id)));
    } catch {
      toast.error("Erro ao carregar produtos");
    }
  }, []);

  const checkCash = useCallback(async () => {
    setCheckingCash(true);
    try {
      const savedNumber = Number(localStorage.getItem(REGISTER_KEY) || "0") || null;
      const r = await api.get("/cash/registers");
      const open: Cash[] = Array.isArray(r.data) ? r.data : [];
      const mine = savedNumber ? open.find((c) => c.registerNumber === savedNumber) : open[0];
      setCash(mine || null);
      if (mine) await loadProducts();
    } catch {
      /* silent — mostra tela de abrir caixa */
    } finally {
      setCheckingCash(false);
    }
  }, [loadProducts]);

  useEffect(() => { checkCash(); }, [checkCash]);
  useEffect(() => {
    if (cash && !weightPrompt && !qtyPromptOpen && !notePromptOpen && tab === "itens") scanRef.current?.focus();
  }, [cash, weightPrompt, qtyPromptOpen, notePromptOpen, tab, cart.length]);
  useEffect(() => { if (weightPrompt) weightRef.current?.focus(); }, [weightPrompt]);

  async function openRegister() {
    const value = Number(openingValue.replace(",", "."));
    if (!openingValue || isNaN(value) || value < 0) { toast.error("Informe o valor de abertura"); return; }
    try {
      const r = await api.post("/cash/open", {
        openingValue: value,
        registerNumber: registerChoice,
        operatorName: user?.name,
      });
      localStorage.setItem(REGISTER_KEY, String(registerChoice));
      setCash(r.data);
      toast.success(`Caixa ${registerChoice} aberto`);
      await loadProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao abrir caixa");
    }
  }

  function addLine(product: Product, qty: number) {
    const isWeighted = !!product.isWeighted;
    const unitPrice = isWeighted ? Number(product.pricePerKg || 0) : Number(product.salePrice || 0);
    let newKey = "";
    setCart((prev) => {
      if (!isWeighted) {
        const existing = prev.find((l) => l.productId === product.id);
        if (existing) {
          newKey = existing.key;
          return prev.map((l) => l.productId === product.id
            ? { ...l, qty: l.qty + qty, lineTotal: (l.qty + qty) * l.unitPrice }
            : l);
        }
      }
      newKey = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return [...prev, {
        key: newKey,
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
        isWeighted,
        note: "",
      }];
    });
    setSelectedKey(newKey || null);
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    const match = products.find(
      (p) => p.barcode === code || p.eanCode === code || p.sku === code || p.pluCode === code,
    );
    setScanValue("");
    if (!match) { toast.error(`Produto não encontrado: ${code}`); return; }
    if (match.isWeighted) { setWeightPrompt(match); return; }
    addLine(match, 1);
  }

  function confirmWeight(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(weightValue.replace(",", "."));
    if (!weightPrompt || !kg || kg <= 0) { toast.error("Peso inválido"); return; }
    addLine(weightPrompt, kg);
    setWeightPrompt(null);
    setWeightValue("");
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) => prev.map((l) => {
      if (l.key !== key || l.isWeighted) return l;
      const nextQty = Math.max(1, l.qty + delta);
      return { ...l, qty: nextQty, lineTotal: nextQty * l.unitPrice };
    }));
  }

  function setExactQty(key: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty, lineTotal: qty * l.unitPrice } : l)));
  }

  function setLineNote(key: string, note: string) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, note } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
    setSelectedKey((k) => (k === key ? null : k));
  }

  function openQtyPrompt() {
    if (!selectedLine || selectedLine.isWeighted) return;
    setQtyPromptValue(String(selectedLine.qty));
    setQtyPromptOpen(true);
  }

  function confirmQtyPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLine) return;
    const qty = Math.max(1, Number(qtyPromptValue) || 1);
    setExactQty(selectedLine.key, qty);
    setQtyPromptOpen(false);
  }

  function openNotePrompt() {
    if (!selectedLine) return;
    setNotePromptValue(selectedLine.note);
    setNotePromptOpen(true);
  }

  function confirmNotePrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLine) return;
    setLineNote(selectedLine.key, notePromptValue.trim());
    setNotePromptOpen(false);
  }

  function suspendSale() {
    if (cart.length === 0) return;
    localStorage.setItem(`mercado_suspended_${cash?.id}`, JSON.stringify(cart));
    setCart([]);
    setSelectedKey(null);
    toast("Venda suspensa", { icon: "⏸️" });
  }

  function resumeSale() {
    const raw = localStorage.getItem(`mercado_suspended_${cash?.id}`);
    if (!raw) { toast.error("Nenhuma venda suspensa"); return; }
    setCart(JSON.parse(raw));
    localStorage.removeItem(`mercado_suspended_${cash?.id}`);
  }

  function cancelSale() {
    if (cart.length === 0) return;
    if (!confirm("Cancelar a venda atual? Todos os itens serão removidos.")) return;
    setCart([]);
    setSelectedKey(null);
    setDiscountValue("");
    setTab("itens");
  }

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || p.name.toLowerCase().includes(q);
    const matchesCategory = !activeCategory || p.categoryId === activeCategory;
    return matchesQuery && matchesCategory;
  });

  async function lookupLoyalty() {
    const phone = customerPhone.trim();
    if (!phone || !user?.companyId) { setLoyalty(null); return; }
    setLoyaltyLoading(true);
    try {
      const r = await api.get("/loyalty/balance", { params: { phone, companyId: user.companyId } });
      setLoyalty({ totalPoints: Number(r.data?.totalPoints || 0), totalCashback: Number(r.data?.totalCashback || 0) });
    } catch {
      setLoyalty(null);
    } finally {
      setLoyaltyLoading(false);
    }
  }

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0 || !cash) return;
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: customerName.trim() || "Cliente balcão",
        customerPhone: customerPhone.trim(),
        deliveryAddress: "BALCAO",
        orderType: "DINE_IN",
        channel: "PDV",
        cashId: cash.id,
        paymentMethod,
        notes: `Caixa ${cash.registerNumber ?? ""}`.trim(),
        discount,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          notes: l.note || "",
          unitPrice: l.unitPrice,
        })),
        subtotal,
        deliveryFee: 0,
        total,
      });
      if (orderRes.data?.id) {
        await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      }
      toast.success(`Venda finalizada — R$ ${fmt(total)}`);
      setCart([]);
      setSelectedKey(null);
      setTab("itens");
      setPaidValue("");
      setDiscountValue("");
      setCustomerName("Balcão");
      setCustomerPhone("");
      setLoyalty(null);
      loadProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao finalizar venda");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!cash) return;
      if (e.key === "F6") { e.preventDefault(); if (cart.length) setTab("pagamento"); }
      if (e.key === "F5") { e.preventDefault(); suspendSale(); }
      if (e.key === "F9") { e.preventDefault(); resumeSale(); }
      if (e.key === "Escape") { setWeightPrompt(null); setQtyPromptOpen(false); setNotePromptOpen(false); setTab("itens"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cash, cart, total]);

  const paid = Number(paidValue.replace(",", ".")) || 0;
  const change = paid >= total ? paid - total : 0;

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="h-screen flex flex-col bg-white text-gray-900 font-sans overflow-hidden">
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Carregando...</div>
        ) : !cash ? (
          <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
              <div className="flex items-center gap-2 mb-6">
                <DoorOpen size={20} className="text-blue-600" />
                <h1 className="text-lg font-bold">Abrir caixa</h1>
              </div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Número do caixa</label>
              <div className="grid grid-cols-5 gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRegisterChoice(n)}
                    className={`h-11 rounded-lg border text-sm font-bold ${registerChoice === n ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Valor de abertura</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={openingValue}
                onChange={(e) => setOpeningValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-5"
                autoFocus
              />
              <button onClick={openRegister} className="w-full h-11 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700">
                Abrir Caixa {registerChoice}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* TOPBAR escura — breadcrumb, busca, operador */}
            <header className="bg-[#14161a] text-white px-4 py-2 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-gray-200 whitespace-nowrap">Frente de Caixa</span>
                <span className="text-gray-600">›</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">Caixa {cash.registerNumber ?? "—"}</span>
              </div>
              <form onSubmit={handleScan} className="flex-1 max-w-md">
                <div className="relative">
                  <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    ref={scanRef}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Bipar código, PLU ou SKU..."
                    className="w-full bg-[#22252b] border border-[#33363d] rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                  />
                </div>
              </form>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={loadProducts} title="Atualizar catálogo" className="text-gray-400 hover:text-white p-1.5 rounded-md hover:bg-white/5">
                  <RefreshCw size={15} />
                </button>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Caixa aberto
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                    {(user?.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-300 hidden sm:inline">{user?.name}</span>
                </div>
              </div>
            </header>

            {/* TABS Itens / Pagamento */}
            <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-6 shrink-0">
              <button
                onClick={() => setTab("itens")}
                className={`py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === "itens" ? "border-emerald-500 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                Itens
              </button>
              <button
                onClick={() => cart.length && setTab("pagamento")}
                disabled={!cart.length}
                className={`py-2.5 text-sm font-semibold border-b-2 -mb-px transition disabled:opacity-40 disabled:cursor-not-allowed ${tab === "pagamento" ? "border-emerald-500 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                Pagamento
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Coluna principal */}
              <div className="flex-1 flex overflow-hidden min-w-0">
                {tab === "itens" ? (
                  <>
                    {/* Catálogo */}
                    <section className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
                      <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nome..."
                            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5 p-3 overflow-x-auto border-b border-gray-100">
                        <button
                          onClick={() => setActiveCategory(null)}
                          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${activeCategory === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          Todos
                        </button>
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${activeCategory === c.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {filteredProducts.length === 0 ? (
                          <p className="text-center text-gray-300 text-sm py-8">Nenhum produto encontrado</p>
                        ) : filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => p.isWeighted ? setWeightPrompt(p) : addLine(p, 1)}
                            className="w-full flex items-center justify-between gap-2 text-left border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 hover:border-emerald-300 transition"
                          >
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span className="text-sm font-bold text-gray-700 shrink-0">
                              {p.isWeighted ? `R$ ${fmt(Number(p.pricePerKg || 0))}/kg` : `R$ ${fmt(p.salePrice)}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Tabela de linhas */}
                    <section className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
                      <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                            Aguardando bipagem — busque um produto ao lado ou use o leitor.
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wide z-10">
                              <tr>
                                <th className="text-left font-medium px-4 py-2">Item</th>
                                <th className="text-center font-medium px-2 py-2 w-32">Quantidade</th>
                                <th className="text-right font-medium px-3 py-2">Preço unit.</th>
                                <th className="text-right font-medium px-4 py-2">Total</th>
                                <th className="w-12"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {cart.map((l) => {
                                const isSelected = l.key === selectedKey;
                                return (
                                  <tr
                                    key={l.key}
                                    onClick={() => setSelectedKey(l.key)}
                                    className={`border-t cursor-pointer transition ${isSelected ? "bg-emerald-500 text-white border-emerald-500" : "border-gray-100 hover:bg-gray-50"}`}
                                  >
                                    <td className="px-4 py-2.5 font-medium">
                                      {l.name}
                                      {l.note && (
                                        <span className={`block text-[11px] font-normal ${isSelected ? "text-emerald-50" : "text-gray-400"}`}>{l.note}</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                                      {l.isWeighted ? (
                                        <span className="inline-block text-sm font-bold px-2">{fmt(l.qty)}kg</span>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => changeQty(l.key, -1)}
                                            className={`w-6 h-6 flex items-center justify-center rounded border ${isSelected ? "border-white/40 text-white hover:bg-white/10" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                                          >
                                            <Minus size={13} />
                                          </button>
                                          <span className="w-7 text-center text-sm font-bold">{l.qty}</span>
                                          <button
                                            onClick={() => changeQty(l.key, 1)}
                                            className={`w-6 h-6 flex items-center justify-center rounded border ${isSelected ? "border-white/40 text-white hover:bg-white/10" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                                          >
                                            <Plus size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="text-right px-3 py-2.5">{fmt(l.unitPrice)}</td>
                                    <td className="text-right px-4 py-2.5 font-semibold">{fmt(l.lineTotal)}</td>
                                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => removeLine(l.key)}
                                        className={isSelected ? "text-white/70 hover:text-white" : "text-gray-300 hover:text-red-500"}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  /* Aba Pagamento — inline, mesmo lugar da tabela */
                  <section className="flex-1 flex flex-col items-center justify-center bg-white p-6 overflow-y-auto">
                    <div className="w-full max-w-sm">
                      <button onClick={() => setTab("itens")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4">
                        <ArrowLeft size={13} /> Voltar pros itens
                      </button>
                      <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
                      <p className="text-3xl font-bold mb-5">R$ {fmt(total)}</p>

                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Valor recebido (dinheiro)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={paidValue}
                        onChange={(e) => setPaidValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-2"
                        autoFocus
                      />
                      {paid >= total && paid > 0 && (
                        <p className="text-sm text-emerald-600 font-semibold mb-3">Troco: R$ {fmt(change)}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {[
                          { m: "CASH", l: "Dinheiro", icon: Banknote },
                          { m: "PIX", l: "PIX", icon: QrCode },
                          { m: "CREDIT_CARD", l: "Crédito", icon: CreditCard },
                          { m: "DEBIT_CARD", l: "Débito", icon: CreditCard },
                        ].map((p) => (
                          <button
                            key={p.m}
                            disabled={submitting}
                            onClick={() => finalizeSale(p.m)}
                            className="h-14 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold text-sm disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                          >
                            <p.icon size={16} />
                            {p.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* RAIL de ações — dark, grade de tiles */}
              <aside className="w-56 shrink-0 bg-[#14161a] text-white flex flex-col overflow-y-auto">
                <div className="p-3 grid grid-cols-2 gap-2">
                  <RailTile icon={Hash} label="Definir quantidade" onClick={openQtyPrompt} disabled={!selectedLine || selectedLine.isWeighted} />
                  <RailTile icon={MessageSquare} label="Comentário na linha" onClick={openNotePrompt} disabled={!selectedLine} />
                  <RailTile icon={Trash2} label="Remover linha" onClick={() => selectedLine && removeLine(selectedLine.key)} disabled={!selectedLine} />
                  <RailTile icon={Percent} label="Desconto na venda" onClick={() => document.getElementById("discount-input")?.focus()} disabled={cart.length === 0} />
                  <RailTile icon={PauseCircle} label="Suspender (F5)" onClick={suspendSale} disabled={cart.length === 0} />
                  <RailTile icon={PlayCircle} label="Retomar (F9)" onClick={resumeSale} />
                  <RailTile icon={XCircle} label="Cancelar venda" onClick={cancelSale} disabled={cart.length === 0} tone="danger" />
                  <RailTile icon={DoorOpen} label="Trocar caixa" onClick={() => { localStorage.removeItem(REGISTER_KEY); setCash(null); }} />
                </div>
                <div className="mt-auto p-3">
                  <button
                    onClick={() => cart.length && setTab("pagamento")}
                    disabled={!cart.length}
                    className="w-full text-sm py-3 rounded-lg bg-emerald-500 text-gray-950 font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <CreditCard size={16} />Pagamento (F6)
                  </button>
                </div>
              </aside>
            </div>

            {/* BARRA INFERIOR — cliente / resumo / total */}
            <footer className="shrink-0 bg-white border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
              <div className="p-3 flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase"><User size={11} /> Cliente</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Balcão"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={lookupLoyalty}
                  onKeyDown={(e) => e.key === "Enter" && lookupLoyalty()}
                  placeholder="Telefone (opcional — busca fidelidade)"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                {loyaltyLoading ? (
                  <span className="text-[11px] text-gray-400">Buscando fidelidade...</span>
                ) : loyalty ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                    <Award size={12} /> {loyalty.totalPoints} pts · R$ {fmt(loyalty.totalCashback)} cashback
                  </span>
                ) : null}
              </div>

              <div className="p-3 flex flex-col gap-1 justify-center text-sm">
                <div className="flex justify-between text-gray-500"><span>Linhas</span><span>{cart.length}</span></div>
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>R$ {fmt(subtotal)}</span></div>
                <div className="flex justify-between text-gray-500 items-center">
                  <span>Desconto (R$)</span>
                  <input
                    id="discount-input"
                    type="text"
                    inputMode="decimal"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0,00"
                    className="w-24 border border-gray-200 rounded px-2 py-0.5 text-right text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-bold">Total ({itemCount} itens)</p>
                  <p className="text-3xl font-bold text-emerald-600 tabular-nums">R$ {fmt(total)}</p>
                </div>
                <button
                  onClick={() => cart.length && setTab("pagamento")}
                  disabled={!cart.length}
                  className="w-14 h-14 rounded-xl bg-emerald-500 text-gray-950 flex items-center justify-center hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="Ir para pagamento"
                >
                  <CreditCard size={22} />
                </button>
              </div>
            </footer>
          </>
        )}

        {weightPrompt && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setWeightPrompt(null)}>
            <form onSubmit={confirmWeight} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-sm font-bold mb-1">{weightPrompt.name}</p>
              <p className="text-xs text-gray-400 mb-3">R$ {fmt(Number(weightPrompt.pricePerKg || 0))}/kg</p>
              <input
                ref={weightRef}
                inputMode="decimal"
                placeholder="Peso em kg"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-3"
              />
              <button type="submit" className="w-full h-10 rounded-lg bg-emerald-500 text-gray-950 font-bold">Adicionar</button>
            </form>
          </div>
        )}

        {qtyPromptOpen && selectedLine && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setQtyPromptOpen(false)}>
            <form onSubmit={confirmQtyPrompt} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-sm font-bold mb-3">Definir quantidade — {selectedLine.name}</p>
              <input
                autoFocus
                type="number"
                min={1}
                value={qtyPromptValue}
                onChange={(e) => setQtyPromptValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-3"
              />
              <button type="submit" className="w-full h-10 rounded-lg bg-emerald-500 text-gray-950 font-bold">Aplicar</button>
            </form>
          </div>
        )}

        {notePromptOpen && selectedLine && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setNotePromptOpen(false)}>
            <form onSubmit={confirmNotePrompt} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-sm font-bold mb-3">Comentário na linha — {selectedLine.name}</p>
              <input
                autoFocus
                value={notePromptValue}
                onChange={(e) => setNotePromptValue(e.target.value)}
                placeholder="Ex.: sem sacola, embalar separado..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3"
              />
              <button type="submit" className="w-full h-10 rounded-lg bg-emerald-500 text-gray-950 font-bold">Salvar</button>
            </form>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}

function RailTile({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-20 rounded-lg flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold text-center px-1.5 transition disabled:opacity-30 disabled:cursor-not-allowed ${
        tone === "danger" ? "bg-red-950/40 hover:bg-red-950/60 text-red-300" : "bg-[#22252b] hover:bg-[#2b2e35] text-gray-200"
      }`}
    >
      <Icon size={18} />
      <span className="leading-tight">{label}</span>
    </button>
  );
}
