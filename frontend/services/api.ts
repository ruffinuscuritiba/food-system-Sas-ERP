import axios from 'axios'

let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://food-system-backend-no7d.onrender.com/api'

// Garantir que a URL termine com /api para evitar 404
if (apiUrl && !apiUrl.endsWith('/api')) {
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
