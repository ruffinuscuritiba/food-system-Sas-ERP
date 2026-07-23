import { io } from "socket.io-client";

import { socketBaseUrl } from "@/services/env";

// auth is evaluated at connection time, not at module load,
// so the token is read from localStorage only when the socket actually connects.
export const socket = io(socketBaseUrl, {
  // "websocket" puro (sem fallback polling) é mais frágil atrás de proxies/
  // CDNs que fazem upgrade de forma diferente — deixa o socket.io tentar
  // polling primeiro e fazer upgrade, como o padrão da lib recomenda.
  transports: ["polling", "websocket"],
  autoConnect: false,
  auth: (cb) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;
    cb({ token });
  },
});
