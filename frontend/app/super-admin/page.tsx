"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirects /super-admin → /super-admin/login
export default function SuperAdminRoot() {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    router.replace(token ? "/super-admin/dashboard" : "/super-admin/login")
  }, [])
  return null
}
