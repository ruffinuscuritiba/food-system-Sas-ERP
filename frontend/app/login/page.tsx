'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    if (!email || !password) {
      toast.error('Preencha email e senha')
      return
    }
    try {
      setLoading(true)
      const response = await api.post('auth/login', { email, password })
      const { accessToken, user } = response.data
      if (!accessToken) { toast.error('Token inválido'); return }
      setAuth(accessToken, user)
      document.cookie = `token=${accessToken}; path=/`
      localStorage.setItem('token', accessToken)
      localStorage.setItem('user', JSON.stringify(user))
      toast.success('Login realizado')
      router.push('/')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex">
      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-orange-500 flex-col items-center justify-center p-12 text-white">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-white/20 p-3 rounded-2xl">
            <UtensilsCrossed size={32} />
          </div>
          <span className="text-3xl font-black tracking-tight">FoodSaaS ERP</span>
        </div>
        <h2 className="text-4xl font-black leading-tight text-center mb-4">
          Gerencie seu restaurante com inteligência
        </h2>
        <p className="text-orange-100 text-center max-w-sm leading-relaxed">
          Pedidos, cozinha, estoque, mesas e financeiro — tudo em um só lugar.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-sm">
          {["Pedidos em tempo real", "Controle de estoque", "PDV integrado", "Relatórios completos"].map((f) => (
            <div key={f} className="bg-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-center">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="bg-orange-500 p-2 rounded-xl">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <span className="text-xl font-black text-gray-900">FoodSaaS ERP</span>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1">Bem-vindo de volta</h1>
          <p className="text-gray-400 text-sm mb-8">Entre com suas credenciais para continuar</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                className="w-full border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition text-gray-900 px-4 py-3 rounded-xl outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                className="w-full border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition text-gray-900 px-4 py-3 rounded-xl outline-none text-sm"
              />
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition text-white py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Entrar'}
            </button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">
            Não tem conta?{' '}
            <Link href="/signup" className="text-orange-500 hover:text-orange-600 font-semibold">
              Criar conta
            </Link>
          </p>

          <div className="border-t border-gray-100 mt-6 pt-4 text-center">
            <Link href="/super-admin/login" className="text-xs text-gray-300 hover:text-gray-500 transition">
              Acesso Super Admin
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
