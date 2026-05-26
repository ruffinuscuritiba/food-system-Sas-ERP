import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import type { CashState } from "../types";

export function useCash() {
  const [cash, setCash] = useState<CashState>(null);

  const load = useCallback(async () => {
    try { setCash((await api.get("/cash/current")).data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function open(openingValue: number) {
    if (isNaN(openingValue) || openingValue < 0) {
      toast.error("Valor inválido"); return false;
    }
    try {
      await api.post("/cash/open", { openingValue });
      await load();
      toast.success("Caixa aberto!");
      return true;
    } catch { toast.error("Erro"); return false; }
  }

  async function move(type: string, value: number) {
    if (isNaN(value) || value <= 0) {
      toast.error("Valor inválido"); return false;
    }
    try {
      await api.post("/cash/movement", { type, value });
      await load();
      toast.success("Registrado");
      return true;
    } catch { toast.error("Erro"); return false; }
  }

  async function close() {
    try {
      await api.patch("/cash/close");
      await load();
      toast.success("Fechado");
      return true;
    } catch { toast.error("Erro"); return false; }
  }

  return { cash, reload: load, open, move, close };
}
