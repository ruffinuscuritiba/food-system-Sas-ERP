import * as Joi from 'joi';

/**
 * Validação das variáveis de ambiente no BOOT da aplicação.
 *
 * Regra de ouro deste arquivo: **só entra em `required()` o que, faltando,
 * torna a aplicação insegura ou inoperante de verdade.** Tudo que apenas
 * desliga uma funcionalidade opcional (fiscal, e-mail, WhatsApp, pagamentos)
 * fica opcional e só gera um AVISO no log.
 *
 * O motivo é concreto: em produção (VPS) `FISCAL_ENCRYPTION_KEY` não está
 * definida hoje — um schema que exigisse "todas as chaves sensíveis" faria o
 * backend deixar de subir no próximo deploy, derrubando a loja inteira por
 * causa de um módulo que ela nem usa. Validação de ambiente serve pra evitar
 * deploy inseguro, não pra criar um novo modo de falha.
 */

/** Faltando qualquer uma destas, a aplicação NÃO sobe. */
const requiredSchema = Joi.object({
  // Sem banco não há aplicação.
  DATABASE_URL: Joi.string().uri({ scheme: [/postgres(ql)?/] }).required().messages({
    'any.required': 'DATABASE_URL é obrigatória (string de conexão do PostgreSQL).',
  }),

  // Segredo de assinatura do JWT. O código já tinha tido um fallback
  // `|| 'secret'` no passado (removido) — com ele, qualquer pessoa podia
  // forjar um token de qualquer empresa. `invalid('secret')` garante que esse
  // valor específico nunca volte por engano via .env.
  JWT_SECRET: Joi.string().min(16).invalid('secret', 'changeme').required().messages({
    'any.required': 'JWT_SECRET é obrigatória.',
    'string.min': 'JWT_SECRET precisa ter ao menos 16 caracteres.',
    'any.invalid': 'JWT_SECRET está com um valor de exemplo inseguro — gere um segredo aleatório.',
  }),

  // Credenciais do super-admin: não existe mais fallback no código
  // (super-admin.service.ts), então sem estas o painel de super-admin fica
  // inacessível — falhar no boot é melhor que descobrir isso na hora do uso.
  SUPER_ADMIN_EMAIL: Joi.string()
    .email()
    .invalid('superadmin@system.com')
    .required()
    .messages({
      'any.invalid':
        'SUPER_ADMIN_EMAIL está usando o valor de exemplo público do repositório — troque por um e-mail real.',
    }),
  SUPER_ADMIN_PASSWORD: Joi.string()
    .min(8)
    .invalid('SuperAdmin@123')
    .required()
    .messages({
      'any.invalid':
        'SUPER_ADMIN_PASSWORD está usando a senha de exemplo pública do repositório — troque imediatamente.',
      'string.min': 'SUPER_ADMIN_PASSWORD precisa ter ao menos 8 caracteres.',
    }),
}).unknown(true); // nunca rejeitar env vars extras (Docker/host injetam muitas)

/**
 * Variáveis que não impedem o boot, mas cuja ausência desliga silenciosamente
 * uma funcionalidade — o log de aviso existe pra ninguém passar dias achando
 * que "a nota fiscal está quebrada" quando na verdade a chave nunca foi setada.
 */
const RECOMMENDED: { key: string; feature: string }[] = [
  { key: 'FISCAL_ENCRYPTION_KEY', feature: 'Módulo Fiscal (NFC-e/NF-e) — credenciais do cliente não podem ser cifradas' },
  { key: 'MERCADOPAGO_ACCESS_TOKEN', feature: 'Checkout/PIX do cardápio digital e assinatura' },
  { key: 'MERCADO_PAGO_ACCESS_TOKEN', feature: 'Repasse (payout) da carteira para as lojas' },
  { key: 'EVOLUTION_API_URL', feature: 'Envio de WhatsApp (Kely, campanhas, avisos)' },
  { key: 'EVOLUTION_API_KEY', feature: 'Envio de WhatsApp (Kely, campanhas, avisos)' },
  { key: 'SMTP_HOST', feature: 'Envio de e-mail (boas-vindas, avisos de trial, leads)' },
  { key: 'FRONTEND_URL', feature: 'Links absolutos em e-mails/WhatsApp' },
  { key: 'ANTHROPIC_API_KEY', feature: 'IA (Kely/Carol, Cadastro Inteligente)' },
];

export function validateEnv(config: Record<string, unknown>) {
  const { error, value } = requiredSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((d) => `  • ${d.message}`).join('\n');
    throw new Error(
      `\n\n❌ Configuração de ambiente inválida — a aplicação não vai subir:\n${details}\n\n` +
        `Defina essas variáveis no .env (veja .env.example) e suba de novo.\n`,
    );
  }

  const missing = RECOMMENDED.filter((r) => {
    const v = config[r.key];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (missing.length > 0) {
    // console.warn direto (e não Logger do Nest): isso roda ANTES do
    // container de DI existir, no carregamento do ConfigModule.
    console.warn(
      `\n⚠️  Variáveis de ambiente opcionais ausentes — as funcionalidades abaixo ficam DESLIGADAS:\n` +
        missing.map((m) => `  • ${m.key} → ${m.feature}`).join('\n') +
        `\n`,
    );
  }

  return value;
}
