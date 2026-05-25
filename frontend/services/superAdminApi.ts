import axios from 'axios'
import { apiBaseUrl } from './env'

export const saApi = axios.create({
  baseURL: apiBaseUrl,
  timeout: 90000, // 90s — Render cold start
})

saApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Retry on network errors / 5xx (Render cold start)
saApi.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (!config) throw error
  const retryCount: number = config._retryCount ?? 0
  if (retryCount >= 3) throw error
  const isNetworkError = !error.response
  const is5xx = error.response?.status >= 500
  if (!isNetworkError && !is5xx) throw error
  config._retryCount = retryCount + 1
  const delay = [5000, 8000, 12000][retryCount] ?? 10000
  await new Promise<void>((r) => setTimeout(r, delay))
  return saApi(config)
})
