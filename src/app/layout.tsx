import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://avw-site-analysis.vercel.app"
  ),
  title: "AVW Site Intel — Car Wash Location Analysis",
  description:
    "Professional site analysis for car wash investors. Discover if your location has the traffic, competition dynamics, and financial potential to build a successful car wash business.",
  keywords: "car wash site analysis, car wash investment, location intelligence, AVW site intel",
  icons: {
    icon: "/avw-logo.png",
    shortcut: "/avw-logo.png",
    apple: "/avw-logo.png",
  },
  openGraph: {
    title: "AVW Site Intel — Know Before You Build",
    description: "Professional site analysis for car wash investors. Enter any address for a full market analysis.",
    type: "website",
    images: ["/avw-logo.png"],
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
