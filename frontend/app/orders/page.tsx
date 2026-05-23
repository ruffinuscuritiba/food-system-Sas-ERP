"use client";
import { apiBaseUrl } from "@/services/env";

import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { socket } from "@/services/socket";

type Order = {
  id: string;

  customerName: string;

  customerPhone: string;

  address: string;

  paymentMethod: string;

  deliveryFee: number;

  total: number;

  status: string;

  items: string;
};

export default function OrdersPage() {

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  async function fetchOrders() {

    try {

      const response =
        await fetch(
          `${apiBaseUrl}/orders`,
        );

      const data =
        await response.json();

      setOrders(data);

    } catch {

      toast.error(
        "Erro ao carregar pedidos",
      );

    } finally {

      setLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    status: string,
  ) {

    try {

      await fetch(
        `${apiBaseUrl}/orders/${id}/status`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            status,
          }),
        },
      );

      toast.success(
        "Status atualizado",
      );

      fetchOrders();

    } catch {

      toast.error(
        "Erro ao atualizar status",
      );
    }
  }

  function printOrder(order: Order) {

    const printWindow =
      window.open("", "_blank");

    if (!printWindow) return;

    const items =
      JSON.parse(
        order.items || "[]",
      );

    const itemsHtml =
      items.map(
        (item: any) => `
          <div style="margin-bottom:10px;">
            <b>${item.name}</b><br/>

            ${item.size || ""}<br/>

            ${item.border || ""}<br/>

            ${item.flavorType || ""}<br/>

            ${item.secondFlavor || ""}<br/>

            ${item.notes || ""}
          </div>
        `,
      ).join("");

    printWindow.document.write(`
      <html>

        <head>

          <title>Pedido</title>

          <style>

            body {
              font-family: Arial;
              width: 300px;
              padding: 20px;
            }

            h1 {
              text-align: center;
            }

            .line {
              margin-bottom: 10px;
            }

            hr {
              margin: 20px 0;
            }

          </style>

        </head>

        <body>

          <h1>Ruffinus Pizza</h1>

          <hr />

          <div class="line">
            <b>Cliente:</b>
            ${order.customerName}
          </div>

          <div class="line">
            <b>Telefone:</b>
            ${order.customerPhone}
          </div>

          <div class="line">
            <b>Endereço:</b>
            ${order.address}
          </div>

          <div class="line">
            <b>Pagamento:</b>
            ${order.paymentMethod}
          </div>

          <hr />

          ${itemsHtml}

          <hr />

          <div class="line">
            <b>Entrega:</b>
            R$ ${order.deliveryFee || 0}
          </div>

          <div class="line">
            <b>Total:</b>
            R$ ${order.total}
          </div>

          <hr />

          <h2>
            ${order.status}
          </h2>

        </body>

      </html>
    `);

    printWindow.document.close();

    printWindow.print();
  }

  useEffect(() => {

    fetchOrders();

    socket.connect();

    socket.on("orderCreated", fetchOrders);

    socket.on("kitchenUpdate", fetchOrders);

    return () => {

      socket.off("orderCreated");

      socket.off("kitchenUpdate");

      socket.disconnect();
    };

  }, []);

  return (

    <main className="space-y-6">

      <div>

        <h1 className="text-4xl font-bold text-white">
          Pedidos
        </h1>

        <p className="text-slate-400 mt-2">
          Gestão operacional em tempo real
        </p>

      </div>

      {loading ? (

        <div className="text-slate-400">
          Carregando pedidos...
        </div>

      ) : (

        <div className="grid gap-6">

          {orders.map((order) => (

            <div
              key={order.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6"
            >

              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">

                <div>

                  <h2 className="text-2xl font-bold text-white">
                    {order.customerName}
                  </h2>

                  <p className="text-slate-400 mt-2">
                    {order.customerPhone}
                  </p>

                  <p className="text-slate-400">
                    {order.address}
                  </p>

                  <div className="mt-6 space-y-3">

                    {JSON.parse(
                      order.items || "[]",
                    ).map(
                      (
                        item: any,
                        index: number,
                      ) => (

                        <div
                          key={index}
                          className="bg-slate-800 rounded-2xl p-4"
                        >

                          <p className="font-bold text-white">
                            {item.name}
                          </p>

                          <p className="text-sm text-slate-400">
                            {item.size}
                          </p>

                          <p className="text-sm text-slate-400">
                            Borda:
                            {" "}
                            {item.border}
                          </p>

                          <p className="text-sm text-slate-400">
                            {item.flavorType}
                          </p>

                          {item.notes && (

                            <p className="text-sm italic text-yellow-400">
                              Obs:
                              {" "}
                              {item.notes}
                            </p>
                          )}

                        </div>
                      ),
                    )}

                  </div>

                </div>

                <div className="xl:text-right">

                  <p className="text-slate-400">
                    Entrega:
                    {" "}
                    R$ {order.deliveryFee || 0}
                  </p>

                  <p className="text-green-400 text-4xl font-bold mt-2">
                    R$ {order.total}
                  </p>

                  <p className="mt-3 text-slate-300">
                    {order.paymentMethod}
                  </p>

                  <select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(
                        order.id,
                        e.target.value,
                      )
                    }
                    className="mt-4 bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-2xl outline-none"
                  >

                    <option value="PENDING">
                      Pendente
                    </option>

                    <option value="CONFIRMED">
                      Confirmado
                    </option>

                    <option value="PREPARING">
                      Preparando
                    </option>

                    <option value="READY">
                      Pronto
                    </option>

                    <option value="OUT_FOR_DELIVERY">
                      Saiu entrega
                    </option>

                    <option value="DELIVERED">
                      Finalizado
                    </option>

                  </select>

                  <button
                    onClick={() =>
                      printOrder(order)
                    }
                    className="mt-4 w-full bg-green-500 hover:bg-green-600 transition text-white px-4 py-3 rounded-2xl font-bold"
                  >
                    Imprimir
                  </button>

                </div>

              </div>

            </div>
          ))}

        </div>
      )}

    </main>
  );
}