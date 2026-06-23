"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/services/api";
import { socket } from "@/services/socket";
import toast from "react-hot-toast";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

export default function TablesPage() {
  useNavKeyGuard("tables");
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableItems, setTableItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [productsError, setProductsError] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPayment, setCheckoutPayment] = useState("PIX");
  const [closingTable, setClosingTable] = useState(false);

  async function fetchProducts() {
    setLoadingProducts(true);
    setProductsError(false);
    try {
      const r = await api.get("/products");
      setProducts(Array.isArray(r.data) ? r.data : []);
    } catch {
      setProductsError(true);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function fetchTables() {
    try {
      const response = await api.get("/tables");
      const fresh: any[] = response.data || [];
      setTables(fresh);
      setSelectedTable((prev: any) => {
        if (!prev) return prev;
        return fresh.find((t: any) => t.id === prev.id) ?? prev;
      });
    } catch (error) {
      console.log(error);
      toast.error("Erro ao carregar mesas");
      setTables([]);
    }
  }

  // Rebuild tableItems whenever selectedTable is synced from fetchTables
  useEffect(() => {
    if (!selectedTable) { setTableItems([]); return; }
    const serverItems = (selectedTable.dineInOrders || [])
      .flatMap((o: any) =>
        (o.items || []).map((item: any) => ({
          id:        item.id,
          productId: item.productId,
          name:      item.productName,
          quantity:  Number(item.quantity),
          price:     Number(item.unitPrice),
        }))
      );
    setTableItems(serverItems);
  }, [selectedTable]);

  useEffect(() => {
    fetchTables();
    fetchProducts();
    socket.connect();
    socket.on("tableUpdate", fetchTables);
    socket.on("orderCreated", fetchTables);
    return () => {
      socket.off("tableUpdate");
      socket.off("orderCreated");
      socket.disconnect();
    };
  }, []);

  async function createTable() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      await api.post("/tables", {
        number: tables.length + 1,
        companyId: user.companyId,
        status: "FREE",
      });
      toast.success("Mesa criada");
      fetchTables();
    } catch {
      toast.error("Erro ao criar mesa");
    }
  }

  function updateStatus(id: string, status: string) {
    api
      .patch(`/tables/${id}/status`, { status })
      .then(() => { toast.success("Mesa atualizada"); fetchTables(); })
      .catch(() => toast.error("Erro ao atualizar mesa"));
  }

  /** Lança o item selecionado para cozinha e mantém a mesa aberta. */
  async function launchItem(): Promise<boolean> {
    if (!selectedProductId || !selectedTable) {
      toast.error("Selecione um produto");
      return false;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return false;

    const tempId = Date.now();
    const item = {
      id: tempId,
      productId: selectedProductId,
      name: product.name,
      quantity: newItemQuantity,
      price: Number(product.salePrice),
    };

    // Optimistic UI
    setTableItems((prev) => [...prev, item]);

    try {
      const orderRes = await api.post("/orders", {
        customerName:    `Mesa ${selectedTable.number}`,
        customerPhone:   "SALÃO",
        deliveryAddress: "INTERNO",
        orderType:       "DINE_IN",
        paymentMethod:   "PIX",
        tableId:         selectedTable.id,
        items:           [{ productId: item.productId, quantity: item.quantity }],
        deliveryFee:     0,
      });
      if (orderRes.data?.id) {
        await api.patch(`/orders/${orderRes.data.id}/status`, { status: "CONFIRMED" }).catch(() => {});
      }
      fetchTables();
      return true;
    } catch {
      toast.error("Erro ao enviar para cozinha");
      setTableItems((prev) => prev.filter((i) => i.id !== tempId));
      return false;
    }
  }

  /** Botão "Lançar": envia item para cozinha, mantém mesa aberta. */
  async function handleLaunch() {
    if (!selectedProductId) { toast.error("Selecione um produto"); return; }
    setLaunching(true);
    const ok = await launchItem();
    setLaunching(false);
    if (ok) {
      setSelectedProductId("");
      setProductSearch("");
      setNewItemPrice("");
      setNewItemQuantity(1);
      toast.success("Lançado para cozinha ✓");
    }
  }

  /**
   * Botão "Lançar e Finalizar":
   * Se há produto selecionado, lança primeiro.
   * Em seguida abre o modal de pagamento.
   */
  async function handleLaunchAndFinalize() {
    setLaunching(true);
    if (selectedProductId) {
      const ok = await launchItem();
      if (!ok) { setLaunching(false); return; }
      setSelectedProductId("");
      setProductSearch("");
      setNewItemPrice("");
      setNewItemQuantity(1);
    }
    setLaunching(false);
    setShowCheckout(true);
  }

  /** Confirma pagamento e libera a mesa. */
  async function confirmCheckout() {
    if (!selectedTable) return;
    setClosingTable(true);
    try {
      const total = (selectedTable.dineInOrders || [])
        .filter((o: any) => o.status !== "CANCELLED")
        .reduce((sum: number, o: any) => sum + Number(o.total ?? 0), 0);

      if (total > 0) {
        await api.post("/cash/movement", {
          type:          "SUPPLY",
          value:         total,
          paymentMethod: checkoutPayment,
        });
      }
      await api.patch(`/tables/${selectedTable.id}/status`, { status: "FREE" });
      toast.success(`Mesa ${selectedTable.number} fechada — R$ ${total.toFixed(2)}`);
      setShowCheckout(false);
      setSelectedTable(null);
      fetchTables();
    } catch {
      toast.error("Erro ao fechar a conta");
    } finally {
      setClosingTable(false);
    }
  }

  const tableTotal = tableItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-5xl font-bold">Mesas</h1>
          <button
            onClick={createTable}
            className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-2xl font-bold shadow-xl text-white"
          >
            Nova Mesa
          </button>
        </div>

        {/* Grid de mesas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {tables.map((table) => (
            <motion.div
              key={table.id}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedTable(table)}
              className="bg-white border border-gray-200 rounded-3xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-3xl font-bold mb-4">Mesa {table.number}</h2>
              <div className="mb-6">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-bold ${
                    table.status === "FREE"
                      ? "bg-green-500/20 text-green-600"
                      : table.status === "OCCUPIED"
                      ? "bg-red-500/20 text-red-500"
                      : "bg-yellow-500/20 text-yellow-600"
                  }`}
                >
                  {table.status === "FREE" ? "🟢 LIVRE" : table.status === "OCCUPIED" ? "🔴 OCUPADA" : "🟡 RESERVADA"}
                </span>
              </div>
              <select
                value={table.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); updateStatus(table.id, e.target.value); }}
                className="w-full bg-white border border-gray-300 p-3 rounded-2xl text-gray-900"
              >
                <option value="FREE">LIVRE</option>
                <option value="OCCUPIED">OCUPADA</option>
                <option value="RESERVED">RESERVADA</option>
              </select>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Modal da comanda ─────────────────────────────────────────── */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 border border-gray-200 shadow-2xl overflow-y-auto max-h-[95vh]">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl font-bold">Mesa {selectedTable.number}</h2>
                <p className="text-gray-500 mt-1 text-sm">Comanda aberta — adicione itens continuamente</p>
              </div>
              <button
                onClick={() => { setSelectedTable(null); setProductSearch(""); setSelectedProductId(""); setNewItemPrice(""); }}
                className="bg-gray-100 hover:bg-gray-200 transition px-5 py-3 rounded-2xl text-gray-700 font-medium"
              >
                Fechar
              </button>
            </div>

            {/* Total */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
              <p className="text-green-700 text-sm font-medium">Total acumulado da mesa</p>
              <h3 className="text-3xl font-bold text-green-700">R$ {tableTotal.toFixed(2)}</h3>
            </div>

            {/* Itens lançados */}
            {tableItems.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
                <h3 className="font-bold text-lg mb-3 text-gray-800">Itens lançados</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tableItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="text-gray-400 text-xs ml-2">× {item.quantity}</span>
                      </div>
                      <span className="font-bold text-sm text-green-700">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adicionar item */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Adicionar item</h3>
              <div className="space-y-4">

                {/* Busca de produto */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId(""); setNewItemPrice(""); }}
                    className="w-full bg-white border border-gray-300 pl-9 pr-4 py-3 rounded-2xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Dropdown de busca */}
                {productSearch && (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto shadow-sm">
                    {products
                      .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProductId(p.id); setNewItemPrice(String(p.salePrice)); setProductSearch(p.name); }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition flex justify-between items-center border-b border-gray-50 last:border-0 ${selectedProductId === p.id ? "bg-green-50" : ""}`}
                        >
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-green-600 text-sm font-bold">R$ {Number(p.salePrice).toFixed(2)}</span>
                        </button>
                      ))}
                    {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-gray-400 text-sm">Nenhum produto encontrado</p>
                    )}
                  </div>
                )}

                {/* Select fallback */}
                {!productSearch && (
                  productsError ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                      <span className="text-red-500 text-sm">Erro ao carregar produtos</span>
                      <button
                        onClick={fetchProducts}
                        className="text-sm bg-gray-100 hover:bg-gray-200 transition px-3 py-1.5 rounded-xl"
                      >
                        {loadingProducts ? "Carregando..." : "Tentar novamente"}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={(e) => { setSelectedProductId(e.target.value); const p = products.find((x) => x.id === e.target.value); setNewItemPrice(p ? String(p.salePrice) : ""); }}
                      className="w-full bg-white border border-gray-300 p-4 rounded-2xl text-gray-900"
                    >
                      <option value="">
                        {loadingProducts ? "Carregando produtos..." : products.length === 0 ? "Nenhum produto cadastrado" : "Selecione um produto..."}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.salePrice).toFixed(2)}</option>
                      ))}
                    </select>
                  )
                )}

                {/* Preço unitário */}
                {newItemPrice && (
                  <div className="flex items-center justify-between bg-white border border-gray-200 px-4 py-3 rounded-2xl">
                    <span className="text-gray-500 text-sm">Preço unitário</span>
                    <span className="font-bold text-green-600 text-lg">R$ {Number(newItemPrice).toFixed(2)}</span>
                  </div>
                )}

                {/* Quantidade */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNewItemQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg transition flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-white border border-gray-300 p-3 rounded-2xl text-center font-bold text-lg"
                  />
                  <button
                    onClick={() => setNewItemQuantity((q) => q + 1)}
                    className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg transition flex items-center justify-center"
                  >+</button>
                </div>

              </div>
            </div>

            {/* ── Botões de ação ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Lançar: envia para cozinha, mantém mesa aberta */}
              <button
                onClick={handleLaunch}
                disabled={launching || !selectedProductId}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition py-4 rounded-2xl font-bold text-white shadow-sm"
              >
                {launching ? "Enviando..." : "🍳 Lançar"}
              </button>

              {/* Lançar e Finalizar: lança (se selecionado) + abre pagamento */}
              <button
                onClick={handleLaunchAndFinalize}
                disabled={launching || (tableItems.length === 0 && !selectedProductId)}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition py-4 rounded-2xl font-bold text-white shadow-sm"
              >
                {launching ? "Enviando..." : "💳 Lançar e Finalizar"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal de checkout / pagamento ─────────────────────────────── */}
      {showCheckout && selectedTable && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">

            <h2 className="text-3xl font-bold mb-2">Fechar Conta</h2>
            <p className="text-gray-500 text-sm mb-6">Mesa {selectedTable.number}</p>

            {/* Resumo de itens */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 max-h-52 overflow-y-auto">
              {tableItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                  <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mb-6 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <span className="font-bold text-green-800">Total</span>
              <span className="text-3xl font-bold text-green-700">R$ {tableTotal.toFixed(2)}</span>
            </div>

            {/* Forma de pagamento */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "PIX",         label: "PIX" },
                  { value: "CASH",        label: "Dinheiro" },
                  { value: "CREDIT_CARD", label: "Crédito" },
                  { value: "DEBIT_CARD",  label: "Débito" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCheckoutPayment(opt.value)}
                    className={`py-3 rounded-2xl font-bold border-2 transition text-sm ${
                      checkoutPayment === opt.value
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-4 rounded-2xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Voltar
              </button>
              <button
                onClick={confirmCheckout}
                disabled={closingTable}
                className="flex-1 py-4 rounded-2xl font-bold bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white transition"
              >
                {closingTable ? "Processando..." : "✓ Confirmar Pagamento"}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
