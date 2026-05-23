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

  const [newItemName, setNewItemName] =
    useState("");

  const [newItemPrice, setNewItemPrice] =
    useState("");

  const [newItemQuantity, setNewItemQuantity] =
    useState(1);

  const [paymentMethod, setPaymentMethod] =
    useState("PIX");

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

    if (
      !newItemName ||
      !newItemPrice
    ) {

      toast.error(
        "Preencha produto e valor",
      );

      return;
    }

    const item = {

      id: Date.now(),

      name:
        newItemName,

      quantity:
        newItemQuantity,

      price:
        Number(newItemPrice),
    };

    const updatedItems = [
      ...tableItems,
      item,
    ];

    setTableItems(
      updatedItems,
    );

    saveTableOrder(
      updatedItems,
    );

    sendOrderToKitchen(
      item,
    );

    setNewItemName("");

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

    if (!selectedTable) {
      return;
    }

    try {

      await api.post(
        "/orders",
        {

          customerName:
            `Mesa ${selectedTable.number}`,

          customerPhone:
            "SALÃO",

          address:
            "INTERNO",

          paymentMethod,

          items: JSON.stringify([
            item,
          ]),

          total:
            item.price *
            item.quantity,

          subtotal:
            item.price *
            item.quantity,

          deliveryFee: 0,

          status:
            "PENDING",

          productionStatus:
            "PENDING",
        },
      );

    } catch (error) {

      console.log(error);

      toast.error(
        "Erro ao enviar cozinha",
      );
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

      await api.post(
        "/cash/movement",
        {

          type:
            "SUPPLY",

          value:
            tableTotal,

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

    <main className="min-h-screen bg-slate-950 text-white p-8">

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

                setTableItems(
                  table.items || [],
                );
              }}

              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 cursor-pointer"
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

                onChange={(e) =>
                  updateStatus(
                    table.id,
                    e.target.value,
                  )
                }

                className="w-full bg-slate-800 p-3 rounded-2xl"
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

          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl p-8 border border-slate-800 overflow-y-auto max-h-[95vh]">

            <div className="flex items-center justify-between mb-8">

              <div>

                <h2 className="text-4xl font-bold">
                  Mesa {selectedTable.number}
                </h2>

                <p className="text-slate-400 mt-2">
                  Comanda aberta
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedTable(null)
                }
                className="bg-slate-800 hover:bg-slate-700 transition px-5 py-3 rounded-2xl"
              >
                Fechar
              </button>

            </div>

            <div className="bg-slate-800 rounded-2xl p-6 mb-8">

              <p className="text-slate-400 text-sm">
                Total da Mesa
              </p>

              <h3 className="text-3xl font-bold mt-2">
                R$ {tableTotal.toFixed(2)}
              </h3>

            </div>

            <div className="bg-slate-800 rounded-2xl p-6 mb-8">

              <h3 className="text-2xl font-bold mb-4">
                Pedidos
              </h3>

              {tableItems.length === 0 ? (

                <p className="text-slate-400">
                  Nenhum pedido
                </p>

              ) : (

                <div className="space-y-4">

                  {tableItems.map((item) => (

                    <div
                      key={item.id}
                      className="bg-slate-700 rounded-2xl p-4 flex justify-between"
                    >

                      <div>

                        <h4 className="font-bold">
                          {item.name}
                        </h4>

                        <p className="text-slate-400 text-sm">
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

            <div className="bg-slate-800 rounded-2xl p-6">

              <h3 className="text-2xl font-bold mb-6">
                Novo Pedido
              </h3>

              <div className="space-y-4">

                <input
                  placeholder="Produto"

                  value={newItemName}

                  onChange={(e) =>
                    setNewItemName(
                      e.target.value,
                    )
                  }

                  className="w-full bg-slate-700 p-4 rounded-2xl"
                />

                <input
                  placeholder="Preço"

                  type="number"

                  value={newItemPrice}

                  onChange={(e) =>
                    setNewItemPrice(
                      e.target.value,
                    )
                  }

                  className="w-full bg-slate-700 p-4 rounded-2xl"
                />

                <input
                  placeholder="Quantidade"

                  type="number"

                  value={newItemQuantity}

                  onChange={(e) =>
                    setNewItemQuantity(
                      Number(
                        e.target.value,
                      ),
                    )
                  }

                  className="w-full bg-slate-700 p-4 rounded-2xl"
                />

                <select
                  value={paymentMethod}

                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value,
                    )
                  }

                  className="w-full bg-slate-700 p-4 rounded-2xl"
                >

                  <option value="PIX">
                    PIX
                  </option>

                  <option value="CASH">
                    DINHEIRO
                  </option>

                  <option value="CARD">
                    CARTÃO
                  </option>

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