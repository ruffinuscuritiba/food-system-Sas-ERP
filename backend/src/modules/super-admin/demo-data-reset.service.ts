import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma.service';

/**
 * Devolve as contas demo (role=DEMO) a um estado limpo periodicamente.
 *
 * Contexto: `DemoGuard`/`RolesGuard` liberaram o ciclo de venda (Caixa/
 * Pedidos/Mesas) pra role DEMO em `demo-write-policy.ts` — pedido explícito
 * do usuário pra que a demo seja "a própria loja" (o prospect fecha negócio
 * depois de USAR o sistema de verdade). Mas cada demo é uma única empresa
 * COMPARTILHADA entre todo mundo que testa aquele nicho ao mesmo tempo —
 * sem essa limpeza, o pedido/caixa aberto de um visitante vazaria pro
 * próximo (mesmo problema, em miniatura, do multi-tenant real, só que aqui
 * o "tenant" é literalmente compartilhado de propósito).
 *
 * Escopo da limpeza: só o que a política de escrita libera (Order+Item,
 * TableOrder+Item, Table.status, Cash) — catálogo/config continuam
 * somente-leitura pra DEMO, então não precisam de reset.
 */
@Injectable()
export class DemoDataResetService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoDataResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // Roda uma vez no boot também — sem esperar até a próxima hora cheia,
    // sobra de teste de deploy anterior não fica visível pro primeiro
    // visitante do dia.
    this.resetAll().catch((err) =>
      this.logger.error('[DemoDataReset] boot run falhou', err?.message ?? String(err)),
    );
  }

  @Cron('0 * * * *')
  async resetAll() {
    const demoCompanies = await this.prisma.company.findMany({
      where: { users: { some: { role: 'DEMO' as any } } },
      select: { id: true, name: true },
    });

    let ok = 0;
    for (const c of demoCompanies) {
      try {
        await this.resetOne(c.id);
        ok++;
      } catch (err) {
        this.logger.error(
          `[DemoDataReset] ${c.id} (${c.name}) falhou`,
          (err as Error)?.message ?? String(err),
        );
      }
    }
    if (demoCompanies.length) {
      this.logger.log(`[DemoDataReset] ${ok}/${demoCompanies.length} conta(s) demo limpas.`);
    }
  }

  private async resetOne(companyId: string) {
    await this.prisma.$transaction([
      this.prisma.orderItem.deleteMany({ where: { order: { companyId } } }),
      this.prisma.order.deleteMany({ where: { companyId } }),
      this.prisma.tableOrderItem.deleteMany({ where: { tableOrder: { companyId } } }),
      this.prisma.tableOrder.deleteMany({ where: { companyId } }),
      this.prisma.table.updateMany({ where: { companyId }, data: { status: 'FREE' as any } }),
      this.prisma.stockMovement.deleteMany({ where: { companyId, referenceType: 'ORDER' } }),
      this.prisma.cash.deleteMany({ where: { companyId } }),
    ]);
  }
}
