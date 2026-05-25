import axios from 'axios'
import { apiBaseUrl } from './env'

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 90000, // 90s — accounts for Render free-tier cold start (~50-60s)
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-retry on network errors, 5xx and 404 (Render free-tier returns 404 during cold start)
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (!config) throw error

  const retryCount: number = config._retryCount ?? 0
  if (retryCount >= 3) throw error

  const status = error.response?.status
  const isNetworkError = !error.response
  const is5xx = status >= 500
  // Render returns 404 while spinning up the sleeping service
  const isRenderColdStart404 = status === 404 && config.baseURL?.includes('onrender.com')

  if (!isNetworkError && !is5xx && !isRenderColdStart404) throw error

  config._retryCount = retryCount + 1
  // Progressive delay: 5s, 8s, 12s — backend usually up by 2nd retry
  const delay = [5000, 8000, 12000][retryCount] ?? 10000
  await new Promise<void>((r) => setTimeout(r, delay))
  return api(config)
})

export default api
