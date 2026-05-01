import type { ClassifyItem } from "@/lib/inventoryClassify";

/** First-seen slot ids from an ordered classify result (e.g. PDF pages 1..n). */
export function slotIdsInClassifyOrder(items: ClassifyItem[], modelLabelToSlotId: (label: string) => string | null): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.ok) continue;
    const sid = modelLabelToSlotId((it.label || "").trim());
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    order.push(sid);
  }
  return order;
}
