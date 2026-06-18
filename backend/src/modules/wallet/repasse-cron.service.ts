import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class RepasseCronService {
  private readonly logger = new Logger(RepasseCronService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  /**
   * Roda toda hora no minuto :00.
   * Filtra empresas cujo `repasseTime` bate com a hora atual e
   * cuja `repasseFrequency` (DAILY ou WEEKLY + dia certo) se aplica.
   * Sequência por empresa: abater mensalidade → repassar saldo restante.
   */
  @Cron('0 * * * *')
  async runHourlyRepasse() {
    const now = new Date();
    const currentHour = `${String(now.getHours()).padStart(2, '0')}:00`;
    const currentWeekday = now.getDay(); // 0=dom … 6=sáb

    this.logger.log(`[REPASSE CRON] Rodando às ${currentHour} (dia ${currentWeekday})`);

    // Busca empresas com saldo positivo e não bloqueadas
    const companies = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        repasseTime: string;
        repasseFrequency: string;
        repasseWeekday: number;
        walletBalance: string;
      }[]
    >`
      SELECT id, name,
        COALESCE("repasseTime", '03:00')      AS "repasseTime",
        COALESCE("repasseFrequency", 'DAILY') AS "repasseFrequency",
        COALESCE("repasseWeekday", 1)         AS "repasseWeekday",
        "walletBalance"
      FROM "Company"
      WHERE "isBlocked" = false
        AND "walletBalance" > 0
    `;

    let processed = 0;
    for (const company of companies) {
      // Verificar se é a hora do repasse
      if (company.repasseTime !== currentHour) continue;

      // Verificar dia da semana para repasse semanal
      if (
        company.repasseFrequency === 'WEEKLY' &&
        Number(company.repasseWeekday) !== currentWeekday
      ) continue;

      this.logger.log(`[REPASSE CRON] Processando ${company.name} (${company.id}) — saldo R$${company.walletBalance}`);

      try {
        // 1. Abater mensalidade pendente antes do repasse
        const deducted = await this.walletService.deductPendingSubscription(company.id);
        if (deducted > 0) {
          this.logger.log(`[REPASSE CRON] Mensalidade R$${deducted} abatida de ${company.name}`);
        }

        // 2. Repassar saldo restante para a conta da loja
        await this.walletService.processRepasseForCompany(company.id);
        processed++;
      } catch (err) {
        this.logger.error(`[REPASSE CRON] Erro ao processar ${company.id}: ${err}`);
      }
    }

    this.logger.log(`[REPASSE CRON] Concluído — ${processed} empresas processadas às ${currentHour}`);
  }
}
