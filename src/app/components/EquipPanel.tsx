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
  { slot: "weapon", label: "Weapon", icon: "⚔︎", kind: "weapon" },
  { slot: "armor", label: "Armor", icon: "⛨︎", kind: "armor" },
  { slot: "element", label: "Element", icon: "✦", kind: "element" },
];

function TotalsRow({ items }: { items: Array<InventoryItem | null> }) {
  const totals = items.reduce(
    (acc, it) => {
      if (it) {
        acc.health += it.stats.health;
        acc.attack += it.stats.attack;
        acc.defense += it.stats.defense;
        acc.luck += it.stats.luck;
      }
      return acc;
    },
    { health: 0, attack: 0, defense: 0, luck: 0 }
  );
  const cells: Array<[string, number]> = [
    ["HP", totals.health],
    ["ATK", totals.attack],
    ["DEF", totals.defense],
    ["LCK", totals.luck],
  ];
  return (
    <div className="mt-auto border-t border-stone-600 pt-2">
      <div className="mb-1 font-display text-[10px] tracking-wide text-secondary">Equipment totals</div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-paper border border-ink bg-stone-900 py-1">
            <div className="font-display text-[9px] tracking-wide text-secondary">{label}</div>
            <div className="font-body text-sm tabular-nums text-primary">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EquipPanel({ weapon, armor, element, onClear }: EquipPanelProps) {
  const items: Record<EquipSlot, InventoryItem | null> = { weapon, armor, element };

  return (
    <div className="panel flex h-full flex-col p-3">
      <h2 className="mb-2 font-display text-sm tracking-wide text-primary">Equipped</h2>

      <div className="flex flex-col gap-2">
        {SLOTS.map(({ slot, label, icon, kind }) => {
          const item = items[slot];
          return (
            <div key={slot} className="flex flex-col gap-0.5">
              <span className="font-body text-[10px] uppercase tracking-wide text-secondary">
                {label}
              </span>
              <DropZone target={slot} accept={(it) => it.kind === kind} className="w-full">
                {item ? (
                  <DraggableCard from={slot} item={item} size="compact" onClick={() => onClear(slot)} />
                ) : (
                  <div className="slot-inset flex h-16 w-full items-center gap-2 px-3 text-stone-500">
                    <span className="font-body text-xl leading-none">{icon}</span>
                    <span className="font-body text-xs italic">Empty</span>
                  </div>
                )}
              </DropZone>
            </div>
          );
        })}
      </div>

      <TotalsRow items={[weapon, armor, element]} />
    </div>
  );
}
