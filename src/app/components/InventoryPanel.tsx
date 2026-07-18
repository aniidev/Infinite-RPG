"use client";

import { useMemo, useState } from "react";
import { DraggableCard, DropZone } from "./dnd";
import { MAX_INVENTORY_SLOTS, type InventoryItem } from "@/game/types";

interface InventoryPanelProps {
  items: InventoryItem[];
  committedCounts: Map<string, number>;
}

type SortMode = "recent" | "tier";

export default function InventoryPanel({ items, committedCounts }: InventoryPanelProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

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
      out.push(remaining === it.quantity ? it : { ...it, quantity: remaining });
    }
    // `items` already arrives most-recent-first, so "recent" keeps that order.
    // "tier" sorts by tier (then power) descending, highest first.
    if (sort === "tier") {
      out.sort(
        (a, b) => (b.tier ?? 1) - (a.tier ?? 1) || (b.power ?? 0) - (a.power ?? 0)
      );
    }
    return out;
  }, [items, query, committedCounts, sort]);

  return (
    <DropZone target="inventory" className="flex h-full min-h-0 flex-col">
      <div className="panel flex h-full min-h-0 flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-sm tracking-wide text-primary">Inventory</h2>
          <span className="font-body text-[11px] tabular-nums text-secondary">
            {items.length}/{MAX_INVENTORY_SLOTS} slots
          </span>
        </div>

        <div className="mb-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="min-w-0 flex-1 rounded-paper border-2 border-ink bg-stone-950 px-2.5 py-1.5 font-body text-sm text-primary placeholder:text-muted focus:border-brass focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sort items"
            className="shrink-0 cursor-pointer rounded-paper border-2 border-ink bg-stone-950 px-2 py-1.5 font-body text-sm text-primary focus:border-brass focus:outline-none"
          >
            <option value="recent">Recent</option>
            <option value="tier">Tier</option>
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          {items.length === 0 ? (
            <p className="px-1 py-6 text-center font-body text-sm text-secondary">
              Empty. Defeat enemies to loot items.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-1 py-6 text-center font-body text-sm text-secondary">
              {query ? `No items match “${query}”.` : "Everything is equipped or staged."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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
