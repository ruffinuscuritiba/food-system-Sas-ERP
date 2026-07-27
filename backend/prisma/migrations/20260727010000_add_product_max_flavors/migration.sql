-- Campo por produto: quantos sabores de pizza ele permite escolher no
-- cardápio digital (1-4). Null = usa o padrão do tamanho/categoria.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxFlavors" INTEGER;

-- Backfill: produtos de categorias com "combo" no nome ficavam travados em
-- 1 sabor via heurística no frontend (ver commit 341e1518). Agora que existe
-- um campo real, preserva esse comportamento pros produtos já cadastrados —
-- o dono da loja pode ajustar item a item depois (ex: liberar 2 sabores num
-- combo específico, ou travar em 1 uma promoção fora da categoria Combos).
UPDATE "Product" p
SET "maxFlavors" = 1
FROM "Category" c
WHERE p."categoryId" = c.id
  AND c.name ILIKE '%combo%'
  AND p."maxFlavors" IS NULL;
