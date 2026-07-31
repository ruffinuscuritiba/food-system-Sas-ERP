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
