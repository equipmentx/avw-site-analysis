import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://avw-site-analysis.vercel.app"
  ),
  title: "Car Wash Site Intelligence — Location Analysis Tool",
  description:
    "Data-driven site analysis for car wash investors. Review traffic, competition, parcel records, and financial benchmarks for any US address — then make your own decision.",
  keywords: "car wash site analysis, car wash investment, location intelligence, site selection tool",
  openGraph: {
    title: "Car Wash Site Intelligence — Know What the Data Says",
    description: "Review live traffic, parcel records, competitor data, and cost benchmarks for any US address. All sources disclosed.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Pre-warm Google Maps DNS so script loads faster when requested */}
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        {/* Define global Maps-ready dispatcher before any page script runs */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__onGoogleMapsLoaded = function() {
            if (typeof window.initGoogleMaps  === 'function') window.initGoogleMaps();
            if (typeof window._mapCallback    === 'function') window._mapCallback();
          };
        `}} />
      </head>
      <body className="antialiased">
        {children}
        {/* Load Google Maps + Places library once, globally, for all pages */}
        {MAPS_KEY && (
          <Script
            id="google-maps-global"
            src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=__onGoogleMapsLoaded`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
