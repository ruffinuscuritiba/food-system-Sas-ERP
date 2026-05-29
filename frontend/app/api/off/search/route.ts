import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ products: [] });
  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(q)}&action=process&json=1&` +
      `page_size=8&fields=product_name,brands,code,image_url,quantity,categories`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FoodSaaS-ERP/1.0" },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ products: [] }, { status: 502 });
  }
}
