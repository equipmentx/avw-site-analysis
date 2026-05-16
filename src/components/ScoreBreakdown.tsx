"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreBreakdownProps {
  components: {
    traffic: number;
    competition: number;
    opportunity: number;
    market: number;
    financial: number;
    accessibility?: number;
  };
  coordinates?: { lat: number; lng: number };
  apiKey?: string;
  hasTomTomData?: boolean;
}

const COMPONENT_META = {
  traffic:     {
    label: "Traffic Volume",
    color: "#3b82f6",
    desc: "Daily cars passing the site",
    // Image is dynamically replaced with Street View of the actual address
    img: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=80&h=80&q=80",
  },
  competition: {
    label: "Competition Gap",
    color: "#a855f7",
    desc: "Lack of nearby competitors",
    img: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=80&h=80&q=80",
  },
  opportunity: {
    label: "Opportunity",
    color: "#10b981",
    desc: "Gaps in existing services",
    img: "https://images.unsplash.com/photo-1611095790444-1dfa35e37b52?auto=format&fit=crop&w=80&h=80&q=80",
  },
  market: {
    label: "Market Activity",
    color: "#f59e0b",
    desc: "Commercial density nearby",
    // Car wash specific image
    img: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=80&h=80&q=80",
  },
  financial: {
    label: "Financial Viability",
    color: "#ec4899",
    desc: "Projected returns vs costs",
    img: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=80&h=80&q=80",
  },
  accessibility: {
    label: "Road Accessibility",
    color: "#06b6d4",
    desc: "Speed, FRC class & ingress quality",
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=80&h=80&q=80",
  },
};

export default function ScoreBreakdown({ components, coordinates, apiKey, hasTomTomData = true }: ScoreBreakdownProps) {
  // Street View image URL for the actual address — changes with every new location
  const streetViewImg = coordinates && apiKey
    ? `https://maps.googleapis.com/maps/api/streetview?size=80x80&location=${coordinates.lat},${coordinates.lng}&fov=90&pitch=5&key=${apiKey}`
    : null;
  const [triggered, setTriggered] = useState(false);
  const [animated, setAnimated] = useState<Record<string, number>>({
    traffic: 0, competition: 0, opportunity: 0, market: 0, financial: 0, accessibility: 0,
  });
  const ref = useRef<HTMLDivElement>(null);

  // Trigger when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !triggered) setTriggered(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [triggered]);

  // Animate all bars simultaneously
  useEffect(() => {
    if (!triggered) return;
    const duration = 1600;
    const steps = 70;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimated({
        traffic:       Math.round(components.traffic       * eased),
        competition:   Math.round(components.competition   * eased),
        opportunity:   Math.round(components.opportunity   * eased),
        market:        Math.round(components.market        * eased),
        financial:     Math.round(components.financial     * eased),
        accessibility: Math.round((components.accessibility ?? 0) * eased),
      });
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [triggered, components]);

  return (
    <div ref={ref} className="space-y-5">
      {(Object.keys(components) as Array<keyof typeof components>).map((key) => {
        const meta = COMPONENT_META[key as keyof typeof COMPONENT_META];
        const target = components[key] ?? 0;
        const current = animated[key];
        const strength = target >= 70 ? "Strong" : target >= 50 ? "Moderate" : "Weak";
        const strengthColor = target >= 70 ? "#10b981" : target >= 50 ? "#f59e0b" : "#ef4444";

        // Accessibility has no data when TomTom is unavailable — show "No data" indicator
        const isNoData = key === "accessibility" && !hasTomTomData;

        return (
          <div key={key} className="flex items-center gap-4">
            {/* Image thumbnail — traffic category uses live Street View of the actual address */}
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-600/40">
              <img
                src={key === "traffic" && streetViewImg ? streetViewImg : meta.img}
                alt={key === "traffic" && streetViewImg ? "Street view of your location" : meta.label}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = meta.img;
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-white text-sm font-semibold">{meta.label}</span>
                  <p className="text-slate-300 text-xs">{meta.desc}</p>
                </div>
                {isNoData ? (
                  <div className="text-right ml-3 flex-shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-slate-600/15 text-slate-400 border-slate-600/40">
                      No Data
                    </span>
                    <div className="text-slate-500 text-xs mt-0.5">TomTom unavailable</div>
                  </div>
                ) : (
                  <div className="text-right ml-3 flex-shrink-0">
                    <span className="text-white font-black text-lg tabular-nums">{current}</span>
                    <span className="text-slate-300 text-xs">/100</span>
                    <div className="text-xs font-semibold" style={{ color: strengthColor }}>
                      {strength}
                    </div>
                  </div>
                )}
              </div>

              {/* Bar — striped when no data */}
              {isNoData ? (
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    background: "repeating-linear-gradient(45deg, #334155 0px, #334155 4px, #1e293b 4px, #1e293b 8px)",
                    opacity: 0.7,
                  }}
                />
              ) : (
                <div className="h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      width: `${current}%`,
                      backgroundColor: meta.color,
                      boxShadow: `0 0 10px ${meta.color}60`,
                      transition: "width 0.04s linear",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 2s infinite",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
