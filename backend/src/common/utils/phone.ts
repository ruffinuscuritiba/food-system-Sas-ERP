import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type PhoneNumber,
} from 'libphonenumber-js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Telefone BR — util único do projeto
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nota de arquitetura (importante antes de "melhorar" este arquivo):
 *
 * Existem DOIS problemas diferentes aqui, e eles pedem soluções opostas:
 *
 *  1. GRAVAR/CASAR um telefone com o que já está no banco → `normalizePhoneBr`.
 *     A saída dela é o formato em que os telefones JÁ ESTÃO gravados em
 *     produção (dígitos + DDI 55, sem "+"). Mudar essa saída — inclusive
 *     "melhorando" pra E.164 com "+" — faria os registros antigos deixarem de
 *     casar com os novos, quebrando fidelidade, opt-in de campanha e busca de
 *     cliente. Por isso ela é mantida byte-a-byte compatível.
 *
 *  2. BUSCAR um telefone digitado por humano → `buildPhoneCandidates`.
 *     Aqui o correto é justamente o CONTRÁRIO de normalizar pra uma forma só:
 *     o banco tem números salvos com e sem o 9º dígito móvel (o Brasil passou
 *     a exigir o 9 em 2016, e atendente/cliente ainda digitam das duas formas),
 *     então a busca precisa tentar TODAS as variantes plausíveis. Reduzir isso
 *     a um único E.164 canônico faria a busca deixar de achar metade da base.
 *
 * `libphonenumber-js` entra como camada de VALIDAÇÃO e para conversão E.164
 * explícita (`toE164Br`), onde ela é de fato melhor que regex manual — sem
 * alterar os dois contratos acima.
 */

const BR_DDI = '55';

/** Só os dígitos, sem máscara/espaço/parênteses/"+" . */
export function onlyDigits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Normaliza telefone BR pro formato usado no disparo de WhatsApp e na
 * gravação de `Customer.phone` (dígitos + DDI 55, SEM "+").
 *
 * ⚠️ Contrato congelado: `dispatchMessage`/`sendEvolution` não prefixam DDI
 * sozinhos, e os telefones já gravados em produção estão exatamente nesta
 * forma. Não troque a saída (nem por E.164 com "+") sem migrar os dados.
 */
export function normalizePhoneBr(raw: string): string {
  let digits = onlyDigits(raw);
  if (!digits) return digits;
  // Prefixo de discagem interurbana ("0" antes do DDD — "011..." em vez de
  // "11...") — hábito comum de quem tá fora da área local (a causa raiz real
  // de pedido de cliente de fora nunca receber confirmação no WhatsApp: o
  // "0" extra empurrava a contagem além de 11 dígitos, e o número saía sem
  // o DDI 55 de verdade — silenciosamente nunca entregável).
  if (digits.length > 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith(BR_DDI) && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `${BR_DDI}${digits}`;
  // Sobrou dígito(s) de digitação errada além do esperado (ex: 9 duplicado)
  // — mantém só os últimos 11 (DDD+número) em vez de devolver um número
  // maior que qualquer telefone BR válido.
  if (digits.length > 11) return `${BR_DDI}${digits.slice(-11)}`;
  return digits;
}

/**
 * Tenta interpretar como número brasileiro válido. Devolve o objeto do
 * libphonenumber-js ou null. Usado internamente pelos helpers abaixo.
 */
function parseBr(raw: string): PhoneNumber | undefined {
  const digits = onlyDigits(raw);
  if (!digits) return undefined;
  // Com DDI → parse absoluto; sem DDI → assume BR como país default.
  const candidate = digits.startsWith(BR_DDI) && digits.length >= 12 ? `+${digits}` : digits;
  return parsePhoneNumberFromString(candidate, 'BR');
}

/**
 * `true` se for um telefone brasileiro plausível de verdade (DDD existente,
 * quantidade de dígitos correta pra fixo/móvel) — muito mais confiável que
 * checar `length >= 10` na mão.
 */
export function isValidBrPhone(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (!digits) return false;
  try {
    const candidate =
      digits.startsWith(BR_DDI) && digits.length >= 12 ? `+${digits}` : digits;
    return isValidPhoneNumber(candidate, 'BR');
  } catch {
    return false;
  }
}

/**
 * Formato internacional E.164 canônico (`+5541987397797`) ou null se o número
 * não for válido. Use quando precisar falar com API de terceiro que exige
 * E.164 — NÃO para gravar em `Customer.phone` (ver nota no topo do arquivo).
 */
export function toE164Br(raw: string): string | null {
  const parsed = parseBr(raw);
  return parsed?.isValid() ? parsed.number : null;
}

/** Exibição amigável: `(41) 98739-7797`. Cai no input original se inválido. */
export function formatBrPhone(raw: string): string {
  const parsed = parseBr(raw);
  return parsed?.isValid() ? parsed.formatNational() : String(raw ?? '');
}

/**
 * Variantes plausíveis de um telefone digitado, pra busca por `contains` no
 * banco. Gera com E sem o 9º dígito móvel, e com E sem o DDI 55 — cobrindo
 * todas as formas em que o número pode ter sido gravado ao longo do tempo.
 *
 * Exemplo: "41 98739-7797" → 41987397797, 4187397797, 5541987397797, ...
 *
 * ⚠️ Não "simplifique" isto para um único número canônico: a razão de existir
 * é exatamente a base ter formatos misturados (ver nota no topo do arquivo).
 */
export function buildPhoneCandidates(raw: string): string[] {
  const digits = onlyDigits(raw);
  if (!digits) return [];

  const candidates = new Set<string>([digits]);

  // ── Variação do 9º dígito ────────────────────────────────────────────────
  if (digits.length === 10) {
    // DDD + 8 dígitos → insere o 9 depois do DDD
    candidates.add(digits.slice(0, 2) + '9' + digits.slice(2));
  } else if (digits.length === 11) {
    // DDD + 9 dígitos → remove o 9 logo após o DDD
    candidates.add(digits.slice(0, 2) + digits.slice(3));
  } else if (digits.length === 12 && digits.startsWith(BR_DDI)) {
    candidates.add(digits.slice(0, 4) + '9' + digits.slice(4));
  } else if (digits.length === 13 && digits.startsWith(BR_DDI)) {
    candidates.add(digits.slice(0, 4) + digits.slice(5));
  }

  // ── Variação do DDI ──────────────────────────────────────────────────────
  // Um mesmo cliente pode estar gravado como 41987397797 (PDV, antigo) e como
  // 5541987397797 (WhatsApp/campanha, que sempre prefixa 55). Sem cobrir as
  // duas formas, a busca de cliente por telefone acha um e perde o outro.
  for (const c of [...candidates]) {
    if (c.startsWith(BR_DDI) && (c.length === 12 || c.length === 13)) {
      candidates.add(c.slice(2));
    } else if (c.length === 10 || c.length === 11) {
      candidates.add(`${BR_DDI}${c}`);
    }
  }

  return [...candidates];
}
