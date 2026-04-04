import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarWash Intel — Site Analysis Platform",
  description:
    "AI-powered site analysis for car wash investors. Discover if your location has the traffic, competition dynamics, and financial potential to build a successful car wash business.",
  keywords: "car wash site analysis, car wash investment, location intelligence, car wash business",
  openGraph: {
    title: "CarWash Intel — Know Before You Build",
    description: "Professional site analysis for car wash investors. Enter any address for a full market analysis.",
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
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
