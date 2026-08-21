"use client";

/**
 * Frente de Caixa — módulo Mercado.
 *
 * Terminal de supermercado em tela cheia com três zonas:
 *   1. Busca e catálogo (leitor de código/PLU + busca por nome + categorias)
 *   2. Lista da venda (itens, quantidades, remoção)
 *   3. Resumo fixo à direita (total, recebido, troco, formas de pagamento)
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
  XCircle,
  Search,
  Minus,
  Plus,
  Trash2,
  PlayCircle,
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
};

type Cash = {
  id: string;
  registerNumber: number | null;
  balance: number;
  isOpen: boolean;
};

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
  const [weightPrompt, setWeightPrompt] = useState<Product | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidValue, setPaidValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [customerName, setCustomerName] = useState("Balcão");

  const scanRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((s, l) => s + l.lineTotal, 0);
  const discount = Math.min(Number(discountValue.replace(",", ".")) || 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((s, l) => s + (l.isWeighted ? 1 : l.qty), 0);

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
  useEffect(() => { if (cash && !weightPrompt) scanRef.current?.focus(); }, [cash, weightPrompt, cart.length]);
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
    setCart((prev) => {
      if (!isWeighted) {
        const existing = prev.find((l) => l.productId === product.id);
        if (existing) {
          return prev.map((l) => l.productId === product.id
            ? { ...l, qty: l.qty + qty, lineTotal: (l.qty + qty) * l.unitPrice }
            : l);
        }
      }
      return [...prev, {
        key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        lineTotal: qty * unitPrice,
        isWeighted,
      }];
    });
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

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function suspendSale() {
    if (cart.length === 0) return;
    localStorage.setItem(`mercado_suspended_${cash?.id}`, JSON.stringify(cart));
    setCart([]);
    toast("Venda suspensa", { icon: "⏸️" });
  }

  function resumeSale() {
    const raw = localStorage.getItem(`mercado_suspended_${cash?.id}`);
    if (!raw) { toast.error("Nenhuma venda suspensa"); return; }
    setCart(JSON.parse(raw));
    localStorage.removeItem(`mercado_suspended_${cash?.id}`);
  }

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || p.name.toLowerCase().includes(q);
    const matchesCategory = !activeCategory || p.categoryId === activeCategory;
    return matchesQuery && matchesCategory;
  });

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0 || !cash) return;
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: customerName.trim() || "Cliente balcão",
        customerPhone: "",
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
          notes: "",
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
      setPaymentOpen(false);
      setPaidValue("");
      setDiscountValue("");
      setCustomerName("Balcão");
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
      if (e.key === "F6") { e.preventDefault(); if (cart.length) setPaymentOpen(true); }
      if (e.key === "F5") { e.preventDefault(); suspendSale(); }
      if (e.key === "F9") { e.preventDefault(); resumeSale(); }
      if (e.key === "Escape") { setPaymentOpen(false); setWeightPrompt(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cash, cart, total]);

  const paid = Number(paidValue.replace(",", ".")) || 0;
  const change = paid >= total ? paid - total : 0;

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="h-screen flex flex-col bg-gray-100 text-gray-900 font-sans overflow-hidden">
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Carregando...</div>
        ) : !cash ? (
          <div className="flex items-center justify-center h-screen">
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
            {/* Header — caixa ativo */}
            <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Caixa {cash.registerNumber ?? "—"}</span>
                <span className="text-xs text-gray-400">{user?.name}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Caixa aberto
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* Zona 1 — Busca + catálogo */}
              <section className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
                <form onSubmit={handleScan} className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={scanRef}
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      placeholder="Bipar código ou PLU"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                </form>
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${activeCategory === null ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    Todos
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${activeCategory === c.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
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
                      className="w-full flex items-center justify-between gap-2 text-left border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 hover:border-blue-300 transition"
                    >
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <span className="text-sm font-bold text-blue-700 shrink-0">
                        {p.isWeighted ? `R$ ${fmt(Number(p.pricePerKg || 0))}/kg` : `R$ ${fmt(p.salePrice)}`}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Zona 2 — Venda atual */}
              <section className="flex-1 flex flex-col min-w-0 bg-white">
                <div className="flex-1 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                      Aguardando bipagem — busque um produto ao lado ou use o leitor.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-gray-400 text-xs z-10">
                        <tr>
                          <th className="text-left font-normal px-4 py-2">Item</th>
                          <th className="text-center font-normal px-2 py-2 w-28">Qtd</th>
                          <th className="text-right font-normal px-3 py-2">Unit.</th>
                          <th className="text-right font-normal px-4 py-2">Total</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((l) => (
                          <tr key={l.key} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium">{l.name}</td>
                            <td className="px-2 py-2">
                              {l.isWeighted ? (
                                <span className="inline-block text-sm font-bold px-2">{fmt(l.qty)}kg</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => changeQty(l.key, -1)}
                                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="w-7 text-center text-sm font-bold">{l.qty}</span>
                                  <button
                                    onClick={() => changeQty(l.key, 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="text-right px-3 py-2">{fmt(l.unitPrice)}</td>
                            <td className="text-right px-4 py-2 font-semibold">{fmt(l.lineTotal)}</td>
                            <td className="text-center">
                              <button onClick={() => removeLine(l.key)} className="text-gray-300 hover:text-red-500">
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* Zona 3 — Resumo fixo */}
              <aside className="w-80 shrink-0 bg-gray-900 text-white flex flex-col">
                <div className="p-4 border-b border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Total da venda</div>
                  <div className="text-4xl font-bold tabular-nums">R$ {fmt(total)}</div>
                  <div className="text-xs text-gray-400 mt-1">{itemCount} itens</div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <button onClick={suspendSale} disabled={!cart.length} className="flex-1 text-xs py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
                      <PauseCircle size={14} />F5 Suspender
                    </button>
                    <button onClick={resumeSale} className="flex-1 text-xs py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center gap-1.5">
                      <PlayCircle size={14} />F9 Retomar
                    </button>
                  </div>
                  <button
                    onClick={() => cart.length && setPaymentOpen(true)}
                    disabled={!cart.length}
                    className="w-full text-sm py-3 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-40"
                  >
                    <CreditCard size={16} />F6 Pagamento
                  </button>
                </div>

                <div className="p-4 border-t border-gray-700 text-[11px] text-gray-400 space-y-2">
                  <div>
                    <label className="flex items-center gap-1 mb-1"><User size={11} /> Cliente</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Balcão"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 mb-1"><Percent size={11} /> Desconto (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </aside>
            </div>
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
              <button type="submit" className="w-full h-10 rounded-lg bg-blue-600 text-white font-bold">Adicionar</button>
            </form>
          </div>
        )}

        {paymentOpen && cash && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPaymentOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-sm">
              <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
              <p className="text-2xl font-bold mb-4">R$ {fmt(total)}</p>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Valor recebido (dinheiro)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={paidValue}
                onChange={(e) => setPaidValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold mb-2"
              />
              {paid >= total && paid > 0 && (
                <p className="text-sm text-green-600 font-semibold mb-3">Troco: R$ {fmt(change)}</p>
              )}

              <div className="space-y-2 mt-3">
                {[
                  { m: "CASH", l: "Dinheiro" },
                  { m: "PIX", l: "PIX" },
                  { m: "CREDIT_CARD", l: "Cartão de crédito" },
                  { m: "DEBIT_CARD", l: "Cartão de débito" },
                ].map((p) => (
                  <button
                    key={p.m}
                    disabled={submitting}
                    onClick={() => finalizeSale(p.m)}
                    className="w-full h-11 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold text-sm disabled:opacity-50"
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}
