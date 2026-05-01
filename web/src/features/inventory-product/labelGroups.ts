import {
  dutchTitleForApiLabel,
  type ClassifyItem,
  type InventoryUnclassified,
} from "@/lib/inventoryClassify";

const PALETTE = [
  "hsl(24 95% 90%)",
  "hsl(200 80% 90%)",
  "hsl(142 60% 88%)",
  "hsl(270 50% 90%)",
  "hsl(38 90% 88%)",
  "hsl(340 60% 90%)",
  "hsl(180 50% 88%)",
];

export interface LabelGroup {
  label: string;
  files: string[];
  color: string;
  slotHint: string | null;
}

/** One column per model label (no fixed golden grid). Extras stay in the same column. */
export function buildLabelGroups(items: ClassifyItem[]): { groups: LabelGroup[]; unclassified: InventoryUnclassified[] } {
  const byLabel = new Map<string, string[]>();
  const unclassified: InventoryUnclassified[] = [];

  for (const it of items) {
    const name = it.file || "unknown";
    if (!it.ok) {
      unclassified.push({
        name,
        reason: [it.stage, it.error].filter(Boolean).join(" — ") || "Fout bij verwerken",
        color: "hsl(45 70% 88%)",
      });
      continue;
    }
    const raw = (it.label || "").trim();
    const low = raw.toLowerCase();
    if (!raw || low === "unclassified" || low === "niet_geclassificeerd") {
      unclassified.push({ name, reason: "Niet geclassificeerd door het model.", color: "hsl(310 50% 90%)" });
      continue;
    }
    const list = byLabel.get(raw) ?? [];
    list.push(name);
    byLabel.set(raw, list);
  }

  const labels = [...byLabel.keys()].sort((a, b) => a.localeCompare(b));

  const groups: LabelGroup[] = labels.map((label, i) => {
    return {
      label,
      files: byLabel.get(label)!,
      color: PALETTE[i % PALETTE.length],
      slotHint: dutchTitleForApiLabel(label),
    };
  });

  return { groups, unclassified };
}
