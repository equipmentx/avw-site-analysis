"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { CURRENCIES, type CurrencyOption } from "@/lib/types";

interface CurrencySelectorProps {
  selected: CurrencyOption;
  onChange: (c: CurrencyOption) => void;
  compact?: boolean;
}

export default function CurrencySelector({ selected, onChange, compact = false }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl transition-colors ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
      >
        <span>{selected.flag}</span>
        <span className="text-white font-bold">{selected.code}</span>
        <span className="text-slate-400 font-medium">{selected.symbol}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-slate-800 border border-slate-600/50 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-700/50">
            <input
              type="text"
              placeholder="Search currency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-700/50 text-white placeholder-slate-500 text-xs px-3 py-2 rounded-lg outline-none"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.code}
                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60 transition-colors text-left ${selected.code === c.code ? "bg-blue-500/10" : ""}`}
              >
                <span className="text-lg">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-semibold">{c.code}</span>
                  <span className="text-slate-400 text-xs ml-1.5">{c.name}</span>
                </div>
                <span className="text-slate-300 text-sm font-bold">{c.symbol}</span>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-slate-700/50 text-center">
            <span className="text-slate-500 text-xs">Rates update hourly via ECB</span>
          </div>
        </div>
      )}
    </div>
  );
}
