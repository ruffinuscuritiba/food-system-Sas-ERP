/**
 * /r/[token] — Landing page do QR Code de recuperação.
 *
 * O backend em /r/:token (QrRedirectController) já faz o redirect 302 + cookie.
 * Esta página Next.js é um fallback para quando o cliente digita a URL
 * diretamente ou para campanhas sem redirect automático. Redireciona para o
 * backend que resolve o token e devolve o cookie de sessão.
 */
import { redirect } from "next/navigation"

interface Props {
  params: { token: string }
}

export default function QrLandingPage({ params }: Props) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
  // Redireciona para o backend que coloca o cookie e volta para /menu
  redirect(`${apiUrl}/r/${params.token}`)
}
