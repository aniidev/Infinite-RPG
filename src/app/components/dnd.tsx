"use client";

import { createContext, useContext } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import ItemCard, { type ItemCardSize } from "./ItemCard";
import type { InventoryItem } from "@/game/types";

// Where a card is being dragged FROM, and the drop TARGETs it can land on.
export type EquipSlot = "weapon" | "armor" | "element";
// "result" is a drag SOURCE only (the freshly crafted item awaiting claim); it
// is never a drop target.
export type DragFrom = "inventory" | EquipSlot | "mixA" | "mixB" | "result";
export type DropTarget = EquipSlot | "mixA" | "mixB" | "inventory" | "trash";

export interface DragData {
  item: InventoryItem;
  from: DragFrom;
}
export interface DropData {
  target: DropTarget;
}

// Unique draggable id per (location, item) so the same item can appear in the
// inventory, an equip slot, and a mix slot at once without id collisions.
export function dragId(from: DragFrom, itemId: string): string {
  return `${from}:${itemId}`;
}
export function dropId(target: DropTarget): string {
  return `drop:${target}`;
}

// The item currently being dragged (for highlighting valid drop targets).
const ActiveDragContext = createContext<InventoryItem | null>(null);
export const ActiveDragProvider = ActiveDragContext.Provider;

// A draggable item card. `onClick` fires for a plain click (used to clear a slot).
export function DraggableCard({
  from,
  item,
  size = "full",
  onClick,
}: {
  from: DragFrom;
  item: InventoryItem;
  size?: ItemCardSize;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(from, item.id),
    data: { item, from } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`touch-none ${isDragging ? "opacity-40" : ""}`}
    >
      <ItemCard item={item} size={size} />
    </div>
  );
}

// A drop target. `accept` decides validity for the item being dragged; the zone
// shows a subtle ring when it would accept, a strong ring on hover, and a red
// cue when hovered by something it rejects.
export function DropZone({
  target,
  accept = () => true,
  className = "",
  children,
}: {
  target: DropTarget;
  accept?: (item: InventoryItem) => boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const activeItem = useContext(ActiveDragContext);
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(target),
    data: { target } satisfies DropData,
  });

  const valid = activeItem ? accept(activeItem) : false;
  const cue = !activeItem
    ? ""
    : isOver && valid
      ? "outline outline-2 outline-moss outline-offset-2"
      : isOver && !valid
        ? "outline outline-2 outline-rust outline-offset-2 animate-shake"
        : valid
          ? "outline outline-1 outline-moss outline-offset-2"
          : "";

  return (
    <div ref={setNodeRef} className={`rounded-paper transition ${cue} ${className}`}>
      {children}
    </div>
  );
}
