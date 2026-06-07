import { io, Socket } from "socket.io-client";
import { socketBaseUrl } from "@/services/env";

let _socket: Socket | null = null;

export function getTrackingSocket(): Socket {
  if (!_socket) {
    _socket = io(`${socketBaseUrl}/tracking`, {
      transports: ["websocket"],
      autoConnect: false,
      auth: (cb) => {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        cb({ token });
      },
    });
  }
  return _socket;
}

export function disconnectTrackingSocket() {
  if (_socket?.connected) _socket.disconnect();
  _socket = null;
}
