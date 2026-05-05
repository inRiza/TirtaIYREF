"use client";

import { HelpCircle, Plus, Send } from "lucide-react";

interface MapActionButtonsProps {
  canRecenter: boolean;
  onRecenter: () => void;
  onToggleLegend: () => void;
  onReport: () => void;
}

export function MapActionButtons({
  canRecenter,
  onRecenter,
  onToggleLegend,
  onReport,
}: MapActionButtonsProps) {
  return (
    <>
      <div className="absolute right-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+110px)]">
        <button
          type="button"
          onClick={onRecenter}
          disabled={!canRecenter}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 shadow-lg active:scale-95 transition-transform disabled:opacity-40"
        >
          <Send size={19} className="text-brand-600" />
        </button>
      </div>

      <div className="absolute left-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+110px)]">
        <button
          type="button"
          onClick={onToggleLegend}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 shadow-lg active:scale-95 transition-transform"
        >
          <HelpCircle size={19} className="text-brand" />
        </button>
      </div>

      <div className="absolute left-1/2 z-40 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+110px)]">
        <button
          type="button"
          onClick={onReport}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white text-sm font-bold shadow-xl active:scale-95 transition-transform"
        >
          <div className="items-center border-2 border-white p-1 rounded-full">
            <Plus size={14} strokeWidth={3} />
          </div>
          Laporkan
        </button>
      </div>
    </>
  );
}
