import axios from 'axios'

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://food-system-backend-no7d.onrender.com/api'

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
