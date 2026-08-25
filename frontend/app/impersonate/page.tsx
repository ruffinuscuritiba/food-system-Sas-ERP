'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { getPdvHref } from '@/lib/segmentLabels';

/**
 * Ponto de entrada pra impersonação vinda de fora do próprio app (ex: o
 * painel agregador SaaS Control Center, que roda em outro domínio e não
 * pode escrever no localStorage/cookie deste app diretamente).
 * Recebe o token+dados do usuário via query string, grava do jeito que o
 * app espera e entra no painel — mesmo mecanismo já usado no botão
 * "Acessar Painel" de dentro do próprio super-admin.
 */
export default function ImpersonatePage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateHandler />
    </Suspense>
  );
}

// Mesma lógica exata do login normal da loja (app/login/page.tsx) e do
// "Entrar" no super-admin nativo (app/super-admin/dashboard/page.tsx
// resolveEntryDest) — pedido explícito do usuário pra nunca mais divergir:
// impersonar por qualquer via tem que cair direto na frente de caixa certa,
// não no Dashboard genérico. Token já está gravado neste ponto, `api`
// (services/api.ts) o usa automaticamente na chamada abaixo.
async function resolveEntryDest(user: { role?: string }): Promise<string> {
  const ROLE_DEST: Record<string, string> = { KITCHEN: '/kitchen', DELIVERY: '/orders' };
  if (user?.role && ROLE_DEST[user.role]) return ROLE_DEST[user.role];
  try {
    const settingsRes = await api.get('/company/settings');
    return getPdvHref(settingsRes.data?.businessSegment);
  } catch {
    return '/pdv';
  }
}

function ImpersonateHandler() {
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const userB64 = params.get('user');
    const companyName = params.get('companyName') ?? '';

    if (!token || !userB64) {
      setError('Link de acesso inválido ou incompleto.');
      return;
    }

    try {
      const user = JSON.parse(atob(decodeURIComponent(userB64)));
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('impersonating', JSON.stringify({ companyName, companyId: user.companyId }));
      document.cookie = `token=${token}; path=/`;
      resolveEntryDest(user).then((dest) => {
        window.location.href = dest;
      });
    } catch {
      setError('Não foi possível processar o link de acesso.');
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      {error ? <p className="text-red-400 text-sm">{error}</p> : <p className="text-sm text-gray-400">Entrando...</p>}
    </div>
  );
}
