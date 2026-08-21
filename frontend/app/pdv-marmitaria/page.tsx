"use client";

/**
 * Frente de Caixa — módulo Marmitaria.
 *
 * Visualmente independente do /pdv genérico de comida: abas de categoria
 * coloridas + grid de produtos + painel de pedido fixo à esquerda — mesma
 * linguagem visual de sistemas de mercado como Consumer/Goomer (referência
 * trazida pelo usuário), mas com tamanhos P/M/G reais do produto (não fotos
 * genéricas). Caixa único (não multi-registro como o Mercado) — marmitaria
 * é tipicamente 1 terminal.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { DoorOpen, Utensils, CreditCard } from "lucide-react";
import { getCategoryColor } from "@/lib/categoryColors";

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
type CartLine = {
  key: string;
  productId: string;
  name: string;
  size?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
type Cash = { id: string; balance: number; isOpen: boolean };

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function priceLabel(p: Product) {
  if (p.sizes && p.sizes.length > 0) {
    const prices = p.sizes.map((s) => Number(s.price));
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }
  return fmt(Number(p.salePrice || 0));
}

export default function MarmitariaPdvPage() {
  const { user } = useAuthStore();

  const [cash, setCash] = useState<Cash | null>(null);
  const [checkingCash, setCheckingCash] = useState(true);
  const [openingValue, setOpeningValue] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sizePrompt, setSizePrompt] = useState<Product | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = cart.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const loadCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/categories"), api.get("/products")]);
      const nextProducts = Array.isArray(pRes.data) ? pRes.data : [];
      const productCategoryIds = new Set(nextProducts.map((p) => p.categoryId).filter(Boolean));
      setCategories(
        (Array.isArray(cRes.data) ? cRes.data : [])
          .filter((category) => productCategoryIds.has(category.id)),
      );
      setProducts(nextProducts);
    } catch {
      toast.error("Erro ao carregar cardápio");
    }
  }, []);

  const checkCash = useCallback(async () => {
    setCheckingCash(true);
    try {
      const r = await api.get("/cash/current");
      const c = r.data;
      setCash(c && c.isOpen ? c : null);
      if (c && c.isOpen) await loadCatalog();
    } catch {
      /* silent */
    } finally {
      setCheckingCash(false);
    }
  }, [loadCatalog]);

  useEffect(() => { checkCash(); }, [checkCash]);

  async function openRegister() {
    const value = Number(openingValue.replace(",", "."));
    if (!openingValue || isNaN(value) || value < 0) { toast.error("Informe o valor de abertura"); return; }
    try {
      const r = await api.post("/cash/open", { openingValue: value });
      setCash(r.data);
      toast.success("Caixa aberto");
      await loadCatalog();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao abrir caixa");
    }
  }

  const filteredProducts = useMemo(
    () => activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory],
  );

  function addLine(product: Product, size: string | undefined, unitPrice: number) {
    setCart((prev) => {
      const key = size ? `${product.id}-${size}` : product.id;
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => l.key === key
          ? { ...l, qty: l.qty + 1, lineTotal: (l.qty + 1) * l.unitPrice }
          : l);
      }
      return [...prev, {
        key, productId: product.id, name: product.name, size, qty: 1, unitPrice, lineTotal: unitPrice,
      }];
    });
  }

  function handleProductClick(p: Product) {
    if (p.sizes && p.sizes.length > 1) { setSizePrompt(p); return; }
    const unitPrice = p.sizes?.[0] ? Number(p.sizes[0].price) : Number(p.salePrice || 0);
    addLine(p, p.sizes?.[0]?.size, unitPrice);
  }

  function pickSize(size: ProductSize) {
    if (!sizePrompt) return;
    addLine(sizePrompt, size.size, Number(size.price));
    setSizePrompt(null);
  }

  function decLine(key: string) {
    setCart((prev) => prev
      .map((l) => l.key === key ? { ...l, qty: l.qty - 1, lineTotal: (l.qty - 1) * l.unitPrice } : l)
      .filter((l) => l.qty > 0));
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
        notes: "",
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          notes: l.size ? `Tamanho: ${l.size}` : "",
          unitPrice: l.unitPrice,
        })),
        subtotal: total,
        deliveryFee: 0,
        total,
      });
      if (orderRes.data?.id) {
        await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" });
      }
      toast.success(`Pedido fechado — R$ ${fmt(total)}`);
      setCart([]);
      setPaymentOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao fechar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]}>
      <main className="min-h-screen bg-white text-gray-900 font-sans">
        {checkingCash ? (
          <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Carregando...</div>
        ) : !cash ? (
          <div className="flex items-center justify-center h-screen">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
              <div className="flex items-center gap-2 mb-6">
                <DoorOpen size={20} className="text-orange-600" />
                <h1 className="text-lg font-bold">Abrir caixa</h1>
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
              <button onClick={openRegister} className="w-full h-11 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700">
                Abrir Caixa
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[260px_1fr] h-screen">
            {/* Painel de pedido */}
            <aside className="bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
              <div className="mb-1 text-sm font-bold">Pedido</div>
              <div className="mb-4 text-xs text-gray-400">{user?.name}</div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {cart.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center mt-8">Clique num produto pra começar</p>
                ) : cart.map((l) => (
                  <div key={l.key} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.qty}x {l.name}{l.size ? ` (${l.size})` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold">{fmt(l.lineTotal)}</span>
                      <button onClick={() => decLine(l.key)} className="w-5 h-5 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center">−</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs text-gray-500">Total ({itemCount})</span>
                  <span className="text-xl font-bold">R$ {fmt(total)}</span>
                </div>
                <button
                  onClick={() => cart.length && setPaymentOpen(true)}
                  disabled={!cart.length}
                  className="w-full h-11 rounded-lg bg-green-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <CreditCard size={16} />Fechar pedido
                </button>
              </div>
            </aside>

            {/* Categorias + produtos */}
            <section className="p-4 overflow-y-auto">
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${activeCategory === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  Todos
                </button>
                {categories.map((c, i) => {
                  const color = getCategoryColor(c, i);
                  const isActive = activeCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                      style={{ backgroundColor: isActive ? color : `${color}22`, color: isActive ? "#fff" : color }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    className="border border-gray-200 rounded-xl overflow-hidden text-left hover:border-orange-300 transition"
                  >
                    <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Utensils size={22} className="text-gray-300" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{priceLabel(p)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {sizePrompt && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSizePrompt(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-5 w-full max-w-xs">
              <p className="text-sm font-bold mb-3">{sizePrompt.name}</p>
              <div className="space-y-2">
                {(sizePrompt.sizes || []).map((s) => (
                  <button
                    key={s.size}
                    onClick={() => pickSize(s)}
                    className="w-full h-11 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center justify-between px-4 text-sm font-semibold"
                  >
                    <span>{s.size}</span>
                    <span>R$ {fmt(Number(s.price))}</span>
                  </button>
                ))}
              </div>
            </div>
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
