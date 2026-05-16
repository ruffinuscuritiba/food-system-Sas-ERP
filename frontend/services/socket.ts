import { io } from "socket.io-client";

import { socketBaseUrl } from "@/services/env";

export const socket = io(

  socketBaseUrl,

  {
    transports: ["websocket"],
  },
);