"use client";

import { useEffect, useState } from "react";

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
  const [displayed, setDisplayed] = useState(0);
  const [ringProgress, setRingProgress] = useState(0);

  const radius = (size / 2) * 0.8;
  const circumference = 2 * Math.PI * radius;

  const colorMap: Record<string, { stroke: string; bg: string }> = {
    GO:      { stroke: "#10b981", bg: "#064e3b" },
    CAUTION: { stroke: "#f59e0b", bg: "#451a03" },
    "NO-GO": { stroke: "#ef4444", bg: "#450a0a" },
  };
  const colors = colorMap[verdict] ?? colorMap["CAUTION"];

  // Count the number up from 0 and grow the ring simultaneously
  useEffect(() => {
    const duration = 1800;
    const steps = 80;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(score * eased));
      setRingProgress(eased);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const offset = circumference - ringProgress * (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-2xl">
        <defs>
          <filter id="score-glow">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1e293b" strokeWidth={size * 0.06}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={size * 0.065}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter="url(#score-glow)"
        />
      </svg>

      {/* Center number */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-black text-white tabular-nums"
          style={{ fontSize: size * 0.25, textShadow: `0 0 24px ${colors.stroke}50` }}
        >
          {displayed}
        </span>
        <span className="text-slate-400 text-xs mt-0.5">out of 100</span>
      </div>

      {/* Verdict badge */}
      <div
        className="mt-4 px-6 py-2 rounded-full font-black text-lg tracking-wider"
        style={{
          backgroundColor: colors.bg,
          color: colors.stroke,
          border: `2px solid ${colors.stroke}40`,
          textShadow: `0 0 12px ${colors.stroke}70`,
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
