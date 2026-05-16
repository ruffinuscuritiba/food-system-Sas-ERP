import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";

import { Server }
from "socket.io";

@WebSocketGateway({

  cors: {
    origin: "*",
  },
})
export class SocketGateway {

  @WebSocketServer()
  server: Server;

  emitOrderCreated(
    order: any,
  ) {

    this.server.emit(
      "orderCreated",
      order,
    );
  }

  emitKitchenUpdate(
    order: any,
  ) {

    this.server.emit(
      "kitchenUpdate",
      order,
    );
  }

  emitDashboardUpdate(
    data: any,
  ) {

    this.server.emit(
      "dashboardUpdate",
      data,
    );
  }

  emitTableUpdate(
    data: any,
  ) {

    this.server.emit(
      "tableUpdate",
      data,
    );
  }
}