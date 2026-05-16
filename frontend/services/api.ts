import axios from 'axios'

import Cookies from 'js-cookie'

export const api = axios.create({

  baseURL:
    process.env.NEXT_PUBLIC_API_URL,

  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {

    const token =
      Cookies.get('token')

    if (token) {

      config.headers.set(
        'Authorization',
        `Bearer ${token}`,
      )
    }

    return config
  },
)