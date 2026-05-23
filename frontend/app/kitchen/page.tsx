"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

import {
  useEffect,
  useState,
  useRef,
} from "react";

import { socket } from "@/services/socket";

import { api } from "@/services/api";

export default function KitchenPage() {

  const [orders, setOrders] =
    useState<any[]>([]);

  const audioRef =
    useRef<any>(null);

  const printedOrders =
    useRef<any[]>([]);

  const containerRef =
    useRef<any>(null);

  async function loadOrders() {

    const response =
      await api.get(
        "/orders",
      );

    setOrders(
      response.data,
    );
  }

  function printKitchenOrder(
    order: any,
  ) {

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=400,height=600",
      );

    if (!printWindow) {
      return;
    }

    const items =
      JSON.parse(
        order.items || "[]",
      );

    const itemsHtml =
      items.map(
        (item: any) => `
          <div style="margin-bottom:15px;">

            <b style="font-size:22px;">
              ${item.name}
            </b>

            <br/>

            ${item.size || ""}

            <br/>

            ${item.border || ""}

            <br/>

            ${item.flavorType || ""}

            <br/>

            ${item.secondFlavor || ""}

            <br/>

            <b>
              Qtd:
              ${item.quantity}
            </b>

            <br/>

            ${item.notes || ""}
          </div>
        `,
      ).join("");

    printWindow.document.write(`
      <html>

        <head>

          <title>
            Pedido
          </title>

          <style>

            body {

              font-family: Arial;

              width: 300px;

              padding: 20px;
            }

            h1 {

              text-align: center;

              font-size: 28px;
            }

            h2 {

              font-size: 22px;
            }

            .line {

              margin-bottom: 12px;

              font-size: 18px;
            }

            hr {

              margin: 20px 0;
            }

          </style>

        </head>

        <body>

          <h1>
            COZINHA
          </h1>

          <hr/>

          <div class="line">

            <b>
              Cliente:
            </b>

            ${order.customerName}

          </div>

          <div class="line">

            <b>
              Pagamento:
            </b>

            ${order.paymentMethod}

          </div>

          <div class="line">

            <b>
              Total:
            </b>

            R$ ${order.total}

          </div>

          <hr/>

          ${itemsHtml}

          <hr/>

          <h2>
            ${order.productionStatus}
          </h2>

        </body>

      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    printWindow.print();
  }

  useEffect(() => {

    loadOrders();

    socket.connect();

    socket.on(
      "orderCreated",
      (newOrder) => {

        loadOrders();

        if (
          !printedOrders.current.includes(
            newOrder.id,
          )
        ) {

          printedOrders.current.push(
            newOrder.id,
          );

          audioRef.current?.play();

          printKitchenOrder(
            newOrder,
          );
        }
      },
    );

    socket.on(
      "kitchenUpdate",
      () => {

        loadOrders();
      },
    );

    return () => {

      socket.off("orderCreated");

      socket.off("kitchenUpdate");

      socket.disconnect();
    };

  }, []);

  function getOrderTime(
    createdAt: string,
  ) {

    const created =
      new Date(createdAt)
        .getTime();

    const now =
      new Date().getTime();

    const minutes =
      Math.floor(
        (now - created) /
        1000 /
        60,
      );

    return minutes;
  }

  function enterFullscreen() {

    if (
      containerRef.current
        ?.requestFullscreen
    ) {

      containerRef.current
        .requestFullscreen();
    }
  }

  async function updateStatus(
    id: string,
    productionStatus: string,
  ) {

    await api.patch(
      `/orders/${id}/production-status`,
      {
        productionStatus,
      },
    );

    loadOrders();
  }

  async function handleDragEnd(
    result: any,
  ) {

    if (!result.destination)
      return;

    const orderId =
      result.draggableId;

    const newStatus =
      result.destination
        .droppableId;

    await updateStatus(
      orderId,
      newStatus,
    );

    loadOrders();
  }

  const pending =
    orders.filter(
      (o) =>
        o.productionStatus ===
        "PENDING",
    );

  const preparing =
    orders.filter(
      (o) =>
        o.productionStatus ===
        "PREPARING",
    );

  const ready =
    orders.filter(
      (o) =>
        o.productionStatus ===
        "READY",
    );

  return (

    <>
      <audio
        ref={audioRef}
        src="/notification.mp3"
      />

      <DragDropContext
        onDragEnd={
          handleDragEnd
        }
      >

        <main
          ref={containerRef}
          className="min-h-screen bg-slate-950 text-white p-8"
        >

          <div className="flex items-center justify-between mb-10">

            <h1 className="text-5xl font-bold">
              KDS Cozinha
            </h1>

            <button
              onClick={enterFullscreen}
              className="bg-white text-black px-6 py-3 rounded-2xl font-bold"
            >
              Fullscreen TV
            </button>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            <Column
              title="Pendentes"
              color="yellow"
              orders={pending}
              droppableId="PREPARING"
              action="PREPARING"
              actionLabel="Iniciar"
              updateStatus={updateStatus}
              getOrderTime={getOrderTime}
            />

            <Column
              title="Preparando"
              color="blue"
              orders={preparing}
              droppableId="READY"
              action="READY"
              actionLabel="Finalizar"
              updateStatus={updateStatus}
              getOrderTime={getOrderTime}
            />

            <Column
              title="Prontos"
              color="green"
              orders={ready}
              droppableId="PENDING"
              action="PENDING"
              actionLabel="Reabrir"
              updateStatus={updateStatus}
              getOrderTime={getOrderTime}
            />

          </div>

        </main>

      </DragDropContext>

    </>
  );
}

function Column({
  title,
  orders,
  color,
  action,
  actionLabel,
  updateStatus,
  droppableId,
  getOrderTime,
}: any) {

  return (

    <div className={`

      rounded-3xl p-6 border

      ${
        color === "yellow"

          ? "bg-yellow-500/10 border-yellow-500"

          : color === "blue"

            ? "bg-blue-500/10 border-blue-500"

            : "bg-green-500/10 border-green-500"
      }
    `}>

      <h2 className="text-3xl font-bold mb-8">
        {title}
      </h2>

      <Droppable
        droppableId={
          droppableId
        }
      >

        {(provided) => (

          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-6 min-h-[500px]"
          >

            {orders.map(
              (
                order: any,
                index: number,
              ) => (

                <Draggable
                  key={order.id}
                  draggableId={
                    order.id
                  }
                  index={index}
                >

                  {(provided) => (

                    <div
                      ref={
                        provided.innerRef
                      }
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="bg-slate-900 rounded-2xl p-6 border border-slate-800"
                    >

                      <h3 className="text-2xl font-bold mb-3">

                        {order.productName ||
                          "Pedido"}

                      </h3>

                      <p className="text-slate-400 mb-2">

                        Cliente:
                        {" "}
                        {order.customerName}

                      </p>

                      <div className="mb-4">

                        <span className={`

                          px-4 py-2 rounded-full text-sm font-bold

                          ${
                            getOrderTime(
                              order.createdAt,
                            ) > 30

                              ? "bg-red-500"

                              : getOrderTime(
                                order.createdAt,
                              ) > 15

                                ? "bg-yellow-500"

                                : "bg-green-500"
                          }

                        `}>

                          {
                            getOrderTime(
                              order.createdAt,
                            )
                          }
                          min

                        </span>

                      </div>

                      <p className="text-slate-400 mb-6">

                        Total:
                        {" "}

                        R$
                        {" "}

                        {order.total}

                      </p>

                      <button
                        onClick={() =>
                          updateStatus(
                            order.id,
                            action,
                          )
                        }
                        className="w-full bg-white text-black font-bold py-3 rounded-xl"
                      >
                        {actionLabel}
                      </button>

                    </div>

                  )}

                </Draggable>

              ),
            )}

            {provided.placeholder}

          </div>

        )}

      </Droppable>

    </div>
  );
}