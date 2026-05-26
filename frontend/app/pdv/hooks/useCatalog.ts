import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import type { Category, PizzaBorder, Product } from "../types";

export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [borders, setBorders] = useState<PizzaBorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const [cR, pR] = await Promise.all([api.get("/categories"), api.get("/products")]);
      setCategories(Array.isArray(cR.data) ? cR.data : []);
      setProducts(Array.isArray(pR.data) ? pR.data : []);
    } catch {
      setError(true);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
    try {
      const bR = await api.get("/pizza-borders");
      setBorders(Array.isArray(bR.data) ? bR.data : []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return { categories, products, borders, loading, error, reload: load };
}
