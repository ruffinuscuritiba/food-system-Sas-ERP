// Abstração de Split Payment (Reforma Tributária do Consumo — IBS/CBS).
// Espelha o mesmo padrão já usado em IIntegrationProvider (integrations/providers).
// Nenhuma implementação aqui pode assumir alíquota, endpoint ou regra oficial
// da Receita Federal/CGIBS ainda não publicada — ver docs/fiscal/.

export interface SplitCalculationInput {
  taxTransactionId: string;
  companyId: string;
  baseAmount: number;
  ibsRate?: number | null;
  cbsRate?: number | null;
}

export interface SplitBreakdown {
  grossAmount: number;
  // Tributo retido/segregado (IBS + CBS). Zero enquanto não houver alíquota
  // configurada — nunca inventado pelo provider.
  segregatedAmount: number;
  // Valor líquido do estabelecimento após a segregação.
  netAmount: number;
}

export interface SplitAuthorization {
  taxSplitAllocationId: string;
  externalReference?: string;
  status: 'AUTHORIZED' | 'PENDING' | 'FAILED';
}

export interface SplitResult {
  taxSplitAllocationId: string;
  status: 'PROCESSING' | 'SETTLED' | 'FAILED';
  gatewayResponse?: unknown;
}

export interface SplitStatus {
  taxSplitAllocationId: string;
  status: string;
}

export interface ISplitPaymentProvider {
  readonly providerName: string;

  /** Calcula a segregação tributária. Nunca chama rede — cálculo puro. */
  calculateSplit(input: SplitCalculationInput): SplitBreakdown;

  /** Autoriza o split junto ao PSP/adquirente/BC (quando existir integração real). */
  authorizeSplit(allocation: { id: string; grossAmount: number }): Promise<SplitAuthorization>;

  /** Executa o split autorizado. */
  executeSplit(auth: SplitAuthorization): Promise<SplitResult>;

  /** Consulta o status atual de um split já processado. */
  getSplitStatus(taxSplitAllocationId: string): Promise<SplitStatus>;

  /** Reverte um split (ex: pedido cancelado após split executado). */
  reverseSplit(taxSplitAllocationId: string): Promise<void>;

  /** Estorna parcial ou totalmente um split já liquidado. */
  refundSplit(taxSplitAllocationId: string, amount: number): Promise<void>;
}
