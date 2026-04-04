"use client";

interface ScoreBreakdownProps {
  components: {
    traffic: number;
    competition: number;
    opportunity: number;
    market: number;
    financial: number;
  };
}

const COMPONENT_META = {
  traffic:     { label: "Traffic Volume",    color: "#3b82f6", icon: "🚗", desc: "Daily cars passing the site" },
  competition: { label: "Competition Gap",   color: "#a855f7", icon: "🏆", desc: "Lack of nearby competitors" },
  opportunity: { label: "Opportunity",       color: "#10b981", icon: "💡", desc: "Gaps in existing services" },
  market:      { label: "Market Activity",   color: "#f59e0b", icon: "🏪", desc: "Commercial density nearby" },
  financial:   { label: "Financial Viability",color: "#ec4899", icon: "💰", desc: "Projected returns vs costs" },
};

export default function ScoreBreakdown({ components }: ScoreBreakdownProps) {
  return (
    <div className="space-y-4">
      {(Object.keys(components) as Array<keyof typeof components>).map((key) => {
        const meta = COMPONENT_META[key];
        const val = components[key];
        const strength = val >= 70 ? "Strong" : val >= 50 ? "Moderate" : "Weak";
        const strengthColor = val >= 70 ? "#10b981" : val >= 50 ? "#f59e0b" : "#ef4444";

        return (
          <div key={key} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <div>
                  <span className="text-white text-sm font-medium">{meta.label}</span>
                  <p className="text-slate-500 text-xs">{meta.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-white font-bold text-sm">{val}</span>
                <span className="text-slate-500 text-xs">/100</span>
                <div className="text-xs" style={{ color: strengthColor }}>
                  {strength}
                </div>
              </div>
            </div>

            {/* Track */}
            <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  width: `${val}%`,
                  backgroundColor: meta.color,
                  transition: "width 1s ease-out",
                  boxShadow: `0 0 8px ${meta.color}60`,
                }}
              >
                {/* Shimmer effect */}
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 2s infinite",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
