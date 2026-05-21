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

      Cookies.set(
        "token",
        token,
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
  }));

useAuthStore
  .getState()
  .loadAuth();