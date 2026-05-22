import axios from 'axios'

// Novo backend padrão: 94zd
const DEFAULT_BACKEND_URL = 'https://food-system-backend-94zd.onrender.com'

let apiUrl = process.env.NEXT_PUBLIC_API_URL || `${DEFAULT_BACKEND_URL}/api`

// Corrigir a URL se ela já contiver /api ou se estiver faltando
if (apiUrl.includes('/api/api')) {
  apiUrl = apiUrl.replace('/api/api', '/api');
} else if (!apiUrl.endsWith('/api')) {
  apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api` : `${apiUrl}/api`;
}

export const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
