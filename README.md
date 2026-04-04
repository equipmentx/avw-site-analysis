# CarWash Intel — Site Analysis Platform

A professional site analysis tool for car wash investors. Enter any address and receive a full GO / CAUTION / NO-GO verdict backed by live competitor data, traffic signals, and a 5-year financial projection.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Setup

Add your Google Maps API key to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
```

Enable these three APIs in [Google Cloud Console](https://console.cloud.google.com):
- Maps JavaScript API
- Places API
- Geocoding API

---

## What It Does

- **Address autocomplete** — works for any location worldwide
- **Competitor scan** — finds every car wash within 5 miles, pulls ratings and reviews
- **Review analysis** — identifies customer complaints and maps them to business opportunities
- **Traffic scoring** — estimates daily vehicle volume from nearby commercial activity
- **Financial model** — 5-year revenue, EBITDA, and payback projection based on your investment budget
- **GO / CAUTION / NO-GO verdict** — 0 to 100 score with plain-English explanation

---

## Tech Stack

- Next.js 14 (App Router) · TypeScript · Tailwind CSS
- Google Maps JavaScript API + Places API
- Recharts (financial charts)

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
