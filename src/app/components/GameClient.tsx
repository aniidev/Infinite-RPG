"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import ItemCard from "./ItemCard";
import BattleScreen from "./BattleScreen";
import type { InventoryItem } from "@/game/types";

const PLAYER_KEY = "infinite-rpg-player-id";

interface CraftResult {
  item: InventoryItem;
  discovered: boolean;
  cached: boolean;
}

type Tab = "forge" | "battle";

export default function GameClient() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [tab, setTab] = useState<Tab>("forge");

  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [craftResult, setCraftResult] = useState<CraftResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    // Small activation distance so plain clicks aren't swallowed by dragging.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const refreshInventory = useCallback(async (id: string) => {
    const res = await fetch(`/api/inventory?playerId=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  // Bootstrap: reuse a locally-stored player id, or create one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = localStorage.getItem(PLAYER_KEY);
      if (!id) {
        const res = await fetch("/api/player", { method: "POST" });
        const data = await res.json();
        id = data.player.id as string;
        localStorage.setItem(PLAYER_KEY, id);
      }
      if (cancelled) return;
      setPlayerId(id);
      await refreshInventory(id);
    })().catch(() => setError("Could not start a game session."));
    return () => {
      cancelled = true;
    };
  }, [refreshInventory]);

  // Loosely couple battle power to what you own.
  const playerPower = useMemo(() => {
    const totalAttack = items.reduce((sum, it) => sum + it.stats.attack * it.quantity, 0);
    return 10 + Math.floor(totalAttack / 8);
  }, [items]);

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as InventoryItem | undefined;
    setActiveItem(item ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !playerId) return;
    const aId = String(active.id);
    const bId = String(over.id);
    if (aId === bId) return; // dropped on itself — ignore
    await doCraft(playerId, aId, bId);
  }

  async function doCraft(id: string, aId: string, bId: string) {
    setError(null);
    setCrafting(true);
    try {
      const res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: aId, b: bId, playerId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Crafting failed.");
      setCraftResult(data as CraftResult);
      await refreshInventory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crafting failed.");
    } finally {
      setCrafting(false);
    }
  }

  const handleLoot = useCallback(
    (loot: InventoryItem[]) => {
      const names = loot.map((l) => `${l.glyph} ${l.name}`).join(", ");
      setToast(`Looted: ${names}`);
      if (playerId) void refreshInventory(playerId);
      window.setTimeout(() => setToast(null), 3500);
    },
    [playerId, refreshInventory]
  );

  if (!playerId) {
    return <div className="text-sm text-slate-400">Starting your adventure…</div>;
  }

  return (
    <div>
      <nav className="mb-4 flex gap-2">
        <TabButton active={tab === "forge"} onClick={() => setTab("forge")}>
          Forge &amp; Inventory ({items.length})
        </TabButton>
        <TabButton active={tab === "battle"} onClick={() => setTab("battle")}>
          Battle
        </TabButton>
      </nav>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {tab === "battle" ? (
        <BattleScreen playerId={playerId} playerPower={playerPower} onLoot={handleLoot} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <p className="mb-3 text-sm text-slate-400">
            Drag one item card onto another to combine them.
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No items yet — head to Battle to earn some loot.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <DragOverlay>
            {activeItem ? <ItemCard item={activeItem} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {crafting && <CraftingOverlay activeItem={activeItem} itemById={itemById} />}
      {craftResult && (
        <ResultModal result={craftResult} onClose={() => setCraftResult(null)} />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-slate-100 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CraftingOverlay({
  activeItem,
  itemById,
}: {
  activeItem: InventoryItem | null;
  itemById: Map<string, InventoryItem>;
}) {
  // `activeItem` is cleared on drop, so this is mostly a spinner; still show a
  // hint if we happen to have it.
  void activeItem;
  void itemById;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-8 py-6">
        <div className="text-4xl animate-pulseGlow">⚗️</div>
        <div className="text-sm font-medium">Forging…</div>
        <div className="text-xs text-slate-400">Combining your items</div>
      </div>
    </div>
  );
}

function ResultModal({
  result,
  onClose,
}: {
  result: CraftResult;
  onClose: () => void;
}) {
  const { item, discovered } = result;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {discovered ? "✨ New discovery!" : "Crafted"}
        </div>
        <div className="my-3 text-6xl">{item.glyph}</div>
        <div className="text-lg font-semibold">{item.name}</div>
        <div className="mt-1 text-xs uppercase tracking-wide text-fuchsia-300">
          {item.element} · {item.kind} · depth {item.depth}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs text-slate-300">
          <div className="rounded bg-slate-800 py-1">❤️ {item.stats.health}</div>
          <div className="rounded bg-slate-800 py-1">⚔️ {item.stats.attack}</div>
          <div className="rounded bg-slate-800 py-1">🛡️ {item.stats.defense}</div>
          <div className="rounded bg-slate-800 py-1">🍀 {item.stats.luck}</div>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-slate-100 py-2 font-semibold text-slate-900 hover:bg-white"
        >
          Nice
        </button>
      </div>
    </div>
  );
}
