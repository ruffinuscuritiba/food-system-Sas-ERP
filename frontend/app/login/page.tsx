'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

import toast from 'react-hot-toast'

import { api } from '@/services/api'

import { useAuthStore } from '@/stores/auth.store'

export default function LoginPage() {

  const router =
    useRouter()

  const { setAuth } =
    useAuthStore()

  const [email, setEmail] =
    useState('')

  const [
    password,
    setPassword,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  async function login() {

    if (!email || !password) {

      toast.error(
        'Preencha email e senha',
      )

      return
    }

    try {

      setLoading(true)

      const response =
        await api.post(
          'auth/login',
          {
            email,
            password,
          },
        )

      const {
        accessToken,
        user,
      } = response.data

      if (!accessToken) {

        toast.error(
          'Token inválido',
        )

        return
      }

      setAuth(
        accessToken,
        user,
      )

      document.cookie =
        `token=${accessToken}; path=/`

      localStorage.setItem(
        'token',
        accessToken,
      )

      localStorage.setItem(
        'user',
        JSON.stringify(user),
      )

      toast.success(
        'Login realizado',
      )

      router.push('/')

    } catch (error: any) {

      console.log(error)

      toast.error(
        error?.response?.data
          ?.message ||
        'Erro ao fazer login',
      )

    } finally {

      setLoading(false)
    }
  }

  return (

    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 w-full max-w-md shadow-2xl">

        <h1 className="text-4xl font-bold text-white mb-2">
          Ruffinus ERP
        </h1>

        <p className="text-slate-400 mb-8">
          Painel administrativo
        </p>

        <div className="space-y-4">

          <input
            type="email"

            placeholder="E-mail"

            value={email}

            onChange={(e) =>
              setEmail(
                e.target.value,
              )
            }

            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />

          <input
            type="password"

            placeholder="Senha"

            value={password}

            onChange={(e) =>
              setPassword(
                e.target.value,
              )
            }

            className="w-full bg-slate-800 border border-slate-700 focus:border-green-500 transition text-white p-4 rounded-2xl outline-none"
          />

          <button
            onClick={login}

            disabled={loading}

            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-white py-4 rounded-2xl font-bold"
          >

            {loading
              ? 'Entrando...'
              : 'Entrar'}

          </button>

        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Não tem conta?{' '}
          <Link href="/signup" className="text-green-400 hover:text-green-300 font-medium">
            Criar conta
          </Link>
        </p>

        <div className="border-t border-slate-800 mt-6 pt-4 text-center">
          <Link
            href="/super-admin/login"
            className="text-xs text-slate-600 hover:text-slate-400 transition"
          >
            ⚡ Acesso Super Admin
          </Link>
        </div>

      </div>

    </main>
  )
}