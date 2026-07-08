import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { encryptSecret, decryptSecret } from '@/common/utils/crypto.util';
import { FocusNfeProvider } from './providers/focus-nfe.provider';
import { UpdateFiscalConfigDto } from './dto/update-fiscal-config.dto';

export const FISCAL_TERMS_TEXT =
  'O Módulo Fiscal é uma ferramenta de integração de terceiros. A plataforma FoodSaaS não atua ' +
  'como emissora de documentos fiscais, nem possui qualquer responsabilidade sobre a validade, ' +
  'transmissão, armazenamento ou conformidade legal das notas emitidas. Todo o ônus fiscal, ' +
  'configuração de impostos (CFOP, ICMS, NCM), obrigatoriedade de emissão e responsabilidade ' +
  'perante a SEFAZ é de inteira responsabilidade do Contratante. Ao salvar esta configuração, o ' +
  'Contratante confirma que possui Certificado Digital válido e está ciente de que a FoodSaaS ' +
  'apenas intermedia o envio dos dados ao provedor escolhido, sendo de sua inteira ' +
  'responsabilidade a tributação e a conformidade fiscal.';

@Injectable()
export class FiscalService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private focusNfe: FocusNfeProvider,
  ) {}

  // Nunca retorna segredos em texto plano — apenas indicadores de presença.
  async getConfig(companyId: string) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    if (!config) {
      return {
        provider: 'FOCUS_NFE',
        environment: 'HOMOLOGACAO',
        hasApiKey: false,
        apiKeyLast4: null,
        hasCert: false,
        isActive: false,
        termsAcceptedAt: null,
      };
    }
    return {
      provider: config.provider,
      environment: config.environment,
      hasApiKey: !!config.apiKeyEncrypted,
      apiKeyLast4: config.apiKeyLast4,
      hasCert: !!config.certFileBase64,
      isActive: config.isActive,
      termsAcceptedAt: config.termsAcceptedAt,
    };
  }

  async saveConfig(companyId: string, dto: UpdateFiscalConfigDto) {
    const existing = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });

    if ((dto.apiKey || dto.certFileBase64 || dto.certPassword) && !existing?.termsAcceptedAt) {
      throw new BadRequestException(
        'É necessário aceitar os termos de uso do Módulo Fiscal antes de salvar credenciais.',
      );
    }

    const data: Record<string, any> = {};
    if (dto.provider) data.provider = dto.provider;
    if (dto.environment) data.environment = dto.environment;
    if (dto.apiKey) {
      data.apiKeyEncrypted = encryptSecret(dto.apiKey);
      data.apiKeyLast4 = dto.apiKey.slice(-4);
    }
    if (dto.certFileBase64) data.certFileBase64 = dto.certFileBase64;
    if (dto.certPassword) data.certPasswordEncrypted = encryptSecret(dto.certPassword);

    return this.prisma.companyFiscalConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        provider: dto.provider ?? 'FOCUS_NFE',
        environment: dto.environment ?? 'HOMOLOGACAO',
        ...data,
      },
      update: data,
    });
  }

  async acceptTerms(companyId: string, userId: string | null, ip: string) {
    return this.prisma.companyFiscalConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        termsAcceptedAt: new Date(),
        termsAcceptedByUserId: userId,
        termsAcceptedIp: ip,
      },
      update: {
        termsAcceptedAt: new Date(),
        termsAcceptedByUserId: userId,
        termsAcceptedIp: ip,
      },
    }).then(async (config) => {
      await this.audit.log({
        action: 'FISCAL_TERMS_ACCEPTED',
        entity: 'CompanyFiscalConfig',
        entityId: config.id,
        companyId,
        userId: userId ?? undefined,
        ipAddress: ip,
        description: 'Aceite dos termos de uso do Módulo Fiscal (BYOK / integração de terceiros)',
        metadata: { termsText: FISCAL_TERMS_TEXT },
      });
      return config;
    });
  }

  async setActive(companyId: string, isActive: boolean) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    if (!config?.termsAcceptedAt) {
      throw new BadRequestException('Aceite os termos de uso antes de ativar o módulo.');
    }
    if (isActive && !config.apiKeyEncrypted) {
      throw new BadRequestException('Cadastre a API Key do provedor antes de ativar.');
    }
    return this.prisma.companyFiscalConfig.update({
      where: { companyId },
      data: { isActive },
    });
  }

  // Repassa a emissão para o provedor configurado pelo próprio cliente (BYOK).
  // O payload da NFC-e (itens, CFOP, ICMS, NCM) é montado e de responsabilidade
  // do contratante — este sistema não infere tributação automaticamente.
  async emit(companyId: string, payload: Record<string, any>) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    if (!config || !config.isActive) {
      throw new BadRequestException('Módulo Fiscal não está ativo para esta empresa.');
    }
    if (!config.apiKeyEncrypted) {
      throw new BadRequestException('Nenhuma API Key configurada.');
    }
    const apiKey = decryptSecret(config.apiKeyEncrypted);

    if (config.provider === 'FOCUS_NFE') {
      return this.focusNfe.emitNfce(apiKey, config.environment, payload);
    }
    throw new BadRequestException(`Provedor '${config.provider}' ainda não suportado.`);
  }
}
