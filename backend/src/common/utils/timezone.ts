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

/**
 * Checa se "agora" (fuso Brasília) cai dentro de uma janela de horário +
 * dias da semana — usado por cardápio por ocasião (Category.availableFrom/
 * To/Days) e promoção com horário automático (Product.promoStartTime/End/
 * Days). Mesma lógica overnight-aware já corrigida em whatsapp-ai.service.ts
 * isBusinessHours() (achado real do item 159: sem o `endMin < startMin`,
 * uma janela tipo 18h-02h nunca batia) — replicada aqui em vez de importada
 * pra não criar dependência cruzada entre módulos por uma função pequena.
 *
 * `start`/`end` em "HH:mm". `daysCsv` é "0,1,2..6" (0=domingo). Qualquer
 * combinação vazia/nula = sem restrição naquele eixo — os 3 nulos juntos
 * sempre retornam true (comportamento "sempre disponível", preserva 100%
 * o comportamento de categorias/produtos que nunca configuraram isso).
 */
export function isWithinTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  daysCsv: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!start && !end && !daysCsv) return true;

  const brFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = brFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const DAY_MAP: Record<string, number> = {
    dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6,
  };
  const day = DAY_MAP[get('weekday').toLowerCase()] ?? now.getDay();

  if (daysCsv) {
    const days = daysCsv.split(',').map(Number);
    if (!days.includes(day)) return false;
  }

  if (!start || !end) return true;

  const cur = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin < startMin) return cur >= startMin || cur <= endMin;
  return cur >= startMin && cur <= endMin;
}

export type CompanyBusinessHoursDay = { open: string; close: string; isOpen: boolean };
export type CompanyBusinessHours = Record<string, CompanyBusinessHoursDay>;

const WEEKDAY_SHORT_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6,
};

/** "Agora" em Brasília como {day (0=domingo), minutesSinceMidnight}. */
function brNowParts(now: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = WEEKDAY_SHORT_MAP[get('weekday').toLowerCase()] ?? now.getDay();
  const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  return { day, minutes };
}

/**
 * A loja está aberta AGORA segundo `Company.businessHours`? Mesma lógica
 * overnight-aware já corrigida em whatsapp-ai.service.ts isBusinessHours()
 * (item 159 — sem o `closeMin < openMin`, uma janela tipo 18h-02h nunca
 * batia) — reimplementada aqui do zero com o fix já embutido, em vez de
 * importar de dentro de whatsapp-ai/ (evita acoplar um módulo sensível a
 * outro só por uma função de horário). `businessHours` vazio/nulo = sem
 * configuração — assume sempre aberta (nunca bloqueia pedido por engano
 * numa loja que nunca configurou horário).
 */
export function isCompanyOpenNow(
  businessHours: CompanyBusinessHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!businessHours || typeof businessHours !== 'object' || Object.keys(businessHours).length === 0) {
    return true;
  }
  const { day, minutes: cur } = brNowParts(now);
  const todayConfig = businessHours[String(day)];
  if (!todayConfig || !todayConfig.isOpen) return false;
  const [oh, om] = (todayConfig.open || '08:00').split(':').map(Number);
  const [ch, cm] = (todayConfig.close || '22:00').split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (closeMin < openMin) return cur >= openMin || cur <= closeMin;
  return cur >= openMin && cur <= closeMin;
}

/**
 * Próxima janela de abertura a partir de agora (varre até 8 dias pra frente
 * — cobre o caso raro de uma loja fechada a semana inteira sem cair num loop
 * infinito). Usado pra oferecer "agendar pra quando abrir" no checkout do
 * cardápio digital quando a loja está fechada agora. `null` = sem
 * configuração de horário (nunca deveria chegar aqui — isCompanyOpenNow já
 * retornaria true nesse caso) ou nenhum dia aberto configurado.
 */
export function getNextOpening(
  businessHours: CompanyBusinessHours | null | undefined,
  now: Date = new Date(),
): { opensAt: Date; label: string } | null {
  if (!businessHours || typeof businessHours !== 'object') return null;
  const { day: todayDay, minutes: curMinutes } = brNowParts(now);
  const DAY_LABELS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  for (let offset = 0; offset <= 8; offset++) {
    const day = (todayDay + offset) % 7;
    const config = businessHours[String(day)];
    if (!config?.isOpen) continue;
    const [oh, om] = (config.open || '08:00').split(':').map(Number);
    const openMin = oh * 60 + om;
    // No dia de hoje, só conta se o horário de abertura ainda não passou.
    if (offset === 0 && openMin <= curMinutes) continue;

    const opensAt = new Date(now);
    opensAt.setDate(opensAt.getDate() + offset);
    // Ajusta pro fuso de Brasília a partir da data-chave (evita o mesmo tipo
    // de bug de fuso já documentado no topo deste arquivo).
    const dateKey = toBrazilDateKey(opensAt);
    const opensAtBr = new Date(`${dateKey}T${config.open || '08:00'}:00-03:00`);

    const label = offset === 0
      ? `hoje às ${config.open}`
      : offset === 1
        ? `amanhã às ${config.open}`
        : `${DAY_LABELS[day]} às ${config.open}`;
    return { opensAt: opensAtBr, label };
  }
  return null;
}
