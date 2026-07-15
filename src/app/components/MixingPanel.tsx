"use client";

import { DraggableCard, DropZone } from "./dnd";
import ItemCard from "./ItemCard";
import type { InventoryItem } from "@/game/types";

export type MixResult =
  | { status: "empty" }
  | { status: "mixing" }
  | { status: "done"; item: InventoryItem; discovered: boolean }
  | { status: "error"; message: string };

interface MixingPanelProps {
  slotA: InventoryItem | null;
  slotB: InventoryItem | null;
  result: MixResult;
  onClearSlot: (slot: "a" | "b") => void;
  onMix: () => void;
}

function InputSquare({
  target,
  item,
  label,
  onClear,
}: {
  target: "mixA" | "mixB";
  item: InventoryItem | null;
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <DropZone target={target} className="w-14 rounded-lg">
        {item ? (
          <DraggableCard from={target} item={item} size="tile" onClick={onClear} />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-xs text-slate-600">
            {label}
          </div>
        )}
      </DropZone>
    </div>
  );
}

export default function MixingPanel({
  slotA,
  slotB,
  result,
  onClearSlot,
  onMix,
}: MixingPanelProps) {
  const canMix = !!slotA && !!slotB && result.status !== "mixing";
  const buttonLabel =
    result.status === "mixing" ? "Mixing…" : result.status === "error" ? "↻ Retry" : "⚗️ Mix";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Mixing Table</h2>

      <div className="flex items-end justify-center gap-3">
        <InputSquare target="mixA" item={slotA} label="A" onClear={() => onClearSlot("a")} />
        <span className="mb-4 shrink-0 text-lg text-slate-500">+</span>
        <InputSquare target="mixB" item={slotB} label="B" onClear={() => onClearSlot("b")} />
      </div>

      <div className="my-1 text-center text-lg text-slate-600">↓</div>

      {/* Result */}
      <div className="flex flex-col items-center">
        <span className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Result</span>
        {result.status === "empty" && (
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-slate-700 bg-slate-950/50 text-slate-600">
            ?
          </div>
        )}
        {result.status === "mixing" && (
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-slate-700 bg-slate-950/50">
            <span className="animate-pulseGlow text-2xl">⚗️</span>
          </div>
        )}
        {result.status === "done" && (
          <div className="relative animate-popIn">
            {result.discovered && (
              <div className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 animate-badgePop whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 shadow">
                ✨ First!
              </div>
            )}
            <ItemCard item={result.item} size="tile" />
          </div>
        )}
        {result.status === "error" && (
          <>
            <div
              className="grid h-14 w-14 place-items-center rounded-lg border border-rose-700 bg-rose-950/40 text-xl text-rose-300"
              title={result.message}
            >
              ⚠️
            </div>
            <p className="mt-1 max-w-[12rem] text-center text-[10px] text-rose-300">{result.message}</p>
          </>
        )}
      </div>

      <button
        onClick={onMix}
        disabled={!canMix}
        className="mt-3 w-full rounded-xl bg-fuchsia-600 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
