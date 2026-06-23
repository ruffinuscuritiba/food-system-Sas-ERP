"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompanyStore } from "@/stores/company.store";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Redirects to /dashboard if `navKey` is explicitly disabled in sidebarConfig.
 * No-op while config is still loading (empty object) or for SUPER_ADMIN.
 */
export function useNavKeyGuard(navKey: string) {
  const router = useRouter();
  const sidebarConfig = useCompanyStore((s) => s.sidebarConfig);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // Still loading — wait for ClientShell to populate the store
    if (Object.keys(sidebarConfig).length === 0) return;
    // SUPER_ADMIN always bypasses route restrictions
    if (user?.role === "SUPER_ADMIN") return;
    // If the key is explicitly false, block access
    if (sidebarConfig[navKey] === false) {
      router.replace("/dashboard");
    }
  }, [sidebarConfig, navKey, router, user?.role]);
}
