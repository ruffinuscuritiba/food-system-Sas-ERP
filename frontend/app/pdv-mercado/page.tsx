"use client";

/**
 * Frente de Caixa — módulo Mercado.
 *
 * Sistema visualmente independente do /pdv de comida (pizzaria/hamburgueria):
 * paleta clara e utilitária, densidade alta, sem cards fotográficos — o
 * padrão real de terminal de supermercado (bipagem, lista, total, F-keys).
 * Suporta produto por peso (balança manual) e até 5 caixas simultâneos via
 * `Cash.registerNumber` — cada terminal/navegador lembra o próprio número
 * de caixa em localStorage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Barcode, DoorOpen, User, Percent, PauseCircle, CreditCard, XCircle } from "lucide-react";

type Product = {
  id: string;
  name: string;
  salePrice: number;
  barcode?: string | null;
  sku?: string | null;
  eanCode?: string | null;
  pluCode?: string | null;
  isWeighted?: boolean;
  pricePerKg?: number | null;
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
  const router = useRouter();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");
  const [registerChoice, setRegisterChoice] = useState<number>(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [weightPrompt, setWeightPrompt] = useState<Product | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cart.reduce((s, l) => s + (l.isWeighted ? 1 : l.qty), 0);

  const loadProducts = useCallback(async () => {
    try {
      const r = await api.get("/products");
      setProducts(Array.isArray(r.data) ? r.data : []);
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
        key: `${product.id}-${Date.now()}`,
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

  async function finalizeSale(paymentMethod: string) {
    if (cart.length === 0 || !cash) return;
    setSubmitting(true);
    try {
      const orderRes = await api.post("/orders", {
        customerName: "Cliente balcão",
        customerPhone: "",
        deliveryAddress: "BALCAO",
        orderType: "DINE_IN",
        channel: "PDV",
        cashId: cash.id,
        paymentMethod,
        notes: `Caixa ${cash.registerNumber ?? ""}`.trim(),
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          notes: "",
          unitPrice: l.unitPrice,
        })),
        subtotal: total,
        deliveryFee: 0,
        total,
      });
      if (orderRes.data?.id) {
        await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      }
      toast.success(`Venda finalizada — R$ ${fmt(total)}`);
      setCart([]);
      setPaymentOpen(false);
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

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="min-h-screen bg-gray-100 text-gray-900 font-sans">
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
          <div className="max-w-3xl mx-auto p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">Caixa {cash.registerNumber ?? "—"}</span>
                  <span className="text-xs text-gray-400">{user?.name}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Caixa aberto
                </div>
              </div>

              <form onSubmit={handleScan} className="relative mb-3">
                <Barcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder="Bipar código ou digitar PLU"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-base"
                  autoFocus
                />
              </form>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-xs">
                      <th className="text-left font-normal px-3 py-2">Item</th>
                      <th className="text-right font-normal px-3 py-2">Qtd</th>
                      <th className="text-right font-normal px-3 py-2">Unit.</th>
                      <th className="text-right font-normal px-3 py-2">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-300 py-8 text-sm">Aguardando bipagem...</td></tr>
                    ) : cart.map((l) => (
                      <tr key={l.key} className="border-t border-gray-100">
                        <td className="px-3 py-1.5">{l.name}</td>
                        <td className="text-right px-3 py-1.5">{l.isWeighted ? `${fmt(l.qty)}kg` : l.qty}</td>
                        <td className="text-right px-3 py-1.5">{fmt(l.unitPrice)}</td>
                        <td className="text-right px-3 py-1.5 font-semibold">{fmt(l.lineTotal)}</td>
                        <td className="text-center">
                          <button onClick={() => removeLine(l.key)} className="text-gray-300 hover:text-red-500">
                            <XCircle size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">{itemCount} itens</span>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="text-3xl font-bold">R$ {fmt(total)}</div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 mt-4">
                <button disabled className="text-xs py-2 rounded-lg border border-gray-200 text-gray-300 flex flex-col items-center gap-1">
                  <User size={15} />F2 Cliente
                </button>
                <button disabled className="text-xs py-2 rounded-lg border border-gray-200 text-gray-300 flex flex-col items-center gap-1">
                  <Percent size={15} />F4 Desconto
                </button>
                <button onClick={suspendSale} className="text-xs py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex flex-col items-center gap-1">
                  <PauseCircle size={15} />F5 Suspender
                </button>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  className="text-xs py-2 rounded-lg bg-blue-600 text-white font-bold flex flex-col items-center gap-1 hover:bg-blue-700 disabled:opacity-40"
                  disabled={!cart.length}
                >
                  <CreditCard size={15} />F6 Pagamento
                </button>
                <button onClick={resumeSale} className="text-xs py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Retomar</button>
              </div>
            </div>
          </div>
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
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-xs">
              <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
              <p className="text-2xl font-bold mb-4">R$ {fmt(total)}</p>
              <div className="space-y-2">
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
