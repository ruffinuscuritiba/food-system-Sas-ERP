import { NextResponse } from 'next/server'

const PROD_BACKEND = "https://food-system-backend-no7d.onrender.com";
const rawEnv = process.env.NEXT_PUBLIC_API_URL ?? process.env.BACKEND_URL ?? '';
const resolvedBase = rawEnv.includes("94zd") ? PROD_BACKEND : (rawEnv.replace(/\/api$/, '') || PROD_BACKEND);
const BACKEND_HEALTH = resolvedBase + '/api/health';

export async function GET() {
  if (!BACKEND_HEALTH.startsWith('http')) {
    return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_API_URL not configured' }, { status: 200 })
  }
  try {
    const res = await fetch(BACKEND_HEALTH, {
      cache: 'no-store',
      signal: AbortSignal.timeout(55000), // 55s — Vercel function timeout is 60s
    })
    return NextResponse.json({ ok: res.ok, status: res.status, ts: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 })
  }
}
