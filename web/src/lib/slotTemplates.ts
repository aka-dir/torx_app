import type { InventorySlot } from "@/lib/inventoryClassify";

/** Zelfde id’s als {@link modelLabelToSlotId}; zichtbare labels met Exterieur / Interieur. */
const SLOT_COLORS: Record<string, string> = {
  outside_front_3_4: "hsl(24 95% 90%)",
  outside_front_straight: "hsl(24 80% 88%)",
  outside_side_left: "hsl(200 80% 90%)",
  outside_side_right: "hsl(200 60% 88%)",
  outside_rear_3_4: "hsl(142 60% 88%)",
  outside_rear_straight: "hsl(142 50% 85%)",
  inside_dashboard: "hsl(270 50% 90%)",
  inside_steering_wheel: "hsl(270 40% 88%)",
  inside_front_seats: "hsl(38 90% 88%)",
  inside_back_seats: "hsl(340 60% 90%)",
  inside_trunk: "hsl(340 40% 88%)",
  detail_wheels: "hsl(180 50% 88%)",
};

/** Zichtbare labels: Exterieur / Interieur + gangbare shotnamen. */
const LABEL_NL: Record<string, string> = {
  outside_front_3_4: "Exterieur – Voor 3/4",
  outside_front_straight: "Exterieur – Vooraanzicht",
  outside_side_left: "Exterieur – Linkerzijkant",
  outside_side_right: "Exterieur – Rechterzijkant",
  outside_rear_3_4: "Exterieur – Achter 3/4",
  outside_rear_straight: "Exterieur – Achteraanzicht",
  inside_dashboard: "Interieur – Dashboard",
  inside_steering_wheel: "Interieur – Stuur",
  inside_front_seats: "Interieur – Voorstoelen",
  inside_back_seats: "Interieur – Achterbank",
  inside_trunk: "Interieur – Kofferbak",
  detail_wheels: "Detail – Velgen",
};

const ORDER: readonly string[] = [
  "outside_front_3_4",
  "outside_front_straight",
  "outside_side_left",
  "outside_side_right",
  "outside_rear_3_4",
  "outside_rear_straight",
  "inside_dashboard",
  "inside_steering_wheel",
  "inside_front_seats",
  "inside_back_seats",
  "inside_trunk",
  "detail_wheels",
];

/** Vaste 12-slot sjabloon (Exterieur · Interieur), voor import-API-mapping. */
export function emptySlotsNl(): InventorySlot[] {
  return ORDER.map((id) => ({
    id,
    label: LABEL_NL[id] ?? id,
    color: SLOT_COLORS[id] ?? "hsl(0 0% 92%)",
    files: [],
  }));
}

/** 1–12 vaste volgorde; null voor handmatige of onbekende id’s. */
export function fixedSlotOrdinal(slotId: string): number | null {
  const i = ORDER.indexOf(slotId);
  return i === -1 ? null : i + 1;
}

export function groupRowSlotId(apiLabel: string): string {
  return `g:${apiLabel}`;
}

export function parseGroupRowSlotId(id: string): string | null {
  return id.startsWith("g:") ? id.slice(2) : null;
}
