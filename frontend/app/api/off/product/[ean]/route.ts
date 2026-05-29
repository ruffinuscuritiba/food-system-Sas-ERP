import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { ean: string } }
) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${params.ean}.json`,
      {
        headers: { "User-Agent": "FoodSaaS-ERP/1.0" },
        next: { revalidate: 3600 },
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 0 }, { status: 502 });
  }
}
