// VPS Hostinger backend (migrado em 11/06/2026 — Render suspenso)
const PROD_BACKEND = "https://api.srv1747711.hstgr.cloud";

const rawApi    = process.env.NEXT_PUBLIC_API_URL    || `${PROD_BACKEND}/api`;
const rawSocket = process.env.NEXT_PUBLIC_SOCKET_URL || PROD_BACKEND;

// Filtra URLs de serviços antigos (onrender.com, 94zd) → força VPS
const isStaleUrl = (url: string) =>
  url.includes("94zd") || url.includes("onrender.com");

export const apiBaseUrl    = isStaleUrl(rawApi)    ? `${PROD_BACKEND}/api` : rawApi;
export const socketBaseUrl = isStaleUrl(rawSocket) ? PROD_BACKEND          : rawSocket;
export const frontendBaseUrl= process.env.NEXT_PUBLIC_FRONTEND_URL
  || "https://food-system-sas-erp-frontend.vercel.app";