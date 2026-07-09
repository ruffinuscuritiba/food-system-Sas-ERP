// Rastreamento leve de page-views e cliques de CTA em páginas públicas
// (/demo, /ia-demo, /landing). Alimenta /super-admin/visitas.
// Best-effort: nunca deve travar ou lançar erro para o usuário final.

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

export function trackView(page: string) {
  fetch(`${apiBase()}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, eventType: "VIEW" }),
  }).catch(() => {});
}

export function trackClick(page: string, label: string) {
  fetch(`${apiBase()}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, eventType: "CLICK", label }),
    keepalive: true,
  }).catch(() => {});
}
