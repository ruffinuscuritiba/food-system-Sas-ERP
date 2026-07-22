"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/services/api";
import {
  ArrowLeft, Plus, Minus, Search,
  ShoppingCart, CheckCircle, X, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableOrder {
  id: string;
  status: string;
  total: number;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

interface Table {
  id: string;
  number: number;
  status: string;
  dineInOrders?: TableOrder[];
}

interface Category {
  id: string;
  name: string;
}

interface ProductSize {
  size: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  salePrice: number;
  imageUrl?: string;
  categoryId?: string;
  sizes?: ProductSize[];
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro", PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MesaDetail() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [table, setTable]       = useState<Table | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart]         = useState<CartItem[]>([]);
  const [search, setSearch]     = useState("");
  const [selCat, setSelCat]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("PIX");

  // Itens já lançados para a mesa (de pedidos CONFIRMED/PREPARING/READY)
  const activeOrders = (table?.dineInOrders ?? []).filter(
    (o) => !["DELIVERED", "CANCELLED"].includes(o.status)
  );
  const tableTotal = activeOrders.reduce((s, o) => s + Number(o.total), 0);
  const cartTotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const load = useCallback(async () => {
    try {
      const [tableRes, catRes, prodRes] = await Promise.all([
        api.get<Table>(`/tables/${id}`),
        api.get<Category[]>("/categories"),
        api.get<Product[]>("/products"),
      ]);
      setTable(tableRes.data);
      setCategories(catRes.data);
      setProducts(prodRes.data);
    } catch {
      toast.error("Erro ao carregar mesa");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Catalog helpers ──────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    const matchCat = !selCat || p.categoryId === selCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product: Product, size?: ProductSize) {
    const price = size ? size.price : Number(product.salePrice);
    const key   = size ? `${product.id}-${size.size}` : product.id;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === key);
      if (existing) return prev.map((c) => c.productId === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { productId: key, name: product.name + (size ? ` (${size.size})` : ""), price, qty: 1, size: size?.size }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, qty: Math.max(0, c.qty + delta) } : c)
          .filter((c) => c.qty > 0)
    );
  }

  // ── Send to kitchen ──────────────────────────────────────────────────────────

  async function sendToKitchen() {
    if (cart.length === 0) { toast.error("Carrinho vazio"); return; }
    setSending(true);
    try {
      const items = cart.map((c) => ({
        productId: c.productId.includes("-") ? c.productId.split("-")[0] : c.productId,
        quantity: c.qty,
        unitPrice: c.price,
        ...(c.size ? { size: c.size } : {}),
      }));

      const res = await api.post("/orders", {
        tableId: id,
        orderType: "DINE_IN",
        items,
        subtotal: cartTotal,
        deliveryFee: 0,
        total: cartTotal,
      });

      await api.patch(`/orders/${res.data.id}/status`, { status: "CONFIRMED" });

      toast.success("Lançado para a cozinha!");
      setCart([]);
      await load();
    } catch {
      toast.error("Erro ao lançar pedido");
    } finally {
      setSending(false);
    }
  }

  // ── Close table (checkout) ───────────────────────────────────────────────────

  async function closeTable() {
    setSending(true);
    try {
      // If there are items in the cart, send them first
      if (cart.length > 0) await sendToKitchen();

      if (tableTotal > 0) {
        await api.post("/cash/movement", {
          type: "SUPPLY",
          value: tableTotal,
          paymentMethod,
        });
      }

      await api.patch(`/tables/${id}/status`, { status: "FREE" });

      toast.success(`Mesa ${table?.number} fechada!`);
      router.push("/garcom");
    } catch {
      toast.error("Erro ao fechar mesa");
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-gray-500">Mesa não encontrada</p>
        <button onClick={() => router.push("/garcom")} className="text-orange-500 font-semibold">Voltar</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/garcom")} className="p-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Mesa {table.number}</h1>
          <p className="text-xs text-gray-400">
            {table.status === "FREE" ? "Livre" : table.status === "OCCUPIED" ? "Ocupada" : "Reservada"}
            {activeOrders.length > 0 && ` · R$${tableTotal.toFixed(2)} em aberto`}
          </p>
        </div>
        {activeOrders.length > 0 && (
          <button
            onClick={() => setShowCheckout(true)}
            className="px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 active:scale-95 transition"
          >
            Fechar
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-5 pb-4">
        {/* Itens já lançados */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Comanda atual</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {activeOrders.flatMap((o) => o.items).map((item, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-gray-50" : ""}`}>
                  <span className="text-sm text-gray-800">{item.quantity}× {item.productName}</span>
                  <span className="text-sm font-medium text-gray-600">
                    R${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-sm font-bold text-gray-700">Total</span>
                <span className="text-base font-bold text-orange-500">R${tableTotal.toFixed(2)}</span>
              </div>
            </div>
          </section>
        )}

        {/* Cart */}
        {cart.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Novo lançamento</h2>
            <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">R${item.price.toFixed(2)} cada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.productId, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => changeQty(item.productId, 1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-orange-50">
                <span className="text-sm font-semibold text-orange-700">Subtotal novo</span>
                <span className="text-sm font-bold text-orange-600">R${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={sendToKitchen}
              disabled={sending}
              className="mt-3 w-full py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={16} />}
              {sending ? "Enviando..." : "Lançar para cozinha"}
            </button>
          </section>
        )}

        {/* Catalog */}
        <section>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Cardápio</h2>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            <button
              onClick={() => setSelCat(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${!selCat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelCat(selCat === c.id ? null : c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${selCat === c.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product list */}
          <div className="space-y-2">
            {filtered.map((product) => {
              const inCart = cart.filter((c) => c.productId.startsWith(product.id));
              const totalQty = inCart.reduce((s, c) => s + c.qty, 0);
              const hasSizes = product.sizes && product.sizes.length > 1;

              return (
                <div key={product.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
                      {hasSizes ? (
                        <p className="text-xs text-gray-400">
                          A partir de R${Math.min(...product.sizes!.map((s) => Number(s.price))).toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">R${Number(product.salePrice).toFixed(2)}</p>
                      )}
                    </div>

                    {hasSizes ? (
                      <div className="flex flex-col gap-1">
                        {product.sizes!.map((s) => {
                          const key = `${product.id}-${s.size}`;
                          const qty = cart.find((c) => c.productId === key)?.qty ?? 0;
                          return (
                            <div key={s.size} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 w-12 text-right">{s.size}</span>
                              <span className="text-[10px] font-semibold text-gray-700 w-12">R${Number(s.price).toFixed(2)}</span>
                              {qty > 0 ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => changeQty(key, -1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Minus size={11} />
                                  </button>
                                  <span className="w-4 text-center text-xs font-bold">{qty}</span>
                                  <button onClick={() => addToCart(product, s)} className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <Plus size={11} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(product, s)}
                                  className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center"
                                >
                                  <Plus size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : totalQty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(product.id, -1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Minus size={13} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{totalQty}</span>
                        <button onClick={() => addToCart(product)} className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-sm"
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Fechar Mesa {table.number}</h2>
              <button onClick={() => setShowCheckout(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">Total a cobrar</p>
              <p className="text-3xl font-bold text-gray-900">R${tableTotal.toFixed(2)}</p>
            </div>

            <p className="text-sm font-semibold text-gray-600 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${
                    paymentMethod === key
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={closeTable}
              disabled={sending}
              className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base hover:bg-orange-600 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={18} />}
              {sending ? "Fechando..." : "Confirmar fechamento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
