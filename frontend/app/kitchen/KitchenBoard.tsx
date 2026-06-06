"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { Printer } from "lucide-react";

function getOrderTime(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - created) / 1000 / 60);
}

function Column({
  title,
  orders,
  color,
  action,
  actionLabel,
  updateStatus,
  droppableId,
  onPrint,
}: any) {
  return (
    <div className={`
      rounded-3xl p-6 border
      ${color === "yellow"
        ? "bg-yellow-500/10 border-yellow-500"
        : color === "blue"
          ? "bg-blue-500/10 border-blue-500"
          : "bg-green-500/10 border-green-500"
      }
    `}>
      <h2 className="text-3xl font-bold mb-8">{title}</h2>

      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-6 min-h-[500px]"
          >
            {orders.map((order: any, index: number) => (
              <Draggable
                key={`${order.source ?? 'PDV'}-${order.id}`}
                draggableId={`${order.source ?? 'PDV'}-${order.id}`}
                index={index}
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-xl font-bold truncate max-w-[55%]">
                          {order.customer?.name || order.customerName || "Pedido"}
                        </h3>
                        {/* Adapter Item 4 — fonte do pedido */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md tracking-wide shrink-0 ${
                          order.source === "ONLINE"
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : order.source === "MOCK"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : order.source === "IFOOD"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}>
                          {order.source ?? "PDV"}
                        </span>
                      </div>
                      <span className={`
                        px-3 py-1 rounded-full text-xs font-bold text-white
                        ${getOrderTime(order.createdAt) > 30
                          ? "bg-red-500"
                          : getOrderTime(order.createdAt) > 15
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }
                      `}>
                        {getOrderTime(order.createdAt)}min
                      </span>
                    </div>

                    {/* Fase 2: badge de tipo de atendimento */}
                    <div className="mb-3 flex items-center gap-2">
                      {order.orderType === "DELIVERY" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                          🛵 Delivery
                        </span>
                      )}
                      {order.orderType === "PICKUP" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">
                          🏠 Retirada
                        </span>
                      )}
                      {(order.orderType === "DINE_IN" || !order.orderType) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          🍽️ Balcão{order.notes && order.notes.match(/Mesa\s+\d+/i) ? ` — ${order.notes.match(/Mesa\s+\d+/i)![0]}` : ""}
                        </span>
                      )}
                      {order.deliveryAddress && order.orderType === "DELIVERY" && (
                        <span className="text-xs text-gray-500 truncate max-w-[160px]" title={order.deliveryAddress}>
                          📍 {order.deliveryAddress}
                        </span>
                      )}
                    </div>

                    <div className="mb-4 space-y-3">
                      {Array.isArray(order.items) && order.items.map((item: any, i: number) => (
                        <div key={item.id || i} className="border-l-4 border-gray-200 pl-3">
                          <p className="font-bold text-gray-800">
                            {item.quantity}x {item.productName || item.name}
                          </p>
                          {item.notes && (
                            <p className="text-gray-500 text-sm italic mt-0.5">Obs: {item.notes}</p>
                          )}
                          {Array.isArray(item.selectedComplements) && item.selectedComplements.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {item.selectedComplements.map((c: any, ci: number) => (
                                <li key={ci} className="text-gray-600 text-sm">
                                  + {c.quantity}x {c.optionName}
                                  {Number(c.price) > 0 && (
                                    <span className="text-gray-400 ml-1">(R${Number(c.price).toFixed(2)})</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-gray-500 text-sm mb-4">
                      Total: R$ {Number(order.total).toFixed(2)}
                    </p>
                    <button
                      onClick={() => updateStatus(order.source ?? "PDV", order.id, action)}
                      className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-700 transition"
                    >
                      {actionLabel}
                    </button>
                    <button
                      onClick={() => onPrint(order)}
                      className="w-full mt-2 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-500 py-2 rounded-xl text-sm font-medium transition"
                    >
                      <Printer size={14} /> Reimprimir
                    </button>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function KitchenBoard({
  orders,
  updateStatus,
  handleDragEnd,
  containerRef,
  onPrint,
}: {
  orders: any[];
  updateStatus: (source: string, id: string, status: string) => void;
  handleDragEnd: (result: any) => void;
  containerRef: React.RefObject<any>;
  onPrint: (order: any) => void;
}) {
  // Order.productionStatus não existe no schema — filtra por status
  const pending   = orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED");
  const preparing = orders.filter((o) => o.status === "PREPARING");
  const ready     = orders.filter((o) => o.status === "READY");

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <main
        ref={containerRef}
        className="min-h-screen bg-gray-50 text-gray-900 p-8"
      >
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-5xl font-bold">KDS Cozinha</h1>
          <button
            onClick={() => containerRef.current?.requestFullscreen?.()}
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
            onPrint={onPrint}
          />
          <Column
            title="Preparando"
            color="blue"
            orders={preparing}
            droppableId="READY"
            action="READY"
            actionLabel="Finalizar"
            updateStatus={updateStatus}
            onPrint={onPrint}
          />
          <Column
            title="Prontos"
            color="green"
            orders={ready}
            droppableId="DELIVERED"
            action="DELIVERED"
            actionLabel="Entregue ✓"
            updateStatus={updateStatus}
            onPrint={onPrint}
          />
        </div>
      </main>
    </DragDropContext>
  );
}
