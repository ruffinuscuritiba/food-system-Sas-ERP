const DEFAULT_BACKEND_URL = "https://food-system-backend-no7d.onrender.com";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || `${DEFAULT_BACKEND_URL}/api`;

// Socket.IO conecta na raiz do servidor, sem /api
export const socketBaseUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL || DEFAULT_BACKEND_URL;

export const frontendBaseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://food-system-sas-erp-frontend.vercel.app";