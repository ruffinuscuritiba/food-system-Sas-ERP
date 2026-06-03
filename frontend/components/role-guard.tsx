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

    const hasPermission =
      allowedRoles.includes(
        user.role,
      );

    if (!hasPermission) {

      router.push("/pdv");
    }

  }, [user]);

  if (!user) {

    return null;
  }

  const hasPermission =
    allowedRoles.includes(
      user.role,
    );

  if (!hasPermission) {

    return null;
  }

  return children;
}