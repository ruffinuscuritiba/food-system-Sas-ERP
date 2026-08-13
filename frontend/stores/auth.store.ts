import { create } from "zustand";

import Cookies from "js-cookie";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  setAuth: (
    token: string,
    user: User,
  ) => void;

  loadAuth: () => void;

  logout: () => void;

  isAdmin: () => boolean;

  isKitchen: () => boolean;

  isCashier: () => boolean;

  isDelivery: () => boolean;

  isDemo: () => boolean;
};

export const useAuthStore =
  create<AuthStore>((set, get) => ({

    user: null,

    token: null,

    isAuthenticated: false,

    setAuth: (
      token,
      user,
    ) => {

      // Sem `expires`, js-cookie grava um cookie de SESSÃO — some assim que o
      // processo do navegador/PWA fecha (comum no celular: Android/iOS
      // costumam encerrar a aba/atalho em segundo plano pra liberar memória).
      // middleware.ts só enxerga esse cookie (não localStorage, que é
      // client-side e roda depois do middleware barrar a rota) — o JWT
      // continua válido por 7d, mas o entregador era jogado pro /login de
      // novo a cada abertura do app, mesmo o token ainda sendo válido
      // (achado real: 13/08/2026, "toda vez que vai entrar precisa
      // cadastrar a senha"). 7 dias casa com o expiresIn do JWT em si
      // (auth.module.ts).
      Cookies.set(
        "token",
        token,
        { expires: 7, sameSite: "lax" },
      );

      localStorage.setItem(
        "token",
        token,
      );

      localStorage.setItem(
        "user",
        JSON.stringify(user),
      );

      set({
        token,
        user,
        isAuthenticated: true,
      });
    },

    loadAuth: () => {

      if (
        typeof window ===
        "undefined"
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          "token",
        );

      const user =
        localStorage.getItem(
          "user",
        );

      if (
        token &&
        user
      ) {

        set({
          token,
          user: JSON.parse(user),
          isAuthenticated: true,
        });
      }
    },

    logout: () => {

      Cookies.remove(
        "token",
      );

      localStorage.removeItem(
        "token",
      );

      localStorage.removeItem(
        "user",
      );

      set({
        token: null,
        user: null,
        isAuthenticated: false,
      });

      window.location.href =
        "/login";
    },

    isAdmin: () => {

      const user =
        get().user;

      return [
        "SUPER_ADMIN",
        "ADMIN",
        "MANAGER",
      ].includes(
        user?.role || "",
      );
    },

    isKitchen: () => {

      const user =
        get().user;

      return (
        user?.role ===
        "KITCHEN"
      );
    },

    isCashier: () => {

      const user =
        get().user;

      return (
        user?.role ===
        "CASHIER"
      );
    },

    isDelivery: () => {
      return get().user?.role === "DELIVERY";
    },

    isDemo: () => {
      return get().user?.role === "DEMO";
    },
  }));

