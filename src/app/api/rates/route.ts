import { NextResponse } from "next/server";

// Fetches live rates from frankfurter.app — free, no API key, ECB data
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (!res.ok) throw new Error("Rate fetch failed");
    const data = await res.json();
    // data.rates is { EUR: 0.92, GBP: 0.79, NGN: 1550, ... }
    return NextResponse.json({
      base: "USD",
      date: data.date,
      rates: { USD: 1, ...data.rates },
      source: "European Central Bank via frankfurter.app",
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    // Fallback rates if API is down (approximate)
    return NextResponse.json({
      base: "USD",
      date: new Date().toISOString().split("T")[0],
      rates: {
        USD: 1,     GBP: 0.79,  EUR: 0.92,  NGN: 1550,
        CAD: 1.36,  AUD: 1.52,  ZAR: 18.5,  GHS: 15.2,
        KES: 130,   AED: 3.67,  INR: 83.5,  BRL: 5.1,
        MXN: 17.2,  JPY: 149,   CNY: 7.24,  SAR: 3.75,
      },
      source: "Fallback rates (approximate)",
      fetchedAt: new Date().toISOString(),
    });
  }
}
