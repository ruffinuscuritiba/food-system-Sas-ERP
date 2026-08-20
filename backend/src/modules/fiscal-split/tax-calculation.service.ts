import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface TaxCalculationResult {
  ibsRate: number | null;
  cbsRate: number | null;
  ibsAmount: number;
  cbsAmount: number;
}

/**
 * TaxCalculationService — motor de cálculo puro de IBS/CBS por tenant.
 *
 * Nunca assume alíquota: lê `TaxConfiguration.ibsRate`/`cbsRate` (nulos por
 * padrão, aguardando especificação oficial CGIBS/RFB + confirmação do
 * usuário/contador do tenant). Sem config ou sem alíquota preenchida, o
 * cálculo é sempre zero — nunca um valor "razoável" inventado.
 */
@Injectable()
export class TaxCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string) {
    return this.prisma.taxConfiguration.findUnique({ where: { companyId } });
  }

  /**
   * Kill switch central: true somente se a empresa tiver TaxConfiguration
   * ativa E com o canal (OWN_SALE/MARKETPLACE) habilitado. Sem linha de
   * TaxConfiguration (caso de toda empresa hoje), retorna false sempre.
   */
  async isActiveFor(
    companyId: string,
    channel: 'OWN_SALE' | 'MARKETPLACE',
  ): Promise<boolean> {
    const config = await this.getConfig(companyId);
    if (!config?.isActive) return false;
    return channel === 'OWN_SALE'
      ? config.appliesToOwnSales
      : config.appliesToMarketplace;
  }

  async calculateForCompany(
    companyId: string,
    baseAmount: number,
  ): Promise<TaxCalculationResult> {
    const config = await this.getConfig(companyId);
    const ibsRate = config?.ibsRate ? Number(config.ibsRate) : null;
    const cbsRate = config?.cbsRate ? Number(config.cbsRate) : null;

    return {
      ibsRate,
      cbsRate,
      ibsAmount: ibsRate ? parseFloat((baseAmount * ibsRate).toFixed(2)) : 0,
      cbsAmount: cbsRate ? parseFloat((baseAmount * cbsRate).toFixed(2)) : 0,
    };
  }
}
