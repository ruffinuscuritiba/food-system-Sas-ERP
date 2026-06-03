// URLs resolved from environment variables only.
// Required in .env.local (dev) or Vercel dashboard (prod):
//   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_FRONTEND_URL
if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== "undefined") {
  console.warn("[env] NEXT_PUBLIC_API_URL is not set — API calls will fail. Check .env.local");
}

export const apiBaseUrl     = process.env.NEXT_PUBLIC_API_URL      ?? "";
export const socketBaseUrl  = process.env.NEXT_PUBLIC_SOCKET_URL   ?? "";
export const frontendBaseUrl= process.env.NEXT_PUBLIC_FRONTEND_URL ?? "";