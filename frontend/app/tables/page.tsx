"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  motion,
} from "framer-motion";

import {
  api,
} from "@/services/api";

import {
  socket,
} from "@/services/socket";

import toast from "react-hot-toast";

export default function TablesPage() {

  const [tables, setTables] =
    useState<any[]>([]);

  const [selectedTable, setSelectedTable] =
    useState<any>(null);

  const [tableItems, setTableItems] =
    useState<any[]>([]);

  const [products, setProducts] =
    useState<any[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [productSearch, setProductSearch] =
    useState("");

  const [newItemPrice, setNewItemPrice] =
    useState("");

  const [newItemQuantity, setNewItemQuantity] =
    useState(1);

  const [paymentMethod, setPaymentMethod] =
    useState("PIX");

  const [productsError, setProductsError] =
    useState(false);

  const [loadingProducts, setLoadingProducts] =
    useState(false);

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

      const response =
        await api.get(
          "/tables",
        );

      setTables(
        response.data || [],
      );

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao carregar mesas",
      );

      setTables([]);
    }
  }

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

      const user =
        JSON.parse(
          localStorage.getItem(
            "user",
          ) || "{}",
        );

      await api.post("/tables", {
        number: tables.length + 1,
        companyId: user.companyId,
        status: "FREE",
      });

      toast.success(
        "Mesa criada",
      );

      fetchTables();

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao criar mesa",
      );
    }
  }

  function addItemToTable() {

    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const item = {
      id: Date.now(),
      productId: selectedProductId,
      name: product.name,
      quantity: newItemQuantity,
      price: Number(product.salePrice),
    };

    const updatedItems = [...tableItems, item];
    setTableItems(updatedItems);
    sendOrderToKitchen(item);

    if (tableItems.length === 0 && selectedTable?.status === "FREE") {
      api.patch(`/tables/${selectedTable.id}/status`, { status: "OCCUPIED" }).catch(() => {});
    }

    setSelectedProductId("");
    setNewItemPrice("");
    setNewItemQuantity(1);
  }

  async function saveTableOrder(
    items: any[],
  ) {

    if (!selectedTable) {
      return;
    }

    try {

      await api.patch(
        `/tables/${selectedTable.id}/order`,
        {

          items,

          total:
            items.reduce(
              (
                acc,
                item,
              ) =>

                acc +
                item.price *
                item.quantity,

              0,
            ),
        },
      );

      fetchTables();

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao salvar pedido",
      );
    }
  }

  async function sendOrderToKitchen(
    item: any,
  ) {

    if (!selectedTable) return;

    try {

      await api.post("/orders", {
        customerName: `Mesa ${selectedTable.number}`,
        customerPhone: "SALÃO",
        deliveryAddress: "INTERNO",
        paymentMethod,
        tableId: selectedTable.id,
        items: [{ productId: item.productId, quantity: item.quantity }],
        deliveryFee: 0,
      });

    } catch (error) {

      console.log(error);

      toast.error("Erro ao enviar para cozinha");
    }
  }

  async function updateStatus(
    id: string,
    status: string,
  ) {

    try {

      await api.patch(
        `/tables/${id}/status`,
        {
          status,
        },
      );

      toast.success(
        "Mesa atualizada",
      );

      fetchTables();

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao atualizar mesa",
      );
    }
  }

  async function closeTable() {

    if (!selectedTable) {
      return;
    }

    try {

      // Total real calculado dos Orders persistidos (não do estado local)
      const realTotal = (selectedTable.dineInOrders || [])
        .filter((o: any) => !['CANCELLED'].includes(o.status))
        .reduce((sum: number, o: any) => sum + Number(o.total), 0);

      await api.post(
        "/cash/movement",
        {

          type:
            "SUPPLY",

          value:
            realTotal > 0 ? realTotal : tableTotal,

          paymentMethod,
        },
      );

      await api.patch(`/tables/${selectedTable.id}/status`, {
        status: "FREE",
      });

      setTableItems([]);

      setSelectedTable(null);

      toast.success(
        "Mesa fechada",
      );

      fetchTables();

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao fechar mesa",
      );
    }
  }

  const tableTotal =
    tableItems.reduce(
      (
        acc,
        item,
      ) =>

        acc +
        item.price *
        item.quantity,

      0,
    );

  return (

    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">

      <div className="max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-10">

          <h1 className="text-5xl font-bold">
            Mesas
          </h1>

          <button
            onClick={createTable}
            className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-2xl font-bold shadow-xl"
          >
            Nova Mesa
          </button>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {tables.map((table) => (

            <motion.div
              key={table.id}

              whileHover={{
                y: -5,
                scale: 1.02,
              }}

              transition={{
                duration: 0.2,
              }}

              onClick={() => {

                setSelectedTable(
                  table,
                );

                // Reconstruir itens a partir dos Orders persistidos no banco
                const serverItems = (table.dineInOrders || [])
                  .flatMap((o: any) =>
                    (o.items || []).map((item: any) => ({
                      id:        item.id,
                      productId: item.productId,
                      name:      item.productName,
                      quantity:  Number(item.quantity),
                      price:     Number(item.unitPrice),
                    })),
                  );

                setTableItems(serverItems);
              }}

              className="bg-white border border-gray-200 rounded-3xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            >

              <h2 className="text-3xl font-bold mb-4">
                Mesa {table.number}
              </h2>

              <div className="mb-6">

                <span
                  className={`
                    px-4 py-2 rounded-full text-sm font-bold

                    ${
                      table.status === "FREE"

                        ? "bg-green-500/20 text-green-400"

                      : table.status === "OCCUPIED"

                        ? "bg-red-500/20 text-red-400"

                      : "bg-yellow-500/20 text-yellow-400"
                    }
                  `}
                >

                  {
                    table.status === "FREE"

                      ? "🟢 LIVRE"

                    : table.status === "OCCUPIED"

                      ? "🔴 OCUPADA"

                    : "🟡 RESERVADA"
                  }

                </span>

              </div>

              <select
                value={table.status}

                onClick={(e) => e.stopPropagation()}

                onChange={(e) => {
                  e.stopPropagation();
                  updateStatus(table.id, e.target.value);
                }}

                className="w-full bg-white border border-gray-300 p-3 rounded-2xl text-gray-900"
              >

                <option value="FREE">
                  LIVRE
                </option>

                <option value="OCCUPIED">
                  OCUPADA
                </option>

                <option value="RESERVED">
                  RESERVADA
                </option>

              </select>

            </motion.div>

          ))}

        </div>

      </div>

      {selectedTable && (

        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 border border-gray-200 shadow-2xl overflow-y-auto max-h-[95vh]">

            <div className="flex items-center justify-between mb-8">

              <div>

                <h2 className="text-4xl font-bold">
                  Mesa {selectedTable.number}
                </h2>

                <p className="text-gray-500 mt-2">
                  Comanda aberta
                </p>

              </div>

              <button
                onClick={() => {
                  setSelectedTable(null);
                  setProductSearch("");
                  setSelectedProductId("");
                  setNewItemPrice("");
                }}
                className="bg-gray-100 hover:bg-gray-200 transition px-5 py-3 rounded-2xl text-gray-900"
              >
                Fechar
              </button>

            </div>

            <div className="bg-gray-100 rounded-2xl p-6 mb-8">

              <p className="text-gray-500 text-sm">
                Total da Mesa
              </p>

              <h3 className="text-3xl font-bold mt-2">
                R$ {tableTotal.toFixed(2)}
              </h3>

            </div>

            <div className="bg-gray-100 rounded-2xl p-6 mb-8">

              <h3 className="text-2xl font-bold mb-4">
                Pedidos
              </h3>

              {tableItems.length === 0 ? (

                <p className="text-gray-500">
                  Nenhum pedido
                </p>

              ) : (

                <div className="space-y-4">

                  {tableItems.map((item) => (

                    <div
                      key={item.id}
                      className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex justify-between"
                    >

                      <div>

                        <h4 className="font-bold">
                          {item.name}
                        </h4>

                        <p className="text-gray-500 text-sm">
                          Qtd: {item.quantity}
                        </p>

                      </div>

                      <div className="font-bold">
                        R$ {item.price}
                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

            <div className="bg-gray-100 rounded-2xl p-6">

              <h3 className="text-2xl font-bold mb-6">
                Adicionar Item
              </h3>

              <div className="space-y-4">

                {/* Campo de busca */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setSelectedProductId("");
                      setNewItemPrice("");
                    }}
                    className="w-full bg-white border border-gray-300 pl-9 pr-4 py-3 rounded-2xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Lista filtrada de produtos */}
                {productSearch && (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {products
                      .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setNewItemPrice(String(p.salePrice));
                            setProductSearch(p.name);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition flex justify-between items-center ${selectedProductId === p.id ? "bg-gray-100" : ""}`}
                        >
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-green-400 text-sm font-bold">R$ {Number(p.salePrice).toFixed(2)}</span>
                        </button>
                      ))}
                    {products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-gray-400 text-sm">Nenhum produto encontrado</p>
                    )}
                  </div>
                )}

                {/* Select clássico como fallback quando não há busca */}
                {!productSearch && (
                  productsError ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                      <span className="text-red-400 text-sm">Erro ao carregar produtos</span>
                      <button
                        onClick={fetchProducts}
                        className="text-sm bg-gray-200 hover:bg-gray-300 transition px-3 py-1.5 rounded-xl text-gray-900"
                      >
                        {loadingProducts ? "Carregando..." : "Tentar novamente"}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        const p = products.find((x) => x.id === e.target.value);
                        setNewItemPrice(p ? String(p.salePrice) : "");
                      }}
                      className="w-full bg-white border border-gray-300 p-4 rounded-2xl text-gray-900"
                    >
                      <option value="">
                        {loadingProducts ? "Carregando produtos..." : products.length === 0 ? "Nenhum produto cadastrado" : "Selecione um produto..."}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — R$ {Number(p.salePrice).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )
                )}

                {newItemPrice && (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl">
                    <span className="text-gray-500 text-sm">Preço unitário</span>
                    <span className="font-bold text-green-400 text-lg">
                      R$ {Number(newItemPrice).toFixed(2)}
                    </span>
                  </div>
                )}

                <input
                  placeholder="Quantidade"
                  type="number"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 p-4 rounded-2xl"
                />

                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-4 rounded-2xl text-gray-900"
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="DEBIT_CARD">Cartão de Débito</option>
                </select>

              </div>

            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">

              <button
                onClick={addItemToTable}
                className="bg-green-500 hover:bg-green-600 transition py-4 rounded-2xl font-bold"
              >
                Adicionar Pedido
              </button>

              <button
                onClick={closeTable}
                className="bg-red-500 hover:bg-red-600 transition py-4 rounded-2xl font-bold"
              >
                Fechar Conta
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}