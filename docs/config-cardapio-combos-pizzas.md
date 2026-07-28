# Configuração de Cardápio — Combos de Esfihas + Fracionamento de Pizzas

> Mapeamento das regras de negócio pedidas para os modelos REAIS do schema
> (`backend/prisma/schema.prisma`), validado contra `complements.service.ts`
> e `online-orders.service.ts` (validação server-side de min/max).

---

## 0. Como isto mapeia pro sistema (leia antes de configurar)

O sistema tem **dois motores diferentes** para "escolher sabores" — não existe
uma abstração única de "Grupo de Complementos" cobrindo os dois casos do pedido:

| Cenário | Motor real | Onde vive |
|---|---|---|
| Combo com N sabores **exatos** (3, 6, 10) + bebida obrigatória | Módulo de **Complementos** (`Complement` + `ComplementOption`) | `/complements` |
| Pizza fracionada (1 até N sabores, cliente escolhe quantos quiser) | Motor de **pizza** (`PizzaSizeConfig.maxFlavors` + `Product.maxFlavors`) | `/pizza-borders` (aba Tamanhos & Sabores) |

**Isolamento de grupo** ("não reaproveitar entre produtos diferentes") = sempre
criar o `Complement` com `productId` preenchido (escopo **Produto**), nunca
deixar em Categoria/Global. Confirmado em `complements.service.ts`:

```
ESCOPO        | productId | categoryId  | prioridade
PRODUCT (P)   |   set     |    null     |   0  (vence)
CATEGORY (C)  |   null    |    set      |   1
GLOBAL (G)    |   null    |    null     |   2
```

**Oculto da busca geral** = automático. `ComplementOption` nunca é `Product`,
então nunca aparece em `GET /products/public` (endpoint que alimenta o
cardápio digital e o PDV). Não existe — e não precisa existir — um campo
`oculto_na_busca`.

**Contador regressivo (3→0, 6→0, 10→0)** = UX de frontend (já implementado no
`ComplementsModal.tsx` como "progress bar de obrigatórios" — item 55/56 do
histórico do projeto), alimentado pelos valores `minOptions`/`maxOptions`
abaixo. Não é um campo de configuração à parte.

---

## 1. Catálogo visível (aparece na busca geral do cardápio)

Estes SÃO `Product`, cadastrados normalmente em `/products`:

| Categoria | Produto | Preço (`salePrice`) | Observação |
|---|---|---|---|
| Esfihas Avulsas | Esfiha Calabresa | R$ 8,00 | vendida solta, também dá nome ao sabor do combo (nomes iguais, registros diferentes) |
| Esfihas Avulsas | Esfiha Queijo | R$ 8,00 | idem |
| Esfihas Avulsas | Esfiha Frango c/ Catupiry | R$ 9,00 | idem |
| Esfihas Avulsas | Esfiha Bauru | R$ 9,00 | idem |
| Combos | **Combo 3 Esfihas** | R$ 21,00 | produto pai — ver grupo isolado na seção 3 |
| Combos | **Combo 6 Esfihas** | R$ 39,00 | produto pai — ver grupo isolado na seção 3 |
| Combos | **Combo 10 Esfihas + 1 Refri** | R$ 64,00 | produto pai — ver 2 grupos isolados na seção 3 |
| Pizzas | Pizza Calabresa | por tamanho (`ProductSize`) | também usada como sabor no fracionamento (seção 2) |
| Pizzas | Pizza Mussarela | por tamanho | idem |
| Pizzas | Pizza Portuguesa | por tamanho | idem |
| Bebidas Avulsas | Coca-Cola Lata 350ml | R$ 6,00 | também aparece como opção do combo 10 (registro separado, ver seção 3) |
| Bebidas Avulsas | Guaraná Lata 350ml | R$ 6,00 | idem |

---

## 2. Fracionamento de pizza (motor dedicado — NÃO é Complemento)

`Product.maxFlavors` é **por produto** (1–4), `null` = herda o teto do
`PizzaSizeConfig` do tamanho selecionado. O mínimo é sempre 1 (travado no
código) — não existe "mínimo 2 sabores" neste sistema.

### Opção A — recomendada: um único cardápio de pizza, teto por tamanho

Configurar em `/pizza-borders` → aba "Tamanhos & Sabores" (`PizzaSizeConfig`,
por empresa):

| Tamanho (`size`) | `label` | `maxFlavors` | Equivale à sua regra |
|---|---|---|---|
| PEQUENA | Pequena | 1 | "Pizza Inteira (1 Sabor)" |
| MEDIA | Média | 2 | "Pizza até 2 Sabores" |
| GRANDE | Grande | 3 | "Pizza até 3 Sabores" |
| FAMILIA | Família | 3 | idem Grande |

O cliente, ao escolher o tamanho, vê automaticamente o teto certo e pode
escolher 1 até N sabores (nunca menos que 1, nunca mais que o teto) — sem
precisar de 3 produtos separados.

