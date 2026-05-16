"use client";
import { apiBaseUrl, socketBaseUrl } from "@/services/env";

import {
  useEffect,
  useState,
} from "react";

import { io } from "socket.io-client";

export default function OrderStatusPage() {

  const [orders, setOrders] =
    useState<any[]>([]);

  useEffect(() => {

    loadOrders();

    const socket =
      io(
        socketBaseUrl,
      );

    socket.on(
      "kitchenUpdate",
      () => {

        loadOrders();
      },
    );

    return () => {

      socket.disconnect();
    };

  }, []);

  async function loadOrders() {

    const response =
      await fetch(
        `${apiBaseUrl}/orders`,
      );

    const data =
      await response.json();

    setOrders(data);
  }

  function getColor(
    status: string,
  ) {

    switch (status) {

      case "RECEBIDO":
        return "bg-yellow-500";

      case "PREPARANDO":
        return "bg-orange-500";

      case "SAIU":
        return "bg-blue-500";

      case "ENTREGUE":
        return "bg-green-500";

      default:
        return "bg-gray-500";
    }
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="max-w-5xl mx-auto">

        <div className="mb-12">

          <h1 className="text-5xl font-black">
            Acompanhar Pedido
          </h1>

          <p className="text-slate-400 mt-4">
            Status em tempo real
          </p>

        </div>

        <div className="space-y-6">

          {orders.map((order) => (

            <div
              key={order.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8"
            >

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-2xl font-bold">

                    {order.customerName}

                  </h2>

                  <p className="text-slate-400 mt-2">

                    Pedido:
                    {" "}
                    {order.id.slice(0, 8)}

                  </p>

                </div>

                <div
                  className={`
                    px-6 py-3 rounded-2xl font-bold text-white
                    ${getColor(
                      order.productionStatus,
                    )}
                  `}
                >

                  {order.productionStatus}

                </div>

              </div>

              <div className="mt-8">

                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">

                  <div
                    className={`
                      h-full transition-all duration-500

                      ${
                        order.productionStatus ===
                        "RECEBIDO"

                          ? "w-1/4 bg-yellow-500"

                          : order.productionStatus ===
                            "PREPARANDO"

                          ? "w-2/4 bg-orange-500"

                          : order.productionStatus ===
                            "SAIU"

                          ? "w-3/4 bg-blue-500"

                          : "w-full bg-green-500"
                      }
                    `}
                  />

                </div>

              </div>

            </div>
          ))}

        </div>

      </div>

    </main>
  );
}