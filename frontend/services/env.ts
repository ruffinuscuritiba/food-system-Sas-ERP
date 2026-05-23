const LIVE_BACKEND = "https://food-system-backend-no7d.onrender.com";

const rawApi = process.env.NEXT_PUBLIC_API_URL || `${LIVE_BACKEND}/api`;
const rawSocket = process.env.NEXT_PUBLIC_SOCKET_URL || LIVE_BACKEND;

export const apiBaseUrl = rawApi.includes("94zd") ? `${LIVE_BACKEND}/api` : rawApi;
export const socketBaseUrl = rawSocket.includes("94zd") ? LIVE_BACKEND : rawSocket;
export const frontendBaseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://food-system-sas-erp-frontend.vercel.app";