### Opção B — se você quer 3 SKUs de fato distintos (preços/nomes diferentes)

Use `Product.maxFlavors` como **override** por produto específico, ignorando
o teto do tamanho:

| Produto | `maxFlavors` (override) |
|---|---|
| Pizza Inteira (linha promocional 1 sabor) | 1 |
| Pizza Meio a Meio (linha até 2 sabores) | 2 |
| Pizza 3 Sabores (linha família) | 3 |

Use A **ou** B — não as duas ao mesmo tempo pro mesmo produto (B sobrepõe A).

---

## 3. Grupos de complementos isolados (nunca reaproveitados, ocultos da busca)

Cadastrar em `/complements`, sempre com **escopo = Produto** (nunca Categoria
nem Global) apontando pro combo específico. Os "sabores"/"bebidas" viram
`ComplementOption` — registros que **nunca** existem como `Product`.

| Produto Pai (`productId`) | Nome do Grupo | `type` | `required` | `multipleChoice` | `minOptions` | `maxOptions` | `chargesExtra` | Itens (`ComplementOption`, `price=0`) |
|---|---|---|---|---|---|---|---|---|
| Combo 3 Esfihas | Escolha os 3 Sabores | ESPECIFICACOES | true | true | **3** | **3** | false | Calabresa, Queijo, Frango c/ Catupiry, Bauru |
| Combo 6 Esfihas | Escolha os 6 Sabores | ESPECIFICACOES | true | true | **6** | **6** | false | Calabresa, Queijo, Frango c/ Catupiry, Bauru |
| Combo 10 Esfihas + 1 Refri | Escolha os 10 Sabores | ESPECIFICACOES | true | true | **10** | **10** | false | Calabresa, Queijo, Frango c/ Catupiry, Bauru |
| Combo 10 Esfihas + 1 Refri | Escolha 1 Refrigerante | CROSS_SELL | true | false | **1** | **1** | false* | Coca-Cola Lata, Guaraná Lata, Fanta Lata |

\* mude `chargesExtra` para `true` e dê preço próprio a alguma opção se quiser
cobrar diferença por refrigerante premium (ex: lata importada).

**Contador regressivo**: com `minOptions === maxOptions` e `required=true`, o
`ComplementsModal.tsx` já renderiza a barra "X/N selecionados" nativamente —
3→0, 6→0, 10→0, sem configuração extra.

**Validação server-side já existente** (`online-orders.service.ts`, linha
~226): se o cliente tentar fechar o pedido com menos ou mais itens que o
grupo permite, a API rejeita com `400 BadRequestException` **mesmo que o
frontend seja adulterado** — não depende de honestidade do cliente.

---

## 4. Passo a passo no admin

1. `/products` → criar os produtos da seção 1 (categorias Esfihas Avulsas,
   Combos, Pizzas, Bebidas Avulsas).
2. `/pizza-borders` → aba Tamanhos & Sabores → configurar `maxFlavors` por
   tamanho (Opção A da seção 2).
3. `/complements` → para cada combo:
   - Selecionar escopo **"🍔 Produto"** (nunca Categoria/Global).
   - Escolher o combo específico no dropdown.
   - Criar o grupo com os limites exatos da tabela da seção 3.
   - Dentro do grupo, cadastrar as opções (sabores/bebidas) — **não** vincular
     a nenhum `Product` existente, são registros próprios do grupo.

---

## 5. Checklist de validação

- [ ] `GET /complements/public/product/:comboId?companyId=X` retorna os
      grupos com `minOptions`/`maxOptions` corretos.
- [ ] Fechar pedido do Combo 3 com só 2 sabores → deve voltar `400`.
- [ ] Fechar pedido do Combo 10 sem escolher refrigerante → deve voltar `400`
      ("Complemento... é obrigatório").
- [ ] `GET /products/public?companyId=X` (busca geral) **não** deve conter
      nenhum sabor/refrigerante de combo — só os produtos da seção 1.
- [ ] Trocar o tamanho da pizza no cardápio digital deve travar
      automaticamente o número de sabores permitidos (1/2/3 conforme seção 2).

---

## 6. Limitações conhecidas (para não prometer o que o sistema não faz)

- Sem campo "oculto da busca" — a ocultação é estrutural (`ComplementOption`
  nunca é `Product`), não configurável, não precisa ser.
- Fracionamento de pizza sempre aceita mínimo **1** sabor — não é possível
  forçar "sempre meio a meio, nunca sabor único" pra uma categoria de pizza.
- Escopo Categoria/Global do módulo de Complementos existe e é útil para
  adicionais reaproveitados entre produtos (ex.: "borda recheada" em todas as
  pizzas) — mas como o pedido foi de isolamento total, todos os grupos acima
  usam escopo **Produto** explicitamente.
