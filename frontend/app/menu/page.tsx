"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

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

export default function MenuPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c") || "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [customer, setCustomer] = useState<CustomerForm>({
    name: "",
    phone: "",
    address: "",
    orderType: "DELIVERY",
    paymentMethod: "PIX",
  });

  useEffect(() => {
    loadProducts();
  }, [companyId]);

  async function loadProducts() {
    try {
      const res = await axios.get(`${apiBaseUrl}/products/public/menu/${companyId}`);
      const data: Product[] = res.data.filter((p: Product) => p.isActive !== false);
      setProducts(data);
      const cats = Array.from(
        new Set(data.map((p) => p.category?.name).filter(Boolean) as string[])
      );
      setCategories(["Todos", ...cats]);
    } catch {
      toast.error("Erro ao carregar cardápio.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === "Todos" || p.category?.name === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

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
    toast.success(`${product.name} adicionado!`, { duration: 1500 });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function updateNotes(productId: string, notes: string) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, notes } : i))
    );
  }

  const total = cart.reduce((sum, i) => sum + Number(i.product.salePrice) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.name || !customer.phone) {
      toast.error("Informe seu nome e telefone.");
      return;
    }
    if (customer.orderType === "DELIVERY" && !customer.address) {
      toast.error("Informe o endereço de entrega.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/orders/public`, {
        companyId,
        customerName: customer.name,
        customerPhone: customer.phone,
        deliveryAddress: customer.address,
        orderType: customer.orderType,
        paymentMethod: customer.paymentMethod,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.salePrice,
          subtotal: Number(i.product.salePrice) * i.quantity,
          notes: i.notes,
        })),
        total,
      });
      setOrderPlaced(res.data.id || "pedido-confirmado");
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao realizar pedido.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-4">
        <Toaster position="top-right" />
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold mb-2">Pedido confirmado!</h1>
          <p className="text-slate-400 mb-2">Seu pedido foi recebido com sucesso.</p>
          <p className="text-sm text-slate-500 mb-8">Código: {orderPlaced}</p>
          <button
            onClick={() => setOrderPlaced(null)}
            className="rounded-xl bg-red-500 px-8 py-3 font-bold hover:bg-red-600 transition"
          >
            Fazer novo pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster position="top-right" />
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <h1 className="text-xl font-black text-red-500">🍽️ Cardápio</h1>
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-xs rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={() => setShowCart(true)}
            className="relative rounded-xl bg-red-500 px-4 py-2 font-bold hover:bg-red-600 transition flex items-center gap-2"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-black">
                {cartCount}
              </span>
            )}
            <span className="hidden sm:inline">Carrinho</span>
          </button>
        </div>
      </header>
      <div className="sticky top-[73px] z-30 bg-slate-950 border-b border-slate-800 px-4 py-3">
        <div className="mx-auto max-w-5xl flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="text-center text-slate-400 py-20">Carregando cardápio...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-20">Nenhum produto encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => {
              const inCart = cart.find((i) => i.product.id === product.id);
              return (
                <div key={product.id} className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden flex flex-col">
                  <img
                    src={product.imageUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80"}
                    alt={product.name}
                    className="w-full h-44 object-cover"
                  />
                  <div className="p-4 flex flex-col flex-1">
                    {product.category?.name && (
                      <span className="text-xs text-red-400 font-medium mb-1">{product.category.name}</span>
                    )}
                    <h2 className="font-bold text-lg leading-tight">{product.name}</h2>
                    {product.description && (
                      <p className="text-slate-400 text-sm mt-1 flex-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xl font-black text-green-400">
                        R$ {Number(product.salePrice).toFixed(2)}
                      </span>
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(product.id, -1)} className="h-8 w-8 rounded-full bg-slate-700 hover:bg-slate-600 font-bold text-lg flex items-center justify-center">−</button>
                          <span className="w-6 text-center font-bold">{inCart.quantity}</span>
                          <button onClick={() => updateQuantity(product.id, 1)} className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 font-bold text-lg flex items-center justify-center">+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(product)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold hover:bg-red-600 transition">Adicionar</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-xl font-bold">🛒 Carrinho ({cartCount})</h2>
              <button onClick={() => setShowCart(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center py-10">Carrinho vazio</p>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="text-green-400 text-sm">R$ {(Number(item.product.salePrice) * item.quantity).toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-300 text-sm">Remover</button>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="h-7 w-7 rounded-full bg-slate-700 hover:bg-slate-600 font-bold flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 font-bold flex items-center justify-center">+</button>
                    </div>
                    <input
                      type="text"
                      placeholder="Observações (opcional)"
                      value={item.notes}
                      onChange={(e) => updateNotes(item.product.id, e.target.value)}
                      className="mt-2 w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-1.5 text-sm placeholder-slate-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-700">
                <div className="flex justify-between text-lg font-bold mb-4">
                  <span>Total</span>
                  <span className="text-green-400">R$ {total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { setShowCart(false); setShowCheckout(true); }}
                  className="w-full rounded-xl bg-red-500 py-3 font-bold hover:bg-red-600 transition"
                >
                  Finalizar pedido →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-xl font-bold">Finalizar pedido</h2>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>
            <form onSubmit={handleCheckout} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Seu nome *</label>
                <input required value={customer.name} onChange={(e) => setCustomer((p) => ({ ...p, name: e.target.value }))} placeholder="João Silva" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Telefone *</label>
                <input required value={customer.phone} onChange={(e) => setCustomer((p) => ({ ...p, phone: e.target.value }))} placeholder="(41) 99999-9999" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo de pedido</label>
                <select value={customer.orderType} onChange={(e) => setCustomer((p) => ({ ...p, orderType: e.target.value as any }))} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none">
                  <option value="DELIVERY">Delivery (entrega)</option>
                  <option value="PICKUP">Retirada no local</option>
                </select>
              </div>
              {customer.orderType === "DELIVERY" && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Endereço *</label>
                  <input required value={customer.address} onChange={(e) => setCustomer((p) => ({ ...p, address: e.target.value }))} placeholder="Rua, número, bairro" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Pagamento</label>
                <select value={customer.paymentMethod} onChange={(e) => setCustomer((p) => ({ ...p, paymentMethod: e.target.value as any }))} className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none">
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="DEBIT_CARD">Cartão de débito</option>
                </select>
              </div>
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="text-sm font-semibold mb-2">Resumo</p>
                {cart.map((i) => (
                  <div key={i.product.id} className="flex justify-between text-sm text-slate-300">
                    <span>{i.quantity}x {i.product.name}</span>
                    <span>R$ {(Number(i.product.salePrice) * i.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-green-400">R$ {total.toFixed(2)}</span>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-red-500 py-3 font-bold hover:bg-red-600 transition disabled:opacity-50">
                {submitting ? "Enviando..." : "Confirmar pedido"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}