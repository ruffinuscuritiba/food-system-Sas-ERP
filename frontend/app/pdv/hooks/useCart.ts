import { useMemo, useState } from "react";
import type { CartItem, Product } from "../types";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  function add(product: Product) {
    setItems((prev) => {
      const ex = prev.find((i) => i.cartKey === product.id);
      if (ex) return prev.map((i) => i.cartKey === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { cartKey: product.id, product, quantity: 1, notes: "" }];
    });
  }

  function addCustom(item: CartItem) {
    setItems((p) => [...p, item]);
  }

  function updateQty(key: string, delta: number) {
    setItems((p) => p
      .map((i) => i.cartKey !== key ? i : { ...i, quantity: i.quantity + delta })
      .filter((i) => i.quantity > 0));
  }

  function remove(key: string) {
    setItems((p) => p.filter((i) => i.cartKey !== key));
  }

  function clear() {
    setItems([]);
  }

  const total = useMemo(
    () => items.reduce((a, i) => a + Number(i.product.salePrice) * i.quantity, 0),
    [items]
  );
  const count = useMemo(
    () => items.reduce((a, i) => a + i.quantity, 0),
    [items]
  );

  return { items, total, count, add, addCustom, updateQty, remove, clear };
}
