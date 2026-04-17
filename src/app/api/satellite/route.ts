import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat  = searchParams.get("lat");
  const lng  = searchParams.get("lng");
  const zoom = searchParams.get("zoom")  ?? "19";
  const size = searchParams.get("size")  ?? "640x640";

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Maps API key not configured" }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap`
    + `?center=${lat},${lng}`
    + `&zoom=${zoom}`
    + `&size=${size}`
    + `&maptype=satellite`
    + `&key=${key}`;

  return NextResponse.json({ url });
}
