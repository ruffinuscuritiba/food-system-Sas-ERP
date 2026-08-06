/**
 * "Início de hoje" no fuso horário de Brasília (America/Sao_Paulo, UTC-3
 * fixo — o Brasil aboliu o horário de verão em 2019, não há caso de DST a
 * tratar). O container Docker roda em UTC por padrão (confirmado via `date`
 * no VPS); `new Date(); setHours(0, 0, 0, 0)` usa o fuso do SERVIDOR, não o
 * do Brasil — perto da meia-noite UTC (21h em Brasília) o "hoje" do servidor
 * já vira o dia seguinte enquanto ainda é "hoje" no Brasil, fazendo qualquer
 * filtro `createdAt: { gte: today }` excluir silenciosamente pedidos reais
 * feitos mais cedo no mesmo dia comercial (achado real: dashboard e contador
 * de entregas do dia mostrando só 1 de 3 pedidos feitos, todos antes das 21h).
 *
 * Use esta função em vez do padrão `new Date(); setHours(0,0,0,0)` sempre
 * que o "hoje" precisar bater com o dia comercial real da loja (Brasil).
 */
export function getStartOfTodayBrazil(): Date {
  return new Date(`${toBrazilDateKey(new Date())}T00:00:00-03:00`);
}

/**
 * Chave "YYYY-MM-DD" de uma data qualquer, no dia comercial de Brasília —
 * não `date.toISOString().slice(0, 10)` (fuso do servidor/UTC), que agrupa
 * errado um pedido feito às 22h de Brasília (01h UTC do dia seguinte) no
 * dia errado em qualquer série diária (ex: gráfico de faturamento por dia).
 */
export function toBrazilDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Início do dia (00:00:00 em Brasília) de uma string "YYYY-MM-DD" (ou
 * qualquer valor Date-parseável — só a parte da data é usada). Não
 * `new Date(dateStr)` puro: uma string data-only ("2026-07-30") é
 * interpretada pelo JS como meia-noite UTC, 3h ANTES da meia-noite real de
 * Brasília — um filtro de "dia inteiro" que usa isso perde as últimas 3h do
 * dia comercial anterior sendo incluídas por engano.
 */
export function parseBrazilDateStart(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00-03:00`);
}

/**
 * Fim do dia (23:59:59.999 em Brasília) de uma string "YYYY-MM-DD" — não
 * `date.setUTCHours(23,59,59,999)` (fuso UTC), que corta as últimas 3h do
 * dia comercial de Brasília (21h-24h — horário de pico de jantar de
 * pizzaria) fora da janela "hoje"/"esse dia" (achado real: filtro de data
 * "Personalizado" pro dia de ontem excluindo 1 de 3 pedidos reais feitos
 * à noite).
 */
export function parseBrazilDateEnd(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T23:59:59.999-03:00`);
}

/**
 * Início de janela flexível: aceita tanto "YYYY-MM-DD" (dia inteiro, mesmo
 * comportamento de `parseBrazilDateStart`) quanto "YYYY-MM-DDTHH:mm[:ss]"
 * (horário exato escolhido pelo usuário, ex.: filtro "Data e horário
 * específico" do relatório). Sem isso, o relatório só filtrava por dia de
 * calendário — não dava pra reproduzir uma janela como "05/08 03:00 até
 * 06/08 03:00" (virada de turno da loja), só "05/08" ou "06/08" inteiros.
 */
export function parseBrazilFlexibleStart(value: string): Date {
  if (value.length > 10) {
    const withSeconds = value.length === 16 ? `${value}:00` : value;
    return new Date(`${withSeconds}-03:00`);
  }
  return parseBrazilDateStart(value);
}

/** Fim de janela flexível — ver `parseBrazilFlexibleStart`. */
export function parseBrazilFlexibleEnd(value: string): Date {
  if (value.length > 10) {
    const withSeconds = value.length === 16 ? `${value}:00` : value;
    return new Date(`${withSeconds}-03:00`);
  }
  return parseBrazilDateEnd(value);
}
