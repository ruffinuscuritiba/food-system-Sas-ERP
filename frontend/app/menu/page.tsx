"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { ShoppingCart, X, Plus, Minus, Trash2, ChevronRight } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string;
  salePrice: number;
  imageUrl: string | null;
  category?: { name: string };
  isActive: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
  notes: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  orderType: "DELIVERY" | "PICKUP";
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
};

function MenuContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("Cardápio");
  const [orderSent, setOrderSent] = useState(false);
  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    address: "",
    orderType: "DELIVERY",
    paymentMethod: "PIX",
  });

  async function loadMenu() {
    if (!companyId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/products/public/menu/${companyId}`);
      const data = await res.json();
      const list: Product[] = Array.isArray(data) ? data : (data.products || []);
      setProducts(list);
      const cats = ["Todos", ...Array.from(new Set<string>(list.map((p) => p.category?.name || "Outros")))];
      setCategories(cats);
    } catch {
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompany() {
    if (!companyId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/company/${companyId}`);
      const data = await res.json();
      if (data?.name) setCompanyName(data.name);
    } catch {}
  }

  useEffect(() => {
    loadMenu();
    loadCompany();
  }, [companyId]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id !== productId
            ? i
            : { ...i, quantity: i.quantity + delta }
        )
        .filter((i) => i.quantity > 0)
    );
  }

  const cartTotal = cart.reduce(
    (acc, i) => acc + Number(i.product.salePrice) * i.quantity,
    0
  );
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  const filtered =
    activeCategory === "Todos"
      ? products
      : products.filter(
          (p) => (p.category?.name || "Outros") === activeCategory
        );

  async function submitOrder() {
    if (!form.name || !form.phone) {
      toast.error("Informe seu nome e telefone");
      return;
    }
    if (form.orderType === "DELIVERY" && !form.address) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/orders/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          customerName: form.name,
          customerPhone: form.phone,
          deliveryAddress: form.address,
          orderType: form.orderType,
          paymentMethod: form.paymentMethod,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            notes: i.notes,
          })),
          total: cartTotal,
        }),
      });

      if (!res.ok) throw new Error();
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setOrderSent(true);
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400 text-xl">Link de cardápio inválido.</p>
      </div>
    );
  }

  if (orderSent) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="text-4xl font-black text-green-400">Pedido recebido!</h1>
        <p className="text-slate-400 text-lg max-w-sm">
          Seu pedido foi enviado para {companyName}. Você será notificado em
          breve.
        </p>
        <button
          onClick={() => setOrderSent(false)}
          className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition"
        >
          Fazer novo pedido
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-black text-red-400 truncate max-w-[200px]">
            {companyName}
          </h1>
          <button
            onClick={() => setShowCart(true)}
            className="relative bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition"
          >
            <ShoppingCart size={18} />
            <span>R$ {cartTotal.toFixed(2)}</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[65px] z-30 bg-slate-950 border-b border-slate-800 px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 max-w-3xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${
                activeCategory === cat
                  ? "bg-red-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-slate-400 text-lg animate-pulse">
              Carregando cardápio...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-28 h-28 object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-green-400 font-black text-xl">
                      R$ {Number(product.salePrice).toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 transition text-sm"
                    >
                      <Plus size={16} />
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCart(false)}
          />
          <div className="relative bg-slate-900 w-full max-w-md flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold">Seu pedido</h2>
              <button onClick={() => setShowCart(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center py-10">
                  Carrinho vazio
                </p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-4 bg-slate-800 rounded-xl p-4"
                  >
                    <div className="flex-1">
                      <p className="font-bold">{item.product.name}</p>
                      <p className="text-green-400 font-bold">
                        R${" "}
                        {(Number(item.product.salePrice) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="bg-slate-700 hover:bg-slate-600 p-1 rounded-lg transition"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="font-bold w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="bg-slate-700 hover:bg-slate-600 p-1 rounded-lg transition"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-slate-800">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total</span>
                <span className="text-green-400">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowCart(false);
                  setShowCheckout(true);
                }}
                disabled={cart.length === 0}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition"
              >
                Finalizar pedido <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCheckout(false)}
          />
          <div className="relative bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Seus dados</h2>
              <button onClick={() => setShowCheckout(false)}>
                <X size={24} />
              </button>
            </div>

            <input
              placeholder="Seu nome *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
            />
            <input
              placeholder="Telefone / WhatsApp *"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
            />

            <div className="grid grid-cols-2 gap-3">
              {(["DELIVERY", "PICKUP"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                  className={`py-3 rounded-xl font-bold transition ${
                    form.orderType === type
                      ? "bg-red-500 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {type === "DELIVERY" ? "Entrega" : "Retirada"}
                </button>
              ))}
            </div>

            {form.orderType === "DELIVERY" && (
              <input
                placeholder="Endereço de entrega *"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
              />
            )}

            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  paymentMethod: e.target.value as CustomerForm["paymentMethod"],
                }))
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
            >
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
            </select>

            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-800">
              <span>Total</span>
              <span className="text-green-400">R$ {cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg transition"
            >
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <p className="text-slate-400 animate-pulse text-lg">Carregando...</p>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
