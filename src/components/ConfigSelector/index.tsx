"use client";

import { useState } from "react";
import {
  ChevronDown, Users, Clock, Maximize2,
  RotateCcw, Eye, Grid3x3, ArrowRight, CheckCircle,
  Layers, Zap, Info,
} from "lucide-react";
import dynamic from "next/dynamic";
import AerialDiagram from "./AerialDiagram";
import {
  CAR_WASH_CONFIGS,
  CONFIG_CATEGORIES,
  type CarWashConfig,
  type ConfigCategory,
} from "@/lib/carwashConfigs";

// Load Scene3D without SSR (Three.js requires browser)
const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  ),
});

type ViewMode = "perspective" | "aerial" | "interior" | "spin";

// ── 3D viewer (replaces all prior view modes) ─────────────────────────────────

function DiagramViewer({ config, mode }: { config: CarWashConfig; mode: ViewMode }) {
  const hints: Record<ViewMode, string> = {
    perspective: "Drag to orbit · scroll to zoom",
    spin:        "Auto-rotating — drag to take control",
    aerial:      "Top-down view",
    interior:    "Inside view — drag to look around",
  };

  return (
    <div className="w-full h-full relative">
      <Scene3D config={config} mode={mode} className="w-full h-full" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-black/30 px-2 py-1 rounded pointer-events-none select-none">
        {hints[mode]}
      </div>
    </div>
  );
}

// ── Left sidebar config card ───────────────────────────────────────────────────

function ConfigCard({
  config,
  selected,
  onClick,
}: {
  config: CarWashConfig;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 flex items-center gap-2.5
        ${selected
          ? "bg-blue-500/15 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
          : "bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/70 hover:border-slate-600/50"
        }`}
    >
      {/* Mini aerial preview */}
      <div className={`w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 border
        ${selected ? "border-blue-500/40" : "border-slate-700/40"}`}>
        <div style={{ transform: "perspective(200px) rotateX(40deg) rotateZ(-10deg) scale(1.3)", transformOrigin: "center center" }}>
          <AerialDiagram diagramType={config.diagramType} diagramParams={config.diagramParams} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold truncate leading-tight ${selected ? "text-blue-300" : "text-slate-200"}`}>
          {config.shortName}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
          {config.carsPerHour.min}–{config.carsPerHour.max} cars/hr
        </div>
      </div>

      {selected && <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
    </button>
  );
}

// ── Spec pill ─────────────────────────────────────────────────────────────────

function SpecPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-white font-bold text-sm leading-tight">{value}</div>
    </div>
  );
}

// ── Main ConfigSelector ────────────────────────────────────────────────────────

interface Props {
  onSelect: (configId: string | null) => void;
  onSkip: () => void;
  selectedId?: string | null;
}

