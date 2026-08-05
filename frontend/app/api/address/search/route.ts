import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (q.length < 4) return NextResponse.json([])

  // Cidade/UF da loja (opcionais) — sem contexto geográfico, o Nominatim erra
  // fácil ruas de cidade pequena ou nomes que soam como pessoa ("Rua Walter
  // José Wunderlich"). Anexar cidade/UF na busca melhora muito o acerto.
  const city = req.nextUrl.searchParams.get('city') || ''
  const state = req.nextUrl.searchParams.get('state') || ''
  const scopedQ = [q, city, state].filter(Boolean).join(', ')

  async function search(term: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(term)}&limit=5&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FoodSaaS-ERP/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data: any[] = await res.json()
    return data
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
  }

  // Nominatim/OSM quase nunca tem CEP cadastrado pra endereço brasileiro —
  // rua/bairro/cidade vêm certos mas o campo CEP fica vazio na maioria dos
  // casos (achado reportado pelo usuário: preenchia tudo menos o CEP).
  // ViaCEP tem busca por UF+cidade+logradouro com CEP de verdade — usado só
  // pra completar as sugestões que vieram sem CEP do Nominatim.
  async function backfillCep(rua: string, cidade: string, uf: string): Promise<string> {
    if (!rua || !cidade || uf.length !== 2) return ''
    try {
      const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return ''
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return ''
      return (data[0].cep || '').replace(/[^0-9]/g, '')
    } catch { return '' }
  }

  try {
    // 1ª tentativa: query com cidade/UF anexada (mais precisa). Se vier vazio
    // e havia cidade/UF, tenta de novo sem elas — melhor achar algo impreciso
    // que não achar nada.
    let suggestions = await search(scopedQ)
    if (suggestions.length === 0 && scopedQ !== q) {
      suggestions = await search(q)
    }

    const uf = state.toUpperCase()
    await Promise.all(
      suggestions.map(async s => {
        if (!s.cep && s.cidade) {
          s.cep = await backfillCep(s.rua, s.cidade, uf)
        }
      }),
    )

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
