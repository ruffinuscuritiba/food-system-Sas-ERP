/**
 * Shared auto-login helper used by /demo/basic, /demo/pro and /demo/enterprise.
 * Returns the accessToken so the caller can set cookies and redirect.
 */
import { api } from "@/services/api";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demoThemes";

export type DemoPlan = "basic" | "pro" | "enterprise";

const PLAN_MAP: Record<DemoPlan, string> = {
  basic:      "demo-basic-001",
  pro:        "demo-pro-001",
  enterprise: "demo-enterprise-001",
};

export function getDemoAccount(plan: DemoPlan): DemoAccount | undefined {
  const id = PLAN_MAP[plan];
  return DEMO_ACCOUNTS.find((d) => d.id === id);
}

export async function loginDemo(plan: DemoPlan) {
  const demo = getDemoAccount(plan);
  if (!demo) throw new Error(`Unknown demo plan: ${plan}`);
  const { data } = await api.post("auth/login", {
    email: demo.email,
    password: demo.password,
  });
  return data as { accessToken: string; user: unknown };
}
