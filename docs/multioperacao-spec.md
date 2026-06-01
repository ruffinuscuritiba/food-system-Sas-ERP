# Especificação Técnica — Multioperação (Futura)

**Status:** Especificação apenas. Nenhum banco ou código alterado.

---

## Objetivo

Permitir que uma empresa no FoodSaaS ERP gerencie múltiplas operações independentes
(ex.: Pizzaria, Conveniência, Lanchonete) sob um único CNPJ/conta, com:

- Cardápios e estoques isolados por operação
- Usuários com acesso a uma ou todas as operações
- Dashboard consolidado por empresa ou filtrado por operação

---

## Modelo de dados proposto

```prisma
model Operation {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  name        String               -- "Pizzaria", "Conveniência"
  slug        String               -- "pizzaria", "conveniencia"
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  products    Product[]
  categories  Category[]
  orders      Order[]
  tables      Table[]
  cashes      Cash[]

  @@unique([companyId, slug])
  @@index([companyId])
}

-- User recebe operationId opcional (null = acesso a todas)
ALTER TABLE "User" ADD COLUMN "operationId" TEXT REFERENCES "Operation"("id");
```

---

## Impacto nas tabelas existentes

| Tabela | Mudança | Risco |
|---|---|---|
| `User` | Adicionar `operationId` nullable | **Baixo** — nullable, sem quebra |
| `Product` | Adicionar `operationId` nullable | **Médio** — listagens precisam filtrar |
| `Category` | Adicionar `operationId` nullable | **Médio** |
| `Order` | Adicionar `operationId` nullable | **Médio** |
| `Table` | Adicionar `operationId` nullable | **Baixo** |
| `Cash` | Adicionar `operationId` nullable | **Baixo** |
| `Company` | Sem mudança | — |

Todas as colunas são **nullable** para manter compatibilidade com tenants single-op existentes.

---

## Mudanças no JWT

O JWT atual carrega `{ sub, email, companyId, role }`.

Para multioperação, adicionar `operationId` opcional:

```typescript
interface JwtPayload {
  sub:          string;
  email:        string;
  companyId:    string;
  role:         string;
  operationId?: string | null;  // null = acesso a todas
}
```

---

## Guards necessários

```typescript
// OperationGuard: filtra por operationId do JWT quando presente
@Injectable()
export class OperationGuard implements CanActivate {
  canActivate(context) {
    const { user } = context.switchToHttp().getRequest();
    // Se operationId no JWT → inject no request para filtro Prisma
    // Se null → sem filtro (acesso total)
    return true;
  }
}
```

---

## Sequência de implementação recomendada

1. `prisma migrate` para adicionar `operationId` nas tabelas (nullable, sem default)
2. Criar `Operation` CRUD no super-admin
3. Adicionar `OperationGuard` aos services que filtram dados
4. Atualizar `AuthService.login()` para incluir `operationId` no JWT
5. Atualizar frontend: seletor de operação no login ou topbar
6. Migração de dados: `operationId = null` para todos os registros existentes (não quebra nada)

---

## Estimativa de impacto

- **0 queries existentes quebram** (todas filtram por `companyId` — operationId seria filtro adicional opcional)
- **16 tabelas afetadas** (todas com novo campo nullable)
- **Não requer downtime** se migrations forem aditivas (ADD COLUMN IF NOT EXISTS)

---

## Considerações de segurança

- Um usuário com `operationId = X` nunca deve ver dados da `operationId = Y` da mesma empresa
- Super-admin pode acessar todas as operações
- O filtro `operationId` deve ser aplicado em **todos os services**, não apenas nos controllers

---

*Documento criado em 01/06/2026. Implementação pendente de aprovação.*
