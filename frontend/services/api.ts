import axios from "axios";

import { apiBaseUrl }
from "./env";

export const api =
  axios.create({

    baseURL:
      apiBaseUrl,

    withCredentials: true,

    timeout: 30000,
  });

api.interceptors.request.use(

  (config) => {

    if (
      typeof window !==
      "undefined"
    ) {

      const token =
        localStorage.getItem(
          "token",
        );

      const skipAuth =
        config.url?.includes("auth/login") ||
        config.url?.includes("auth/signup") ||
        config.url?.includes("auth/register");

      if (token && !skipAuth) {

        config.headers.Authorization =
          `Bearer ${token}`;
      }
    }

    return config;
  },

  (error) => {

    return Promise.reject(
      error,
    );
  },
);

api.interceptors.response.use(

  (response) => response,

  async (error) => {

    const status =
      error.response?.status;

    const requestUrl: string = (error.config as any)?.url ?? "";
    const isLoginAttempt = requestUrl.includes("auth/login");

    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !isLoginAttempt
    ) {

      localStorage.removeItem(
        "token",
      );

      localStorage.removeItem(
        "user",
      );

      document.cookie =
        "token=; Max-Age=0; path=/";

      window.location.href =
        "/login";
    }

    return Promise.reject(
      error,
    );
  },
);

export default api;