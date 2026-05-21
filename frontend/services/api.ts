import axios from 'axios'

export const api = axios.create({

  baseURL:
    process.env.NEXT_PUBLIC_API_URL,

  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {

    const token =
      localStorage.getItem('token')

    if (token) {

      config.headers.set(
        'Authorization',
        `Bearer ${token}`,
      )
    }

    return config
  },
)