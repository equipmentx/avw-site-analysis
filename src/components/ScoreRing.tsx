"use client";

interface ScoreRingProps {
  score: number;
  grade: string;
  verdict: string;
  verdictColor: string;
  size?: number;
}

export default function ScoreRing({
  score,
  grade,
  verdict,
  verdictColor,
  size = 200,
}: ScoreRingProps) {
  const radius = (size / 2) * 0.8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colorMap: Record<string, { stroke: string; glow: string; bg: string }> = {
    GO:      { stroke: "#10b981", glow: "rgba(16,185,129,0.4)", bg: "#064e3b" },
    CAUTION: { stroke: "#f59e0b", glow: "rgba(245,158,11,0.4)", bg: "#451a03" },
    "NO-GO": { stroke: "#ef4444", glow: "rgba(239,68,68,0.4)",  bg: "#450a0a" },
  };

  const colors = colorMap[verdict] ?? colorMap["CAUTION"];

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-2xl">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={size * 0.06}
        />
        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={size * 0.065}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter="url(#glow)"
          style={{
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black text-white" style={{ textShadow: `0 0 20px ${colors.stroke}40` }}>
          {score}
        </span>
        <span className="text-sm text-slate-400 mt-0.5">out of 100</span>
      </div>

      {/* Verdict badge */}
      <div
        className="mt-4 px-6 py-2 rounded-full font-black text-lg tracking-wider"
        style={{
          backgroundColor: colors.bg,
          color: colors.stroke,
          border: `2px solid ${colors.stroke}40`,
          textShadow: `0 0 10px ${colors.stroke}60`,
        }}
      >
        {verdict}
      </div>

      <div className="mt-2 text-slate-400 text-sm">
        Grade: <span className="text-white font-bold">{grade}</span>
      </div>
    </div>
  );
}
