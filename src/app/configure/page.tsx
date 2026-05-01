"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { CURRENCIES } from "@/lib/types";

const ConfigSelector = dynamic(() => import("@/components/ConfigSelector"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  ),
});

function ConfigurePage() {
  const router      = useRouter();
  const params      = useSearchParams();

  const address     = params.get("address")  ?? "";
  const budget      = params.get("budget")   ?? "";
  const currCode    = params.get("currency") ?? "USD";
  const radius      = params.get("radius")   ?? "5";
  const lat         = params.get("lat")      ?? "";
  const lng         = params.get("lng")      ?? "";
  const placeId     = params.get("placeId")  ?? "";

  const currency = CURRENCIES.find((c) => c.code === currCode) ?? CURRENCIES[0];

  const buildAnalysisUrl = (configId: string | null) => {
    const p = new URLSearchParams({ address, budget, currency: currCode, radius });
    if (configId) p.set("config", configId);
    if (lat)     p.set("lat",     lat);
    if (lng)     p.set("lng",     lng);
    if (placeId) p.set("placeId", placeId);
    return `/analysis?${p.toString()}`;
  };

  const handleSelect = (configId: string | null) => {
    router.push(buildAnalysisUrl(configId));
  };

  const handleSkip = () => {
    router.push(buildAnalysisUrl(null));
  };

  const handleBack = () => {
    router.back();
  };

  // Budget param kept for URL compatibility but no longer displayed upfront.
  // Investment ranges per format are shown on each config card instead.

  return (
    <main className="min-h-screen bg-[#0a1020]">
      {/* Nav bar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3.5
        backdrop-blur-xl bg-[#0a1020]/90 border-b border-slate-800/60">

        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="truncate max-w-[200px] sm:max-w-xs text-slate-300">{address}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-xs">
            Investment ranges shown on each format below
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <span className="text-blue-300 font-bold text-[9px]">1</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">Location</span>
          </div>
          <div className="w-4 h-px bg-slate-700" />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">2</span>
            </div>
            <span className="text-blue-300 font-semibold hidden sm:inline">Format</span>
          </div>
          <div className="w-4 h-px bg-slate-700" />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-slate-700/60 border border-slate-600/40 flex items-center justify-center">
              <span className="text-slate-500 font-bold text-[9px]">3</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">Analysis</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Choose Your Car Wash Format
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Select the format that best matches your investment goals and lot size.
            The analysis will tailor financial projections, lot fit checks, and the
            AI decision to your chosen format. You can skip this step if unsure.
          </p>
        </div>

        <ConfigSelector
          onSelect={handleSelect}
          onSkip={handleSkip}
        />
      </div>
    </main>
  );
}

export default function ConfigurePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a1020] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    }>
      <ConfigurePage />
    </Suspense>
  );
}
