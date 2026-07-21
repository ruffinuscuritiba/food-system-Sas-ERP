/**
 * Normaliza telefone BR pro formato usado no disparo de WhatsApp (dígitos +
 * DDI 55) — dispatchMessage/sendEvolution não prefixam DDI sozinhos, então
 * qualquer Customer.phone salvo sem o "55" nunca é alcançável por campanha.
 */
export function normalizePhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return digits;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
