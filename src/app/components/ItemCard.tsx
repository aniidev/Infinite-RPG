"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { InventoryItem } from "@/game/types";

const ELEMENT_COLORS: Record<string, string> = {
  none: "text-slate-400",
  fire: "text-orange-400",
  ice: "text-cyan-300",
};

function elementColor(element: string): string {
  return ELEMENT_COLORS[element] ?? "text-fuchsia-300";
}

interface ItemCardProps {
  item: InventoryItem;
  // `overlay` renders a static card (used inside DragOverlay) with no dnd hooks.
  overlay?: boolean;
}

export default function ItemCard({ item, overlay = false }: ItemCardProps) {
  if (overlay) {
    return <CardBody item={item} dragging />;
  }
  return <DraggableCard item={item} />;
}

function DraggableCard({ item }: { item: InventoryItem }) {
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

  return (
    <div ref={ref} {...listeners} {...attributes} className="touch-none">
      <CardBody item={item} isOver={isOver} dragging={isDragging} />
    </div>
  );
}

function CardBody({
  item,
  isOver = false,
  dragging = false,
}: {
  item: InventoryItem;
  isOver?: boolean;
  dragging?: boolean;
}) {
  return (
    <div
      className={[
        "select-none rounded-xl border bg-slate-900/80 p-3 shadow-lg transition",
        "cursor-grab active:cursor-grabbing",
        isOver
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
        {item.quantity > 1 && (
          <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
            ×{item.quantity}
          </span>
        )}
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
