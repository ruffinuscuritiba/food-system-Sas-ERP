"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuthStore,
} from "@/stores/auth.store";

type Props = {

  children:
    React.ReactNode;

  allowedRoles:
    string[];
};

export function RoleGuard({
  children,
  allowedRoles,
}: Props) {

  const router =
    useRouter();

  const {
    user,
    loadAuth,
  } = useAuthStore();

  useEffect(() => {

    loadAuth();

  }, []);

  useEffect(() => {

    if (!user) {

      return;
    }

    // DEMO herda permissões de ADMIN (escrita bloqueada pelo backend)
    const effectiveRole = user.role === "DEMO" ? "ADMIN" : user.role;
    const hasPermission = allowedRoles.includes(effectiveRole);

    if (!hasPermission) {

      router.push("/pdv");
    }

  }, [user]);

  if (!user) {

    return null;
  }

  const effectiveRole = user.role === "DEMO" ? "ADMIN" : user.role;
  const hasPermission = allowedRoles.includes(effectiveRole);

  if (!hasPermission) {

    return null;
  }

  return children;
}