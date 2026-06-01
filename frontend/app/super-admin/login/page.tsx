"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saApi } from "@/services/superAdminApi"

export default function SuperAdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { data } = await saApi.post("/super-admin/auth/login", { email, password })
      localStorage.setItem("sa_token", data.accessToken)
      router.push("/super-admin/dashboard")
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) {
        setError("Credenciais inválidas. Verifique email e senha.")
      } else if (!err?.response) {
        setError("Servidor offline ou reiniciando. Aguarde e tente novamente (pode levar até 60s na 1ª vez).")
      } else {
        setError("Erro ao conectar. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sistema — Super Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Acesso restrito à equipe interna</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="superadmin@system.com"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition rounded-xl py-3 font-semibold text-white flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Conectando... (aguarde o servidor)
              </>
            ) : "Entrar"}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Login de restaurante?{" "}
          <a href="/login" className="text-gray-400 hover:text-white transition underline">
            Entrar como cliente
          </a>
        </p>
      </div>
    </div>
  )
}
