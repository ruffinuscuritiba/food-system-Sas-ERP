// Working production backend (Render service food-system-backend, URL: no7d)
// The "94zd" service was recreated/broken — route any stale Vercel env var to no7d.
const PROD_BACKEND = "https://food-system-backend-no7d.onrender.com";

const rawApi    = process.env.NEXT_PUBLIC_API_URL    || `${PROD_BACKEND}/api`;
const rawSocket = process.env.NEXT_PUBLIC_SOCKET_URL || PROD_BACKEND;

export const apiBaseUrl     = rawApi.includes("94zd")    ? `${PROD_BACKEND}/api` : rawApi;
export const socketBaseUrl  = rawSocket.includes("94zd") ? PROD_BACKEND           : rawSocket;
export const frontendBaseUrl= process.env.NEXT_PUBLIC_FRONTEND_URL
  || "https://food-system-sas-erp-frontend.vercel.app";