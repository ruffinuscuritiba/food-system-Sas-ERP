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

      if (token) {

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

    if (
      status === 401 &&
      typeof window !==
        "undefined"
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