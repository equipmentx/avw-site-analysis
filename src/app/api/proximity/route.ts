import { NextRequest, NextResponse } from "next/server";
import { fetchProximityFromOverpass } from "@/lib/proximity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const result = await fetchProximityFromOverpass(lat, lng);
  return NextResponse.json(result);
}