export default function ConfigSelector({ onSelect, onSkip, selectedId }: Props) {
  const initialConfig = CAR_WASH_CONFIGS.find((c) => c.id === selectedId) ?? CAR_WASH_CONFIGS[0];
  const [activeId, setActiveId]   = useState<string>(initialConfig.id);
  const [viewMode, setViewMode]   = useState<ViewMode>("perspective");
  const [confirmed, setConfirmed] = useState(false);

  // Accordion: open categories (active config's category is always open)
  const [openCategories, setOpenCategories] = useState<Set<ConfigCategory>>(
    new Set([initialConfig.category])
  );

  const config = CAR_WASH_CONFIGS.find((c) => c.id === activeId) ?? CAR_WASH_CONFIGS[0];

  const toggleCategory = (cat: ConfigCategory) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handlePickConfig = (id: string) => {
    const picked = CAR_WASH_CONFIGS.find((c) => c.id === id)!;
    setActiveId(id);
    setConfirmed(false);
    // Ensure the picked config's category is open
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.add(picked.category);
      return next;
    });
  };

  const handleSelect = () => {
    setConfirmed(true);
    onSelect(activeId);
  };

  const VIEW_TABS: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: "perspective", label: "3D View",  icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "spin",        label: "360°",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: "aerial",      label: "Aerial",   icon: <Maximize2 className="w-3.5 h-3.5" /> },
    { id: "interior",    label: "Interior", icon: <Eye className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full">

      {/* ── Left sidebar — accordion ─────────────────────────────────────────── */}
      <div className="lg:w-56 xl:w-64 flex-shrink-0">
        <div className="lg:sticky lg:top-4">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-2.5 px-1">
            Select Configuration
          </p>

          <div className="space-y-1.5">
            {CONFIG_CATEGORIES.map((cat) => {
              const configs  = CAR_WASH_CONFIGS.filter((c) => c.category === cat.id);
              const isOpen   = openCategories.has(cat.id as ConfigCategory);
              const hasActive = configs.some((c) => c.id === activeId);

              // Glow when this category holds the active config but is collapsed
              const glowClosed = hasActive && !isOpen;

              return (
                <div key={cat.id}
                  className={`rounded-xl border overflow-hidden transition-all duration-200
                    ${hasActive
                      ? "border-blue-500/40 bg-slate-900/70"
                      : "border-slate-700/30 bg-slate-900/40"
                    }
                    ${glowClosed ? "shadow-[0_0_14px_3px_rgba(59,130,246,0.25)]" : ""}`}
                >
                  {/* Category header — clickable */}
                  <button
                    onClick={() => toggleCategory(cat.id as ConfigCategory)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors duration-150
                      ${glowClosed ? "bg-blue-500/10 hover:bg-blue-500/15" : "hover:bg-slate-800/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <div className={`text-xs font-bold leading-tight
                          ${hasActive ? "text-blue-300" : "text-slate-300"}`}>
                          {cat.label}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {glowClosed
                            ? <span className="text-blue-400/80 font-medium">Previewing inside ↑</span>
                            : <span className="text-slate-500">{configs.length} format{configs.length !== 1 ? "s" : ""}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200
                        ${isOpen ? "rotate-180" : "rotate-0"}
                        ${hasActive ? "text-blue-400" : "text-slate-500"}`}
                    />
                  </button>

                  {/* Collapsible config list */}
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {configs.map((c) => (
                        <ConfigCard
                          key={c.id}
                          config={c}
                          selected={c.id === activeId}
                          onClick={() => handlePickConfig(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* View mode tabs */}
        <div className="flex gap-1.5 bg-slate-900/60 rounded-xl p-1 border border-slate-700/30">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all
                ${viewMode === tab.id
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Image viewer */}
        <div className="relative bg-slate-900/80 border border-slate-700/40 rounded-2xl overflow-hidden"
          style={{ minHeight: "280px", height: "clamp(280px,40vw,400px)" }}>
          <DiagramViewer config={config} mode={viewMode} />

          {/* Config name overlay */}
          <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <div className="text-white font-bold text-sm">{config.shortName}</div>
            <div className="text-blue-300 text-[10px]">{config.categoryLabel}</div>
          </div>

          {/* Lot size badge */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-right">
            <div className="text-slate-300 text-[10px]">Minimum lot</div>
            <div className="text-white font-bold text-xs">
              {config.minLotWidthFt}×{config.minLotDepthFt}ft
            </div>
          </div>

          {/* Perspective hint */}
          {viewMode === "perspective" && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/40 rounded-lg px-2 py-1">
              <Info className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">Drag to rotate</span>
            </div>
          )}
        </div>

        {/* Config name + tagline */}
        <div>
          <h2 className="text-white font-black text-xl leading-tight">{config.name}</h2>
          <p className="text-blue-400 text-sm mt-0.5">{config.tagline}</p>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">{config.description}</p>
        </div>

        {/* Spec grid — physical/operational specs only (no financial claims) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <SpecPill
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Throughput"
            value={`${config.carsPerHour.min}–${config.carsPerHour.max} cars/hr`}
          />
          <SpecPill
            icon={<Maximize2 className="w-3.5 h-3.5" />}
            label="Min Lot"
            value={`${config.minLotSqFt.toLocaleString()} sqft`}
          />
          <SpecPill
            icon={<Users className="w-3.5 h-3.5" />}
            label="Staff"
            value={`${config.staffRequired.min}–${config.staffRequired.max} people`}
          />
        </div>

        {/* Source note for specs */}
        <p className="text-slate-500 text-[10px] leading-relaxed">
          Throughput, lot, and staffing specs are equipment manufacturer benchmarks (Tommy Car Wash Systems, PDQ, Sonny&apos;s Enterprises, ICA).
          Investment costs and revenue projections are calculated live in the analysis using your location, budget, and country market data — not shown here.
        </p>

        {/* Features */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Grid3x3 className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold text-sm">What This Format Includes</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {config.features.map((f) => (
              <div key={f} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Best / not ideal */}
        <div className="grid sm:grid-cols-2 gap-2.5">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Best For</div>
            <p className="text-slate-300 text-xs leading-relaxed">{config.bestFor}</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">Not Ideal For</div>
            <p className="text-slate-300 text-xs leading-relaxed">{config.notIdealFor}</p>
          </div>
        </div>

        {/* Revenue model note */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-blue-300 text-xs font-bold mb-0.5">Revenue & Investment</div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Financial projections — investment cost, revenue, EBITDA, and payback — are calculated live in the analysis step
              using your location, budget, local wage data (ILO ILOSTAT), and country cost index. No estimates are shown here.
            </p>
            {config.membershipFriendly && (
              <span className="inline-flex items-center gap-1 mt-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" />
                Membership / Subscription Ready
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1 pb-2">
          <button
            onClick={onSkip}
            className="flex-1 py-3 px-6 rounded-xl border border-slate-600/50 text-slate-400 text-sm font-semibold hover:border-slate-500 hover:text-slate-200 transition-all"
          >
            Skip — Analyse Without Format
          </button>
          <button
            onClick={handleSelect}
            className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200
              ${confirmed
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20"
              }`}
          >
            {confirmed ? (
              <>
                <CheckCircle className="w-4 h-4" />
                {config.shortName} Selected — Run Analysis
              </>
            ) : (
              <>
                Select {config.shortName}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
