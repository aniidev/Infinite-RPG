"use client";

import { DraggableCard, DropZone } from "./dnd";
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
  onClaim: () => void;
}

function InputSlot({
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
    <DropZone target={target} className="min-w-0 flex-1">
      {item ? (
        <DraggableCard from={target} item={item} size="compact" onClick={onClear} />
      ) : (
        <div className="slot-inset flex h-16 w-full items-center justify-center font-display text-sm text-stone-500">
          {label}
        </div>
      )}
    </DropZone>
  );
}

export default function MixingPanel({
  slotA,
  slotB,
  result,
  onClearSlot,
  onMix,
  onClaim,
}: MixingPanelProps) {
  // Never allow a craft while an unclaimed result sits in the slot; a craft
  // could otherwise silently overwrite (destroy) it.
  const unclaimed = result.status === "done";
  const canMix = !!slotA && !!slotB && result.status !== "mixing" && !unclaimed;
  const buttonLabel =
    result.status === "mixing"
      ? "Mixing…"
      : unclaimed
        ? "Claim first"
        : result.status === "error"
          ? "Retry"
          : "Mix";

  return (
    <div className="panel flex h-full flex-col p-3">
      <h2 className="mb-2 font-display text-sm tracking-wide text-primary">Mixing Table</h2>

      <div className="flex items-center gap-2">
        <InputSlot target="mixA" item={slotA} label="A" onClear={() => onClearSlot("a")} />
        <span className="shrink-0 font-display text-lg text-secondary">+</span>
        <InputSlot target="mixB" item={slotB} label="B" onClear={() => onClearSlot("b")} />
      </div>

      <div className="my-1 text-center text-lg text-secondary">↓</div>

      <div className="flex flex-col items-center">
        <span className="mb-1.5 font-body text-[10px] uppercase tracking-wide text-secondary">
          Result
        </span>

        {result.status === "empty" && (
          <div className="slot-inset grid h-16 w-16 place-items-center font-display text-stone-500">
            ?
          </div>
        )}

        {result.status === "mixing" && (
          <div className="grid h-16 w-16 place-items-center rounded-paper border-2 border-ink bg-stone-700 shadow-ink">
            <span className="animate-mixWobble text-2xl">⚗️</span>
          </div>
        )}

        {result.status === "done" && (
          <div className="relative w-full animate-popIn px-1">
            {/* Badge rides on the result card until claimed (anchored to the card,
                not the RESULT label above it). */}
            {result.discovered && (
              <div className="absolute -right-1 -top-2.5 z-20 animate-badgePop whitespace-nowrap rounded-paper border-2 border-ink bg-brass px-1.5 py-0.5 font-display text-[9px] tracking-wide text-ink shadow-ink-sm">
                First discovery!
              </div>
            )}
            {/* Drag it to a bag/equip slot to claim, or click to send it to the
                inventory. It lives ONLY here until claimed. */}
            <DraggableCard from="result" item={result.item} size="compact" onClick={onClaim} />
            <p className="mt-1 text-center font-body text-[10px] italic text-secondary">
              Drag to claim, or click to bag
            </p>
          </div>
        )}

        {result.status === "error" && (
          <>
            <div
              className="slot-inset grid h-16 w-16 place-items-center text-xl text-rust"
              title={result.message}
            >
              ⚠
            </div>
            <p className="mt-1 max-w-[12rem] text-center font-body text-[10px] text-rust">
              {result.message}
            </p>
          </>
        )}
      </div>

      <button
        onClick={onMix}
        disabled={!canMix}
        className="press mt-3 w-full rounded-paper border-2 border-ink bg-brass py-2 font-display uppercase tracking-wide text-ink disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
