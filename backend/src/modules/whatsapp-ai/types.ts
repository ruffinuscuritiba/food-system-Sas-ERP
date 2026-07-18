export interface WaConnection {
  id: string;
  companyId: string;
  isActive: boolean;
  provider: 'EVOLUTION' | 'CLOUD_API';
  apiUrl: string | null;
  instanceName: string | null;
  apiToken: string | null;
  phoneNumberId: string | null;
  settings?: WaSettings | null;
}

export interface WaSettings {
  id: string;
  connectionId: string;
  companyId: string;
  isActive: boolean;
  mode: string;
  aiProvider: string | null;
  aiModel: string | null;
  systemPrompt: string | null;
  attendantName: string | null;
  useEmojis: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessDays: string | null;
  offlineMessage: string | null;
  transferKeywords: string | null;
  greetingMessage: string | null;
  typingDelay: number | null;
  paymentMethods: string | null;
}

export interface WaConversation {
  id: string;
  companyId: string;
  connectionId: string;
  customerPhone: string;
  customerName: string | null;
  mode: string;
  status: string;
  aiDisabled: boolean;
  context: Record<string, unknown> | null;
  orderId: string | null;
  connection?: WaConnection;
}

export interface ParsedCommands {
  cleanText: string;
  addItems: { productId: string; qty: number }[];
  confirmOrder: { deliveryType: string; address: string; phone: string } | null;
  transferHuman: boolean;
  closeConversation: boolean;
}
