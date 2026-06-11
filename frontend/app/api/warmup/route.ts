import { NextResponse } from 'next/server'

const PROD_BACKEND = "https://api.srv1747711.hstgr.cloud";
const rawEnv = process.env.NEXT_PUBLIC_API_URL ?? process.env.BACKEND_URL ?? '';
const isStale = (u: string) => u.includes("onrender.com") || u.includes("94zd");
const resolvedBase = isStale(rawEnv) ? PROD_BACKEND : (rawEnv.replace(/\/api$/, '') || PROD_BACKEND);
const BACKEND_HEALTH = resolvedBase + '/api/health';

// Evolution API keep-alive — VPS Hostinger
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-j9ur.srv1747711.hstgr.cloud';

async function pingUrl(url: string, timeoutMs = 25000): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    return { ok: res.ok, status: res.status }
  } catch (err: any) {
    return { ok: false, error: err?.message }
  }
}

export async function GET() {
  if (!BACKEND_HEALTH.startsWith('http')) {
    return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_API_URL not configured' }, { status: 200 })
  }

  // Ping both services in parallel — each gets 25s (well within Vercel 60s limit)
  const [backend, evolution] = await Promise.all([
    pingUrl(BACKEND_HEALTH, 25000),
    pingUrl(EVOLUTION_API_URL + '/', 25000),
  ])

  return NextResponse.json({
    ts: new Date().toISOString(),
    backend,
    evolution,
  })
}
