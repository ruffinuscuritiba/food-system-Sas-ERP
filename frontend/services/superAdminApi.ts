import axios from 'axios'
import { apiBaseUrl } from './env'

export const saApi = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20000, // 20s — VPS Hostinger sempre ativo (era 90s para Render cold start)
})

saApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Retry on network errors only (VPS is always up — no need for 5xx retry)
saApi.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (!config) throw error
  const retryCount: number = config._retryCount ?? 0
  if (retryCount >= 1) throw error          // só 1 retry para rede instável
  const isNetworkError = !error.response
  if (!isNetworkError) throw error           // não retenta 5xx (VPS não tem cold start)
  config._retryCount = retryCount + 1
  await new Promise<void>((r) => setTimeout(r, 3000))
  return saApi(config)
})
