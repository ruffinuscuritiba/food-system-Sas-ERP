import { NextRequest, NextResponse } from 'next/server'

// Rotas públicas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/landing',
  '/menu',
  '/pagamento',
  '/pagamento/sucesso',
  '/pagamento/cancelado',
  '/pedido',
  '/super-admin',
  '/impersonate',
  '/demo',
  '/ia-demo',
  '/tracking',
  '/order-status',
  '/r',
  '/termos',
  '/driver-invite',
  // /driver roda como app "Adicionar à Tela de Início" no iPhone do
  // entregador (standalone WKWebView) — cookie setado via JS
  // (document.cookie, não header Set-Cookie do servidor) não sobrevive de
  // forma confiável entre aberturas nesse modo (achado real: 13/08/2026,
  // "toda vez que abro o app preciso logar de novo" mesmo com o token
  // ainda válido por 7 dias no localStorage, que É confiável nesse
  // contexto). O gate desse grupo de rotas passou a ser 100% client-side
  // (ver DriverLayout), lendo localStorage em vez de depender do cookie
  // que o middleware (server-side) enxerga.
  '/driver',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Permitir rotas públicas sem token
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Verificar token para rotas protegidas
  const token = request.cookies.get('token')?.value || null

  if (!token) {
    // Redirecionar para login se não houver token
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Continuar para a rota protegida
  return NextResponse.next()
}

// Configurar quais rotas o middleware deve processar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - demo-assets (static JPEG/PNG assets served from /public/demo-assets/)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|demo-assets).*)',
  ],
}
