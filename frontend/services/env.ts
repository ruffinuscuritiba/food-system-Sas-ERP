export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const socketBaseUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL || apiBaseUrl;

export const frontendBaseUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
