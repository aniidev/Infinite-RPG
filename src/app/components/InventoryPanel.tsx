"use client";

import { useMemo, useState } from "react";
import { DraggableCard, DropZone } from "./dnd";
import { MAX_INVENTORY_SLOTS, type InventoryItem } from "@/game/types";

interface InventoryPanelProps {
  items: InventoryItem[];
  // Units of each item currently in an equip/mix slot. The grid shows the
  // REMAINING quantity (moved one, kept the rest); a fully-committed stack drops
  // out of the grid until a unit is returned.
  committedCounts: Map<string, number>;
}

export default function InventoryPanel({ items, committedCounts }: InventoryPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: InventoryItem[] = [];
    for (const it of items) {
      const remaining = it.quantity - (committedCounts.get(it.id) ?? 0);
      if (remaining <= 0) continue;
      if (
        q &&
        !it.name.toLowerCase().includes(q) &&
        !it.element.toLowerCase().includes(q) &&
        !it.kind.toLowerCase().includes(q)
      ) {
        continue;
      }
      // Show the remaining count on the card, not the full owned quantity.
      out.push(remaining === it.quantity ? it : { ...it, quantity: remaining });
    }
    return out;
  }, [items, query, committedCounts]);

  return (
    // The inventory is also a drop target: dropping an equipped/staged card here
    // clears it back into the bag.
    <DropZone target="inventory" className="flex h-full min-h-0 flex-col">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Inventory</h2>
          <span className="text-[11px] text-slate-400">
            {items.length}/{MAX_INVENTORY_SLOTS} slots
          </span>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">
              Empty — defeat enemies to loot items.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">
              {query ? `No items match “${query}”.` : "Everything is equipped or staged."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map((item) => (
                <DraggableCard key={item.id} from="inventory" item={item} size="full" />
              ))}
            </div>
          )}
        </div>
      </div>
    </DropZone>
  );
}
