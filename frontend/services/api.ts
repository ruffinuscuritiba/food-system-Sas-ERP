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

// Auto-retry on network errors and 5xx (handles Render cold start)
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (!config) throw error

  const retryCount: number = config._retryCount ?? 0
  if (retryCount >= 3) throw error

  const isNetworkError = !error.response
  const is5xx = error.response?.status >= 500
  if (!isNetworkError && !is5xx) throw error

  config._retryCount = retryCount + 1
  // Progressive delay: 5s, 8s, 12s — backend usually up by 2nd retry
  const delay = [5000, 8000, 12000][retryCount] ?? 10000
  await new Promise<void>((r) => setTimeout(r, delay))
  return api(config)
})

export default api
