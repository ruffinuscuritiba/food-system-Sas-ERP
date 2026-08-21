'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
      window.location.href = '/';
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
