"use client";

import { DraggableCard, DropZone, type EquipSlot } from "./dnd";
import type { InventoryItem } from "@/game/types";

interface EquipPanelProps {
  weapon: InventoryItem | null;
  armor: InventoryItem | null;
  element: InventoryItem | null;
  onClear: (slot: EquipSlot) => void;
}

const SLOTS: ReadonlyArray<{ slot: EquipSlot; label: string; icon: string; kind: string }> = [
  { slot: "weapon", label: "Weapon", icon: "⚔️", kind: "weapon" },
  { slot: "armor", label: "Armor", icon: "🛡️", kind: "armor" },
  { slot: "element", label: "Element", icon: "🔮", kind: "element" },
];

export default function EquipPanel({ weapon, armor, element, onClear }: EquipPanelProps) {
  const items: Record<EquipSlot, InventoryItem | null> = { weapon, armor, element };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Equipped</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {SLOTS.map(({ slot, label, icon, kind }) => {
          const item = items[slot];
          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
              <DropZone target={slot} accept={(it) => it.kind === kind} className="w-14 rounded-lg">
                {item ? (
                  <DraggableCard from={slot} item={item} size="tile" onClick={() => onClear(slot)} />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-xl text-slate-600">
                    {icon}
                  </div>
                )}
              </DropZone>
            </div>
          );
        })}
      </div>
    </div>
  );
}
