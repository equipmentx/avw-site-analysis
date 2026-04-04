"use client";

import { Star, MapPin, Clock, TrendingDown, TrendingUp } from "lucide-react";
import type { CompetitorAnalysis } from "@/lib/types";

interface CompetitorCardProps {
  competitor: CompetitorAnalysis;
  index: number;
}

const THREAT_STYLES = {
  LOW:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Low Threat" },
  MEDIUM: { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/20",  label: "Moderate Threat" },
  HIGH:   { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     label: "High Threat" },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-600"
          }`}
        />
      ))}
      <span className="text-white text-sm font-medium ml-1">{rating?.toFixed(1) ?? "N/A"}</span>
    </div>
  );
}

export default function CompetitorCard({ competitor, index }: CompetitorCardProps) {
  const { place, distanceMiles, sentiment, strengthScore, threatLevel } = competitor;
  const threat = THREAT_STYLES[threatLevel];
  const reviewCount = place.user_ratings_total ?? 0;

  return (
    <div className="card-hover bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 relative overflow-hidden">
      {/* Number badge */}
      <div className="absolute top-4 right-4 w-7 h-7 bg-slate-700/60 rounded-full flex items-center justify-center text-xs text-slate-400 font-bold">
        #{index + 1}
      </div>

      {/* Header */}
      <div className="mb-4 pr-8">
        <h3 className="text-white font-bold text-base leading-tight mb-1 line-clamp-2">
          {place.name}
        </h3>
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <MapPin className="w-3 h-3" />
          <span className="line-clamp-1">{place.vicinity}</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <StarRating rating={place.rating ?? 0} />
          <div className="text-slate-500 text-xs mt-1">{reviewCount.toLocaleString()} reviews</div>
        </div>
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <div className="text-white font-bold text-lg">
            {distanceMiles < 0.1 ? "< 0.1" : distanceMiles.toFixed(1)}
          </div>
          <div className="text-slate-500 text-xs">miles away</div>
        </div>
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <div className={`font-bold text-sm ${strengthScore >= 70 ? "text-red-400" : strengthScore >= 50 ? "text-yellow-400" : "text-emerald-400"}`}>
            {strengthScore}/100
          </div>
          <div className="text-slate-500 text-xs">strength</div>
        </div>
      </div>

      {/* Threat badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mb-4 ${threat.bg} ${threat.text} ${threat.border}`}>
        {threatLevel === "HIGH" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {threat.label}
      </div>

      {/* Status */}
      {place.opening_hours !== undefined && (
        <div className="flex items-center gap-1.5 mb-4">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className={`text-xs font-medium ${place.opening_hours.open_now ? "text-emerald-400" : "text-red-400"}`}>
            {place.opening_hours.open_now ? "Currently Open" : "Currently Closed"}
          </span>
        </div>
      )}

      {/* Complaints / opportunities */}
      {sentiment.topComplaints.length > 0 && (
        <div className="border-t border-slate-700/40 pt-4">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            Customer Complaints → Your Opportunity
          </div>
          <div className="space-y-2">
            {sentiment.topComplaints.slice(0, 3).map((complaint) => (
              <div key={complaint.category} className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/10 rounded-lg p-2">
                <span className="text-sm flex-shrink-0">{complaint.emoji}</span>
                <div>
                  <div className="text-orange-300 text-xs font-medium">{complaint.category}</div>
                  <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{complaint.opportunity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No complaints = strong competitor */}
      {sentiment.topComplaints.length === 0 && reviewCount > 50 && (
        <div className="border-t border-slate-700/40 pt-4">
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-red-300 text-xs font-medium">Strong Competitor</div>
              <div className="text-slate-500 text-xs mt-0.5">High ratings, few complaints. You&apos;ll need to differentiate strongly on service or technology.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
