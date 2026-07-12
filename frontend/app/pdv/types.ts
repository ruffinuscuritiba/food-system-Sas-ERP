export type ProductSize = { size: string; price: number };

export type Product = {
  id: string;
  name: string;
  description?: string;
  salePrice: number;
  imageUrl?: string;
  imageZoom?: number;
  categoryId?: string;
  sizes?: ProductSize[];
};

export type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  allowMultipleFlavors?: boolean;
};

export type PizzaBorder = {
  id: string;
  name: string;
  isActive: boolean;
  sizes: ProductSize[];
};

export type CartItem = {
  cartKey: string;
  product: Product;
  quantity: number;
  notes: string;
  // ✅ CORREÇÃO — snapshot do preço no momento da adição ao carrinho.
  // Deve ser preenchido por useCart com getPriceForSize() ou product.salePrice.
  // O backend usa este valor em item.unitPrice — nunca mais recalcula via salePrice.
  unitPrice: number;
  flavors?: Product[];
  pizzaSize?: string;
  pizzaBorderId?: string;
  borderPrice?: number;
};

export type OrderType = "DINE_IN" | "PHONE" | "DELIVERY";
export type PayMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
export type SplitEntry = { method: PayMethod; amount: string };

export type CashState = {
  isOpen?: boolean;
  balance?: number;
  entries?: number;
  exits?: number;
} | null;

export function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pizza") || n.includes("pizz")) return "🍕";
  if (n.includes("lanche") || n.includes("burger") || n.includes("hamburguer")) return "🍔";
  if (n.includes("bebida") || n.includes("drink") || n.includes("suco") || n.includes("refri")) return "🥤";
  if (n.includes("sobremesa") || n.includes("doce") || n.includes("sorvete")) return "🍰";
  if (n.includes("salada") || n.includes("vegano") || n.includes("vegetal")) return "🥗";
  if (n.includes("frango") || n.includes("chicken") || n.includes("asa")) return "🍗";
  if (n.includes("carne") || n.includes("steak") || n.includes("picanha") || n.includes("churrasco")) return "🥩";
  if (n.includes("peixe") || n.includes("salmão") || n.includes("frutos")) return "🐟";
  if (n.includes("massa") || n.includes("macarrão") || n.includes("espaguete") || n.includes("pasta")) return "🍝";
  if (n.includes("porcao") || n.includes("porção") || n.includes("aperitivo") || n.includes("entrada")) return "🍟";
  if (n.includes("sopa") || n.includes("caldo")) return "🍲";
  if (n.includes("cafe") || n.includes("café") || n.includes("expresso")) return "☕";
  if (n.includes("açaí") || n.includes("acai")) return "🫐";
  if (n.includes("tapioca") || n.includes("crepe")) return "🫓";
  if (n.includes("combo") || n.includes("promoção") || n.includes("promo")) return "🎁";
  if (n.includes("adicional") || n.includes("extra")) return "➕";
  if (n.includes("prato") || n.includes("executivo") || n.includes("almoço")) return "🍽️";
  if (n.includes("kids") || n.includes("infantil") || n.includes("criança")) return "🧒";
  if (n.includes("veggie") || n.includes("natural")) return "🌿";
  return "🍴";
}

export function getPriceForSize(p: Product, size: string) {
  const s = p.sizes?.find((x) => x.size === size);
  return s ? Number(s.price) : Number(p.salePrice);
}
