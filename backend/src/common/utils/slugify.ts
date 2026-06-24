/** Converte texto em slug URL-friendly (sem acentos, sem espaços). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')      // mantém letras, dígitos, espaço, hífen
    .trim()
    .replace(/\s+/g, '-')              // espaços → hífen
    .replace(/-+/g, '-');              // múltiplos hífens → um só
}
