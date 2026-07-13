"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { InventoryItem } from "@/game/types";

const ELEMENT_COLORS: Record<string, string> = {
  none: "text-slate-400",
  fire: "text-orange-400",
  ice: "text-cyan-300",
  water: "text-blue-300",
  grass: "text-green-400",
};

function elementColor(element: string): string {
  return ELEMENT_COLORS[element] ?? "text-fuchsia-300";
}

interface ItemCardProps {
  item: InventoryItem;
  // `overlay` renders a static card (used inside DragOverlay) with no dnd hooks.
  overlay?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export default function ItemCard({ item, overlay = false, selected = false, onSelect }: ItemCardProps) {
  if (overlay) {
    return <CardBody item={item} dragging />;
  }
  return <DraggableCard item={item} selected={selected} onSelect={onSelect} />;
}

function DraggableCard({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItem;
  selected?: boolean;
  onSelect?: () => void;
}) {
  // A card is BOTH draggable (you pick it up) and droppable (you drop another
  // card onto it to craft). We share the same id and merge the two refs.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: item.id, data: { item } });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: item.id,
    data: { item },
  });

  const ref = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  // A plain click (no drag past the sensor's activation distance) selects this
  // item as the battle weapon; dragging past the threshold triggers a craft.
  return (
    <div ref={ref} {...listeners} {...attributes} onClick={onSelect} className="touch-none">
      <CardBody item={item} isOver={isOver} dragging={isDragging} selected={selected} />
    </div>
  );
}

function CardBody({
  item,
  isOver = false,
  dragging = false,
  selected = false,
}: {
  item: InventoryItem;
  isOver?: boolean;
  dragging?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={[
        "select-none rounded-xl border bg-slate-900/80 p-3 shadow-lg transition",
        "cursor-grab active:cursor-grabbing",
        selected
          ? "border-amber-400 ring-2 ring-amber-400/70"
          : isOver
            ? "border-emerald-400 ring-2 ring-emerald-400/60"
            : "border-slate-700 hover:border-slate-500",
        dragging ? "opacity-50" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{item.glyph}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{item.name}</div>
          <div className={`text-[11px] uppercase tracking-wide ${elementColor(item.element)}`}>
            {item.element} · {item.kind}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {selected && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              weapon
            </span>
          )}
          {item.quantity > 1 && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
              ×{item.quantity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] text-slate-300">
        <Stat icon="❤️" value={item.stats.health} />
        <Stat icon="⚔️" value={item.stats.attack} />
        <Stat icon="🛡️" value={item.stats.defense} />
        <Stat icon="🍀" value={item.stats.luck} />
      </div>
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: number }) {
  return (
    <div className="rounded bg-slate-800/70 py-0.5">
      <div>{icon}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
