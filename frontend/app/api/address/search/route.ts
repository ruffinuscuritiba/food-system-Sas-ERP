import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (q.length < 4) return NextResponse.json([])

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FoodSaaS-ERP/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json([])
    const data: any[] = await res.json()

    const suggestions = data
      .filter(r => r.address?.road)
      .map(r => ({
        rua:    r.address.road || '',
        bairro: r.address.suburb
               || r.address.neighbourhood
               || r.address.quarter
               || r.address.city_district
               || r.address.village
               || '',
        cidade: r.address.city || r.address.town || r.address.municipality || r.address.county || '',
        cep:    (r.address.postcode || '').replace(/[^0-9]/g, ''),
      }))

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
