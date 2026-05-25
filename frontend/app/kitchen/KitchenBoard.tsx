"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

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
                key={order.id}
                draggableId={order.id}
                index={index}
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
                  >
                    <h3 className="text-2xl font-bold mb-3">
                      {order.productName || "Pedido"}
                    </h3>
                    <p className="text-gray-500 mb-2">
                      Cliente: {order.customerName}
                    </p>
                    <div className="mb-4">
                      <span className={`
                        px-4 py-2 rounded-full text-sm font-bold
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
                    <p className="text-gray-500 mb-6">
                      Total: R$ {order.total}
                    </p>
                    <button
                      onClick={() => updateStatus(order.id, action)}
                      className="w-full bg-white text-black font-bold py-3 rounded-xl"
                    >
                      {actionLabel}
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
}: {
  orders: any[];
  updateStatus: (id: string, status: string) => void;
  handleDragEnd: (result: any) => void;
  containerRef: React.RefObject<any>;
}) {
  const pending   = orders.filter((o) => o.productionStatus === "PENDING");
  const preparing = orders.filter((o) => o.productionStatus === "PREPARING");
  const ready     = orders.filter((o) => o.productionStatus === "READY");

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
          />
          <Column
            title="Preparando"
            color="blue"
            orders={preparing}
            droppableId="READY"
            action="READY"
            actionLabel="Finalizar"
            updateStatus={updateStatus}
          />
          <Column
            title="Prontos"
            color="green"
            orders={ready}
            droppableId="PENDING"
            action="PENDING"
            actionLabel="Reabrir"
            updateStatus={updateStatus}
          />
        </div>
      </main>
    </DragDropContext>
  );
}
