export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "https://food-system-backend-no7d.onrender.com/api";

// Socket.IO conecta na raiz do servidor, sem /api
export const socketBaseUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://food-system-backend-no7d.onrender.com";

export const frontendBaseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
