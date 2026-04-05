"use client";

import { Star, MapPin, TrendingDown, TrendingUp, ExternalLink } from "lucide-react";
import type { CompetitorAnalysis } from "@/lib/types";

interface CompetitorCardProps {
  competitor: CompetitorAnalysis;
  index: number;
}

const THREAT_STYLES = {
  LOW:    { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", bar: "#10b981", label: "Low Threat" },
  MEDIUM: { text: "text-yellow-400",  border: "border-yellow-500/30",  bg: "bg-yellow-500/10",  bar: "#f59e0b", label: "Moderate Threat" },
  HIGH:   { text: "text-red-400",     border: "border-red-500/30",     bg: "bg-red-500/10",     bar: "#ef4444", label: "High Threat" },
};

// Build a Google Street View URL for the exact coordinates of the competitor.
// This shows the real street-level photo of that location.
// Requires Street View Static API enabled in Google Cloud Console.
function streetViewUrl(lat: number, lng: number, apiKey: string): string {
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=600x240&location=${lat},${lng}&fov=90&pitch=5&key=${apiKey}`
  );
}

// Secondary fallback: satellite map image of the location
function mapStaticUrl(lat: number, lng: number, apiKey: string): string {
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=17&size=600x240&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}&key=${apiKey}`
  );
}

// Complaint category images
const COMPLAINT_IMAGES: Record<string, string> = {
  "Long Wait Times":        "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=60&h=60&q=75",
  "Poor Cleaning Quality":  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=60&h=60&q=75",
  "Vehicle Damage":         "https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=60&h=60&q=75",
  "Poor Customer Service":  "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=60&h=60&q=75",
  "Overpriced":             "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=60&h=60&q=75",
  "Outdated Equipment":     "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=60&h=60&q=75",
  "Vacuums & Amenities":    "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=60&h=60&q=75",
  "Limited Hours":          "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=60&h=60&q=75",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-600"
          }`}
        />
      ))}
      <span className="text-white text-sm font-bold ml-1">{rating?.toFixed(1) ?? "N/A"}</span>
    </div>
  );
}

export default function CompetitorCard({ competitor, index }: CompetitorCardProps) {
  const { place, distanceMiles, sentiment, strengthScore, threatLevel } = competitor;
  const threat = THREAT_STYLES[threatLevel];
  const reviewCount = place.user_ratings_total ?? 0;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const photoRef = place.photos?.[0]?.photo_reference;
  const lat = place.geometry.location.lat;
  const lng = place.geometry.location.lng;

  // Priority 1: real Google Place photo of the actual business
  // Priority 2: Street View of the exact coordinates
  // Priority 3: satellite map of the location
  const photoUrl = photoRef && apiKey
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${photoRef}&key=${apiKey}`
    : streetViewUrl(lat, lng, apiKey);
  const fallbackUrl = mapStaticUrl(lat, lng, apiKey);

  return (
    <div className="card-hover bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden relative flex flex-col">
      {/* Photo banner */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={photoUrl}
          alt={place.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            // If Place photo failed, try Street View; if that fails, try satellite map
            if (!el.src.includes("streetview") && !el.src.includes("staticmap")) {
              el.src = streetViewUrl(lat, lng, apiKey);
            } else if (!el.src.includes("staticmap")) {
              el.src = fallbackUrl;
            }
          }}
        />
        {/* Gradient over photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

        {/* Badge top-right */}
        <div className="absolute top-3 right-3 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-xs text-white font-bold border border-white/10">
          #{index + 1}
        </div>

        {/* Threat pill bottom-left */}
        <div className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${threat.bg} ${threat.text} ${threat.border}`}>
          {threatLevel === "HIGH" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {threat.label}
        </div>

        {/* Open/closed bottom-right */}
        {place.opening_hours !== undefined && (
          <div className={`absolute bottom-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${place.opening_hours.open_now ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
            {place.opening_hours.open_now ? "Open Now" : "Closed"}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Name and address */}
        <div>
          <h3 className="text-white font-bold text-base leading-tight mb-1 line-clamp-2">
            {place.name}
          </h3>
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="line-clamp-1">{place.vicinity}</span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-700/30 rounded-xl p-2.5 text-center">
            <StarRating rating={place.rating ?? 0} />
            <div className="text-slate-400 text-xs mt-1">{reviewCount.toLocaleString()} reviews</div>
          </div>
          <div className="bg-slate-700/30 rounded-xl p-2.5 text-center">
            <div className="text-white font-bold text-lg">
              {distanceMiles < 0.1 ? "< 0.1" : distanceMiles.toFixed(1)}
            </div>
            <div className="text-slate-400 text-xs">mi away</div>
          </div>
          <div className="bg-slate-700/30 rounded-xl p-2.5 text-center">
            <div
              className="font-bold text-lg"
              style={{ color: strengthScore >= 70 ? "#ef4444" : strengthScore >= 50 ? "#f59e0b" : "#10b981" }}
            >
              {strengthScore}
            </div>
            <div className="text-slate-400 text-xs">strength</div>
          </div>
        </div>

        {/* Competitor strength bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Competitor Strength</span>
            <span className="text-white font-semibold">{strengthScore}/100</span>
          </div>
          <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${strengthScore}%`, backgroundColor: threat.bar, boxShadow: `0 0 6px ${threat.bar}60` }}
            />
          </div>
        </div>

        {/* Complaints with images */}
        {sentiment.topComplaints.length > 0 && (
          <div className="border-t border-slate-700/40 pt-3">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Customer Pain Points → Your Opportunity
            </p>
            <div className="space-y-2">
              {sentiment.topComplaints.slice(0, 3).map((complaint) => (
                <div
                  key={complaint.category}
                  className="group/pain relative flex items-start gap-2.5 bg-orange-500/5 border border-orange-500/10 rounded-xl p-2.5 cursor-default hover:border-orange-400/30 hover:bg-orange-500/10 transition-colors duration-200"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-orange-500/20">
                    <img
                      src={COMPLAINT_IMAGES[complaint.category] ?? "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=60&h=60&q=75"}
                      alt={complaint.category}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-orange-300 text-xs font-semibold leading-tight">{complaint.category}</div>
                    <div className="text-slate-400 text-xs mt-0.5 leading-relaxed max-h-8 group-hover/pain:max-h-48 overflow-hidden transition-[max-height] duration-500 ease-in-out">{complaint.opportunity}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View on Google Maps */}
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${place.place_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-center gap-2 border border-slate-600/40 hover:border-blue-500/50 bg-slate-700/20 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 text-xs font-semibold py-2.5 rounded-xl transition-all duration-200"
        >
          <MapPin className="w-3 h-3" />
          View on Google Maps
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Strong competitor warning */}
        {sentiment.topComplaints.length === 0 && reviewCount > 50 && (
          <div className="border-t border-slate-700/40 pt-3">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=60&h=60&q=75"
                  alt="Strong Competitor"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <div className="text-red-300 text-xs font-semibold">Strong Competitor</div>
                <div className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                  High ratings with few complaints. Differentiate on technology or premium service to compete.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
