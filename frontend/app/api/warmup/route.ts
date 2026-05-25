import { NextResponse } from 'next/server'

const BACKEND_HEALTH = 'https://food-system-backend-no7d.onrender.com/api/health'

export async function GET() {
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
