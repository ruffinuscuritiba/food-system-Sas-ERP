import axios from "axios";

const api = axios.create({

  baseURL:
    "http://192.168.15.127:3001",
});

api.interceptors.request.use(

  (config) => {

    const token =
      localStorage.getItem(
        "token",
      );

    if (token) {

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
);

export default api;