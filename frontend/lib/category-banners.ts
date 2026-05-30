/**
 * Biblioteca de banners pré-prontos por categoria.
 *
 * Hospedados no Unsplash (CDN público, licença permissiva, hotlink permitido).
 * Operador pode escolher um destes OU subir o próprio via upload.
 * O valor selecionado é gravado em Category.bannerImage como URL string.
 *
 * Adicionar novos banners: incluir item neste array — nenhuma migration
 * ou API nova é necessária.
 */

export interface PresetBanner {
  id:       string;
  category: string;
  url:      string;
  emoji:    string;
}

export const CATEGORY_BANNERS: PresetBanner[] = [
  {
    id: "pizza",
    category: "Pizza",
    emoji: "🍕",
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "burger",
    category: "Hambúrguer",
    emoji: "🍔",
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "drinks",
    category: "Bebidas",
    emoji: "🥤",
    url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "desserts",
    category: "Sobremesas",
    emoji: "🍰",
    url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "acai",
    category: "Açaí",
    emoji: "🍇",
    url: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "snacks",
    category: "Lanches",
    emoji: "🥪",
    url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "portions",
    category: "Porções",
    emoji: "🍟",
    url: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=1400&q=80&auto=format&fit=crop",
  },
  {
    id: "pasta",
    category: "Massas",
    emoji: "🍝",
    url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1400&q=80&auto=format&fit=crop",
  },
];
