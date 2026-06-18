import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PrismaService } from 'src/database/prisma.service';

// ─── Mapeamento de tipo de chave PIX para o padrão MP ────────────────────────
// MP aceita: CPF | CNPJ | email | phone | random_key
const MP_PIX_KEY_TYPE: Record<string, string> = {
  CPF:    'CPF',
  CNPJ:   'CNPJ',
  EMAIL:  'email',
  PHONE:  'phone',
  RANDOM: 'random_key',
};

// ─── Taxas da plataforma ──────────────────────────────────────────────────────

const TRANSFER_FEE = 1.9; // R$1,90 por repasse automático

const FEE_RATES = {
  PIX:        0.0199, // 1,99%
  DEBIT_CARD: 0.0199, // 1,99%
  CREDIT_D0:  0.0569, // 3,99% + 1,70% de adiantamento
  CREDIT_D30: 0.0399, // 3,99%
};

const PLAN_PRICES: Record<string, number> = {
  BASIC:      97,
  DELIVERY:   197,
  PRO:        197,
  ENTERPRISE: 397,
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  // ── Cálculo de taxa ─────────────────────────────────────────────────────────

  private feeRate(paymentMethod: string, creditPlan: string): number {
    const m = (paymentMethod ?? '').toUpperCase();
    if (m === 'PIX') return FEE_RATES.PIX;
    if (m === 'DEBIT_CARD' || m === 'DEBIT') return FEE_RATES.DEBIT_CARD;
    if (m === 'CREDIT_CARD' || m === 'CREDIT') {
      return creditPlan === 'D0' ? FEE_RATES.CREDIT_D0 : FEE_RATES.CREDIT_D30;
    }
    return FEE_RATES.PIX; // padrão conservador
  }

  // ── Crédito de venda ────────────────────────────────────────────────────────

  /**
   * Chamado quando um pagamento online é aprovado pelo gateway.
   * Calcula a taxa da plataforma, credita o valor líquido na carteira da loja
   * e registra a transação e o breakdown no OnlineOrder.
   */
  async creditFromOrder(
    companyId: string,
    orderId: string,
    grossAmount: number,
    paymentMethod: string,
  ): Promise<void> {
    const company = await (this.prisma as any).company.findUnique({
      where: { id: companyId },
      select: { walletBalance: true },
    }) as { walletBalance: number } | null;
    if (!company) return;

    const creditPlan = await this.getCompanyCreditPlan(companyId);
    const rate = this.feeRate(paymentMethod, creditPlan);
    const feeAmount = parseFloat((grossAmount * rate).toFixed(2));
    const netAmount = parseFloat((grossAmount - feeAmount).toFixed(2));
    const balanceBefore = parseFloat(Number(company.walletBalance).toFixed(2));
    const balanceAfter = parseFloat((balanceBefore + netAmount).toFixed(2));

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { walletBalance: balanceAfter },
      });

      await (tx as any).walletTransaction.create({
        data: {
          companyId,
          type: 'ORDER_CREDIT',
          amount: netAmount,
          balanceBefore,
          balanceAfter,
          description: `Venda online — taxa ${(rate * 100).toFixed(2)}% retida (R$${feeAmount.toFixed(2)})`,
          referenceId: orderId,
          referenceType: 'ONLINE_ORDER',
        },
      });

      // Atualiza breakdown financeiro no OnlineOrder
      await tx.onlineOrder.update({
        where: { id: orderId },
        data: { grossAmount, feeAmount, netAmount } as any,
      }).catch(() => { /* ignora se campos ainda não existem no DB */ });
    });

    this.logger.log(
      `[WALLET] +R$${netAmount} para ${companyId} | gross:${grossAmount} fee:${feeAmount} (${(rate * 100).toFixed(2)}%)`,
    );
  }

  // ── Abatimento de mensalidade ───────────────────────────────────────────────

  /**
   * Roda antes de todo repasse automático.
   * Se a empresa tiver mensalidade vencida E saldo suficiente,
   * debita da carteira e regulariza a assinatura.
   * Retorna o valor abatido (0 se nada foi feito).
   */
  async deductPendingSubscription(companyId: string): Promise<number> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { walletBalance: true, subscriptionStatus: true, plan: true, dueDate: true },
    });
    if (!company) return 0;

    const isOverdue =
      company.subscriptionStatus !== 'ACTIVE' ||
      (company.dueDate && new Date(company.dueDate) < new Date());
    if (!isOverdue) return 0;

    const planPrice = PLAN_PRICES[(company.plan as string) ?? 'BASIC'] ?? 97;
    const balance = parseFloat(Number(company.walletBalance).toFixed(2));
    if (balance < planPrice) return 0;

    const balanceBefore = balance;
    const balanceAfter = parseFloat((balance - planPrice).toFixed(2));
    const nextDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          walletBalance: balanceAfter,
          subscriptionStatus: 'ACTIVE',
          dueDate: nextDueDate,
        },
      });

      await (tx as any).walletTransaction.create({
        data: {
          companyId,
          type: 'SUBSCRIPTION_DEBIT',
          amount: -planPrice,
          balanceBefore,
          balanceAfter,
          description: `Mensalidade plano ${company.plan} — abatida automaticamente da carteira`,
          referenceType: 'SUBSCRIPTION',
        },
      });
    });

    this.logger.log(`[WALLET] Mensalidade R$${planPrice} debitada de ${companyId} — plano regularizado`);
    return planPrice;
  }

  // ── Repasse automático ──────────────────────────────────────────────────────

  /**
   * Processa o repasse do saldo disponível via Mercado Pago Payouts (PIX).
   * Fluxo:
   *  1. Cria WalletRepasse com status PROCESSING (idempotência local)
   *  2. Chama POST /v1/payouts com X-Idempotency-Key = "repasse-{repasseId}"
   *  3a. Sucesso → COMPLETED, salva gatewayId, zera walletBalance em transação atômica
   *  3b. Erro → FAILED, salva motivo detalhado, DEVOLVE o saldo para a carteira
   */
  async processRepasseForCompany(companyId: string): Promise<void> {
    const company = await (this.prisma as any).company.findUnique({
      where: { id: companyId },
      select: { walletBalance: true, bankAccountData: true, name: true },
    }) as { walletBalance: number; bankAccountData: unknown; name: string } | null;
    if (!company) return;

    const balance = parseFloat(Number(company.walletBalance).toFixed(2));
    if (balance <= TRANSFER_FEE) {
      this.logger.warn(
        `[WALLET] ${company.name} — saldo R$${balance} insuficiente para repasse (mín R$${TRANSFER_FEE + 0.01})`,
      );
      return;
    }

    const netAmount = parseFloat((balance - TRANSFER_FEE).toFixed(2));
    const bankData = (company.bankAccountData ?? {}) as Record<string, string>;

    // Validar que há chave PIX cadastrada antes de criar o registro
    if (!bankData.pixKey) {
      this.logger.warn(`[WALLET] ${company.name} — sem chave PIX cadastrada, repasse ignorado`);
      return;
    }

    // ── 1. Criar registro PROCESSING (garante idempotência local) ──────────────
    const repasse = await (this.prisma as any).walletRepasse.create({
      data: {
        companyId,
        amount:      balance,
        transferFee: TRANSFER_FEE,
        netAmount,
        status:      'PROCESSING',
        pixKey:      bankData.pixKey,
        bank:        bankData.bank ?? null,
        scheduledFor: new Date(),
      },
    });

    const idempotencyKey = `repasse-${repasse.id}`;
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!mpToken) {
      // Sem token configurado — marcar como FAILED e alertar
      await (this.prisma as any).walletRepasse.update({
        where: { id: repasse.id },
        data: {
          status:     'FAILED',
          failReason: 'MERCADO_PAGO_ACCESS_TOKEN não configurado no ambiente',
        },
      });
      this.logger.error(`[WALLET] MERCADO_PAGO_ACCESS_TOKEN ausente — repasse ${repasse.id} cancelado`);
      return;
    }

    // ── 2. Montar payload MP Payouts ───────────────────────────────────────────
    const pixKeyType = MP_PIX_KEY_TYPE[bankData.pixKeyType ?? 'CPF'] ?? 'CPF';

    const payload = {
      amount: netAmount,
      payment_method_id: 'pix',
      payout_destination: {
        type:     'bank_account',
        pix_data: {
          key_type:  pixKeyType,
          key_value: bankData.pixKey,
          holder_name: bankData.holderName ?? company.name,
        },
      },
      metadata: {
        company_id: companyId,
        repasse_id: repasse.id,
        platform:   'FoodSaaS',
      },
    };

    try {
      // ── 3a. Chamada MP Payouts ─────────────────────────────────────────────
      const response = await axios.post<{ id: string; status: string }>(
        'https://api.mercadopago.com/v1/payouts',
        payload,
        {
          headers: {
            Authorization:      `Bearer ${mpToken}`,
            'X-Idempotency-Key': idempotencyKey,
            'Content-Type':      'application/json',
          },
          timeout: 30_000,
        },
      );

      const gatewayId       = String(response.data.id);
      const gatewayResponse = response.data;

      this.logger.log(
        `[WALLET] MP Payout aceito — id:${gatewayId} status:${gatewayResponse.status} ` +
        `R$${netAmount} para ${bankData.pixKey} (${company.name})`,
      );

      // Persistir sucesso e zerar carteira em transação atômica
      await this.prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: companyId },
          data: { walletBalance: 0 },
        });

        await (tx as any).walletRepasse.update({
          where: { id: repasse.id },
          data: {
            status:          'COMPLETED',
            gatewayId,
            gatewayResponse,
            processedAt:     new Date(),
          },
        });

        await (tx as any).walletTransaction.create({
          data: {
            companyId,
            type:          'REPASSE',
            amount:        -balance,
            balanceBefore: balance,
            balanceAfter:  0,
            description:   `Repasse via PIX — R$${netAmount} (taxa R$${TRANSFER_FEE}) · MP id:${gatewayId}`,
            referenceId:   repasse.id,
            referenceType: 'REPASSE',
            repasseId:     repasse.id,
          },
        });
      });

    } catch (err) {
      // ── 3b. Tratamento de erro — devolve saldo e persiste motivo ───────────
      const axiosErr = err as AxiosError<{ message?: string; error?: string; cause?: string }>;
      const httpStatus   = axiosErr.response?.status ?? 0;
      const mpMessage    = axiosErr.response?.data?.message
        ?? axiosErr.response?.data?.error
        ?? axiosErr.message
        ?? String(err);
      const failReason   = `HTTP ${httpStatus}: ${mpMessage}`;

      this.logger.error(`[WALLET] MP Payout FALHOU para ${company.name} (${companyId}) — ${failReason}`);

      // Reverter walletBalance (devolver saldo à loja)
      await this.prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: companyId },
          data: { walletBalance: balance },
        });

        await (tx as any).walletRepasse.update({
          where: { id: repasse.id },
          data: {
            status:          'FAILED',
            failReason,
            gatewayResponse: axiosErr.response?.data ?? null,
          },
        });

        await (tx as any).walletTransaction.create({
          data: {
            companyId,
            type:          'MANUAL_CREDIT',
            amount:        balance,
            balanceBefore: 0,
            balanceAfter:  balance,
            description:   `Estorno automático — falha no repasse MP: ${mpMessage}`,
            referenceId:   repasse.id,
            referenceType: 'REPASSE',
            repasseId:     repasse.id,
          },
        });
      });
    }
  }

  // ── Consultas ───────────────────────────────────────────────────────────────

  async getTransactions(companyId: string, limit = 50) {
    return (this.prisma as any).walletTransaction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRepasses(companyId: string, limit = 20) {
    return (this.prisma as any).walletRepasse.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBalance(companyId: string): Promise<number> {
    const company = await (this.prisma as any).company.findUnique({
      where: { id: companyId },
      select: { walletBalance: true },
    }) as { walletBalance: number } | null;
    return parseFloat(Number(company?.walletBalance ?? 0).toFixed(2));
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private async getCompanyCreditPlan(companyId: string): Promise<string> {
    const raw = await this.prisma.$queryRaw<{ creditReleasePlan: string }[]>`
      SELECT "creditReleasePlan" FROM "Company" WHERE id = ${companyId} LIMIT 1
    `;
    return raw[0]?.creditReleasePlan ?? 'D30';
  }
}
