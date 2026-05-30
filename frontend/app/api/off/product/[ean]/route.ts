import { NextRequest, NextResponse } from "next/server";

// Next.js 16 — context.params is now async (Promise) per breaking change
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ean: string }> }
) {
  const { ean } = await params;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${ean}.json`,
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
