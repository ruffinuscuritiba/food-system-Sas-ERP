"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";

export interface SubscriptionInfo {
  subscriptionStatus: string;
  dueDate: string | null;
  plan: string;
}

/**
 * Fetches (and caches in sessionStorage) the company subscription status.
 * Used by AI pages to show the lock overlay during trial.
 */
export function useSubscription() {
  const { user } = useAuthStore();
  const companyId = user?.companyId ?? "";
  const isDemo = user?.role === "DEMO";

  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    // Demo users never have a real subscription — treat as ACTIVE for UI purposes
    if (isDemo) {
      setSub({ subscriptionStatus: "ACTIVE", dueDate: null, plan: "PRO" });
      setLoading(false);
      return;
    }

    // Try sessionStorage cache first (avoids extra round-trip on page nav)
    const cached = sessionStorage.getItem(`sub_${companyId}`);
    if (cached) {
      try { setSub(JSON.parse(cached)); } catch {}
      setLoading(false);
    }

    // Always refresh from API so data is current
    api
      .get<SubscriptionInfo>(`/company/${companyId}/subscription`)
      .then((r) => {
        const data: SubscriptionInfo = {
          subscriptionStatus: r.data.subscriptionStatus,
          dueDate: r.data.dueDate,
          plan: r.data.plan,
        };
        setSub(data);
        sessionStorage.setItem(`sub_${companyId}`, JSON.stringify(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId, isDemo]);

  const isActive = sub?.subscriptionStatus === "ACTIVE";

  // True during 3-day trial window (PENDING_PAYMENT and dueDate not yet passed)
  const isInTrial =
    sub?.subscriptionStatus === "PENDING_PAYMENT" &&
    sub.dueDate != null &&
    new Date() < new Date(sub.dueDate);

  // True when trial expired and not yet paid
  const isExpired =
    sub?.subscriptionStatus === "PENDING_PAYMENT" &&
    sub.dueDate != null &&
    new Date() >= new Date(sub.dueDate);

  // AI is locked whenever the company is not ACTIVE (trial or expired)
  const isAiLocked = !loading && !isActive;

  // How many full days remain in trial (0 = last day, negative = expired)
  const trialDaysLeft =
    sub?.dueDate
      ? Math.ceil(
          (new Date(sub.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

  return { sub, loading, isActive, isInTrial, isExpired, isAiLocked, trialDaysLeft };
}
