/** PDF (or any ordered hint) → slot column order in the results grid. */

export function reorderSlotsByPriority<T extends { id: string }>(template: T[], prioritySlotIds: string[]): T[] {
  const byId = new Map(template.map((s) => [s.id, s]));
  const out: T[] = [];
  const used = new Set<string>();
  for (const id of prioritySlotIds) {
    const row = byId.get(id);
    if (row && !used.has(id)) {
      out.push(row);
      used.add(id);
    }
  }
  for (const s of template) {
    if (!used.has(s.id)) out.push(s);
  }
  return out;
}
