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
  return getDemoAccountById(id);
}

export function getDemoAccountById(accountId: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((d) => d.id === accountId);
}

export async function loginDemo(plan: DemoPlan) {
  const demo = getDemoAccount(plan);
  if (!demo) throw new Error(`Unknown demo plan: ${plan}`);
  return loginDemoAccountById(demo.id);
}

/**
 * Generaliza loginDemo pra qualquer conta de demo (não só basic/pro/
 * enterprise) — usado pelo link mágico /demo/[niche], que precisa logar
 * direto em qualquer uma das ~14 contas (marmitaria, hamburgueria, etc.)
 * sem o visitante precisar clicar em nada.
 */
export async function loginDemoAccountById(accountId: string) {
  const demo = getDemoAccountById(accountId);
  if (!demo) throw new Error(`Unknown demo account: ${accountId}`);
  const { data } = await api.post("auth/login", {
    email: demo.email,
    password: demo.password,
  });
  return data as { accessToken: string; user: unknown };
}
