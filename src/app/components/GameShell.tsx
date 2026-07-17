"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import BattlePanel, { type PlayerStats } from "./BattlePanel";
import EquipPanel from "./EquipPanel";
import InventoryPanel from "./InventoryPanel";
import MixingPanel, { type MixResult } from "./MixingPanel";
import ItemCard from "./ItemCard";
import {
  ActiveDragProvider,
  type DragData,
  type DragFrom,
  type DropData,
  type EquipSlot,
} from "./dnd";
import type { InventoryItem } from "@/game/types";

const PLAYER_KEY = "infinite-rpg-player-id";

interface Equip {
  weapon: string | null;
  armor: string | null;
  element: string | null;
}
interface Mix {
  a: string | null;
  b: string | null;
}
interface LootBurst {
  key: number;
  items: InventoryItem[];
}

export default function GameShell() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [equip, setEquip] = useState<Equip>({ weapon: null, armor: null, element: null });
  const [mix, setMix] = useState<Mix>({ a: null, b: null });
  const [result, setResult] = useState<MixResult>({ status: "empty" });

  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [lootBurst, setLootBurst] = useState<LootBurst | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const showToast = useCallback((msg: string, ms = 2500) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  const refreshInventory = useCallback(async (id: string): Promise<InventoryItem[]> => {
    const res = await fetch(`/api/inventory?playerId=${encodeURIComponent(id)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const next: InventoryItem[] = data.items ?? [];
    setItems(next);
    return next;
  }, []);

  // Bootstrap: reuse a stored player (and level) or create one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = localStorage.getItem(PLAYER_KEY);
      let level = 1;
      if (id) {
        const res = await fetch(`/api/player?playerId=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          level = data.player?.level ?? 1;
        } else {
          id = null;
        }
      }
      if (!id) {
        const res = await fetch("/api/player", { method: "POST" });
        const data = await res.json();
        id = data.player.id as string;
        level = data.player.level ?? 1;
        localStorage.setItem(PLAYER_KEY, id);
      }
      if (cancelled) return;
      setPlayerId(id);
      setPlayerLevel(level);
      await refreshInventory(id);
    })().catch(() => setError("Could not start a game session."));
    return () => {
      cancelled = true;
    };
  }, [refreshInventory]);

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const at = useCallback((id: string | null) => (id ? itemById.get(id) ?? null : null), [itemById]);

  const equipped = {
    weapon: at(equip.weapon),
    armor: at(equip.armor),
    element: at(equip.element),
  };
  const stagedA = at(mix.a);
  const stagedB = at(mix.b);

  // How many UNITS of each item are committed to equip/mix slots. The inventory
  // shows the remaining quantity, so a stack of ×3 with one equipped still shows
  // ×2 in the bag (moved one, kept the rest); returning it stacks back up.
  // A freshly crafted item lives ONLY in the result slot until the player claims
  // it, so hide one unit of it from the bag too (it is already in the server-side
  // inventory from the craft, but must appear exactly once (here, in the slot).
  const committedCounts = useMemo(() => {
    const m = new Map<string, number>();
    const ids = [equip.weapon, equip.armor, equip.element, mix.a, mix.b];
    if (result.status === "done") ids.push(result.item.id);
    for (const id of ids) {
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [equip.weapon, equip.armor, equip.element, mix.a, mix.b, result]);

  // Player combat stats = base + everything currently equipped (feeds the engine
  // just like the single-weapon stats did before).
  const playerStats: PlayerStats = useMemo(() => {
    let attack = 8;
    let defense = 1;
    let luck = 0;
    for (const it of [equipped.weapon, equipped.armor, equipped.element]) {
      if (it) {
        attack += it.stats.attack;
        defense += it.stats.defense;
        luck += it.stats.luck;
      }
    }
    return { attack, defense, luck };
  }, [equipped.weapon, equipped.armor, equipped.element]);

  // ---- drag routing -------------------------------------------------------
  const clearFrom = useCallback((from: DragFrom) => {
    if (from === "weapon" || from === "armor" || from === "element") {
      setEquip((p) => ({ ...p, [from]: null }));
    } else if (from === "mixA") {
      setMix((p) => ({ ...p, a: null }));
    } else if (from === "mixB") {
      setMix((p) => ({ ...p, b: null }));
    }
  }, []);

  // Discard an unwanted item: removes the whole stack from the player's bag.
  // Confirmed first so a stray drop can't silently delete a stack.
  const discardItem = useCallback(
    async (item: InventoryItem) => {
      if (!playerId) return;
      const label = item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name;
      if (!window.confirm(`Discard ${label}? This removes the whole stack for good.`)) return;
      try {
        const res = await fetch("/api/inventory/discard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, itemId: item.id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Discard failed.");
        }
        await refreshInventory(playerId);
        showToast(`Discarded ${item.name}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Discard failed.");
      }
    },
    [playerId, refreshInventory, showToast]
  );

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as DragData | undefined;
    setActiveItem(data?.item ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null);
    const drag = e.active.data.current as DragData | undefined;
    const drop = e.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;
    const { item, from } = drag;
    const { target } = drop;

    // Dropped on the trash: pull it out of whatever slot it came from, then
    // discard the whole stack (with a confirm inside discardItem).
    if (target === "trash") {
      if (from === "result") setResult({ status: "empty" });
      else clearFrom(from); // no-op when dragged from the inventory
      void discardItem(item);
      return;
    }

    // Claiming the freshly crafted item out of the result slot. It only ever
    // moves OUT of the slot (never a drop target), and claiming empties the slot.
    if (from === "result") {
      if (result.status !== "done") return;
      if (target === "weapon" || target === "armor" || target === "element") {
        if (item.kind !== target) {
          showToast(`A ${item.kind} can't go in the ${target} slot.`);
          return;
        }
        setEquip((p) => ({ ...p, [target]: item.id }));
      } else if (target === "mixA" || target === "mixB") {
        const dst = target === "mixA" ? "a" : "b";
        setMix((p) => ({ ...p, [dst]: item.id }));
      }
      // inventory (or any target) claims it; the item is already in the bag.
      setResult({ status: "empty" });
      return;
    }

    if (target === "inventory") {
      if (from !== "inventory") clearFrom(from);
      return;
    }

    if (target === "weapon" || target === "armor" || target === "element") {
      if (item.kind !== target) {
        showToast(`A ${item.kind} can't go in the ${target} slot.`);
        return;
      }
      setEquip((prev) => {
        const next = { ...prev, [target]: item.id };
        if ((from === "weapon" || from === "armor" || from === "element") && from !== target) {
          next[from] = null;
        }
        return next;
      });
      if (from === "mixA") setMix((p) => ({ ...p, a: null }));
      if (from === "mixB") setMix((p) => ({ ...p, b: null }));
      return;
    }

    if (target === "mixA" || target === "mixB") {
      const dst = target === "mixA" ? "a" : "b";
      setMix((prev) => {
        const next = { ...prev, [dst]: item.id };
        if (from === "mixA" && dst !== "a") next.a = null;
        if (from === "mixB" && dst !== "b") next.b = null;
        return next;
      });
      if (from === "weapon" || from === "armor" || from === "element") clearFrom(from);
      return;
    }
  }

  // ---- mixing -------------------------------------------------------------
  const doMix = useCallback(async () => {
    if (!playerId || !mix.a || !mix.b) return;
    setError(null);
    setResult({ status: "mixing" });
    const aId = mix.a;
    const bId = mix.b;
    try {
      const res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: aId, b: bId, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mixing failed.");

      const fresh = await refreshInventory(playerId);
      const resolved = fresh.find((i) => i.id === data.item.id) ?? (data.item as InventoryItem);
      setResult({ status: "done", item: resolved, discovered: !!data.discovered });
      // Inputs were consumed server-side; clear the staged slots.
      setMix({ a: null, b: null });
    } catch (err) {
      // Failed craft consumes nothing; keep the staged items and offer retry.
      setResult({ status: "error", message: err instanceof Error ? err.message : "Mixing failed." });
    }
  }, [playerId, mix.a, mix.b, refreshInventory]);

  const clearSlot = useCallback((slot: "a" | "b") => {
    setMix((p) => ({ ...p, [slot]: null }));
  }, []);

  // Click-to-claim fallback: send the crafted item to the bag (it is already in
  // the server inventory; this just releases the result slot so it shows there).
  const claimToInventory = useCallback(() => {
    setResult((r) => (r.status === "done" ? { status: "empty" } : r));
  }, []);

  const clearEquip = useCallback((slot: EquipSlot) => {
    setEquip((p) => ({ ...p, [slot]: null }));
  }, []);

  // ---- loot drop ----------------------------------------------------------
  const handleLoot = useCallback(
    (loot: InventoryItem[]) => {
      if (playerId) void refreshInventory(playerId);
      setLootBurst({ key: Date.now(), items: loot.slice(0, 6) });
      window.setTimeout(() => setLootBurst(null), 1100);
    },
    [playerId, refreshInventory]
  );

  async function handleRestart() {
    if (!playerId) return;
    if (
      !window.confirm(
        "Restart your game? You'll lose all items except the Rusty Sword and return to level 1."
      )
    )
      return;
    setError(null);
    try {
      const res = await fetch("/api/player/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Restart failed.");
      }
      const data = await res.json();
      setPlayerLevel(data.player?.level ?? 1);
      setEquip({ weapon: null, armor: null, element: null });
      setMix({ a: null, b: null });
      setResult({ status: "empty" });
      await refreshInventory(playerId);
      showToast("Game restarted. Only the Rusty Sword remains.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restart failed.");
    }
  }

  if (!playerId) {
    return <div className="p-6 font-body text-sm text-secondary">Starting your adventure…</div>;
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col gap-3 p-3 md:h-[100dvh] md:overflow-hidden">
      <header className="flex shrink-0 items-center justify-between">
        <h1 className="font-display text-xl tracking-wide text-primary">Infinite Crafting RPG</h1>
        <button
          onClick={handleRestart}
          className="press rounded-paper border-2 border-ink bg-rust px-3 py-1.5 font-display text-sm uppercase tracking-wide text-primary"
        >
          Restart
        </button>
      </header>

      {error && (
        <div className="shrink-0 rounded-paper border-2 border-ink bg-rust px-3 py-2 font-body text-sm text-primary">
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        <ActiveDragProvider value={activeItem}>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* BATTLE: top, focal, spanning the full width of the bottom row */}
            <div className="relative w-full shrink-0">
              <BattlePanel
                playerId={playerId}
                playerStats={playerStats}
                initialLevel={playerLevel}
                onLoot={handleLoot}
                onProgress={setPlayerLevel}
              />
              {/* loot falling toward the inventory below */}
              {lootBurst && (
                <div
                  key={lootBurst.key}
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center gap-3"
                >
                  {lootBurst.items.map((it, i) => (
                    <span
                      key={`${it.id}-${i}`}
                      className="animate-lootFall text-3xl"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      {it.glyph}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* BOTTOM: equipped | inventory | mixing (stacks on narrow) */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
              <div className="order-2 shrink-0 md:order-1 md:w-52">
                <EquipPanel
                  weapon={equipped.weapon}
                  armor={equipped.armor}
                  element={equipped.element}
                  onClear={clearEquip}
                />
              </div>

              <div className="order-3 min-h-0 max-h-[46vh] flex-1 md:order-2 md:max-h-none">
                <InventoryPanel items={items} committedCounts={committedCounts} />
              </div>

              <div className="order-1 shrink-0 md:order-3 md:w-64">
                <MixingPanel
                  slotA={stagedA}
                  slotB={stagedB}
                  result={result}
                  onClearSlot={clearSlot}
                  onMix={doMix}
                  onClaim={claimToInventory}
                />
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeItem ? (
              <div className="w-40 rotate-3">
                <ItemCard item={activeItem} size="compact" />
              </div>
            ) : null}
          </DragOverlay>
        </ActiveDragProvider>
      </DndContext>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-paper border-2 border-ink bg-stone-700 px-4 py-2 font-body text-sm text-primary shadow-ink">
          {toast}
        </div>
      )}
    </div>
  );
}
