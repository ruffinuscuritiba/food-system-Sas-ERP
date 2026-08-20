// Todas as páginas /super-admin/* são dark-only (texto branco hardcoded,
// nunca respeitam CompanyTheme.darkMode). Antes, o único jeito de forçar
// .theme-dark no <html> era um useEffect em ClientShell.tsx — que só roda
// DEPOIS da hidratação, deixando uma janela real (mais longa em conexão
// lenta) onde a página nasce com o tema claro padrão (--surface-0 claro,
// texto branco sobre fundo claro = ilegível, achado ao vivo pelo usuário
// em /super-admin/visitas). Script síncrono no <head>, antes de qualquer
// paint, elimina o flash — mesmo padrão usado por next-themes. O useEffect
// em ClientShell continua existindo como rede de segurança (idempotente).
const ANTI_FOUC_SCRIPT = `document.documentElement.classList.add('theme-dark');`;

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ANTI_FOUC_SCRIPT }} />
      {children}
    </>
  );
}
