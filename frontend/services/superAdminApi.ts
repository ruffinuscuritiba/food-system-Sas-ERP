import axios from 'axios'
import { apiBaseUrl } from './env'

export const saApi = axios.create({ baseURL: apiBaseUrl })

saApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
