import JSZip from "jszip";
import type { InventorySlot, InventoryUnclassified } from "@/lib/inventoryClassify";
import { dutchTitleForApiLabel } from "@/lib/inventoryClassify";
import type { LabelGroup } from "@/features/inventory-product";

function isManualSlotId(id: string): boolean {
  return id.startsWith("manual_");
}

/** Unieke map onder labels/ — zelfde naam mag niet twee keer voorkomen (bv. twee handmatige labels «Extra»). */
function uniqueLabelsFolder(used: Set<string>, baseRaw: string): string {
  const base = safePathSegment(baseRaw) || "label";
  let candidate = `labels/${base}`;
  let n = 0;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `labels/${base}_${n}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Bestands- en mapnamen: verboden tekens weg; spaties en streepjes → één underscore (geen `Interieur_–_Stuur`). */
export function safePathSegment(s: string): string {
  const t = s
    .replace(/[/\\?*:|"<>]+/g, "_")
    .replace(/[\u2013\u2014\u2212]/g, "_")
    .replace(/[\s\u00A0\u202F\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
  return (t.slice(0, 96) || "item").replace(/_+$/, "") || "item";
}

/** ZIP-entry naam: verboden tekens eruit, stam ingekort; extensie blijft intact (anders breekt safePathSegment op de hele string inclusief `.jpg`). */
export function safeZipFileName(raw: string): string {
  const trimmed = raw.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) {
    return safePathSegment(trimmed);
  }
  const stemRaw = trimmed.slice(0, dot);
  const ext = trimmed.slice(dot).replace(/[/\\?*:|"<>]+/g, "");
  const stem = safePathSegment(stemRaw.replace(/[/\\?*:|"<>]+/g, "_"));
  return `${stem}${ext}`;
}

/** Gecategoriseerde kolommen in export (classificatielabels + handmatige mappen) — map `gecategoriseerd/`. */
function uniqueGecategoriseerdFolder(used: Set<string>, baseRaw: string): string {
  const base = safePathSegment(baseRaw);
  let candidate = `gecategoriseerd/${base}`;
  let n = 0;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `gecategoriseerd/${base}_${n}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Build a deterministic ZIP structure from the current browser session.
 *
 * Goal: keep category folders stable and put "unclassified" files in a predictable place,
 * so downstream tooling (e.g. upload pipelines) can rely on paths.
 */
export async function downloadSortedZip(params: {
  mode: "slots" | "groups";
  slots: InventorySlot[];
  groups: LabelGroup[] | null;
  /** Bij gecategoriseerde weergave: handmatige labels — zelfde mapstructuur als andere categorie-mappen. */
  manualSlots?: InventorySlot[];
  /**
   * Bij gecategoriseerde weergave: volledige sessie-slots (vast raster). Bestanden die nog in vaste labels staan
   * maar niet in labelGroups zitten (bv. na bewerken in vast raster) worden alsnog onder labels/ gezet.
   */
  groupOrphanSlots?: InventorySlot[];
  unclassified: InventoryUnclassified[];
  files: File[];
  /**
   * Eerste modelclassificatie-label per bestand (Engels snake_case) — gebruikt om «niet ingedeeld»
   * downloads onder de juiste categorie-map te plaatsen.
   */
  apiClassifyLabelByFileName?: Record<string, string>;
  /** Map browser bestandsnaam → gewenste naam in ZIP (uniek per bestand). */
  exportNames?: Record<string, string>;
}): Promise<void> {
  const zip = new JSZip();
  const byName = new Map<string, File>();
  for (const f of params.files) {
    byName.set(f.name, f);
  }

  const zipBase = (original: string) =>
    safeZipFileName(params.exportNames?.[original] ?? original);

  // Add the original File bytes (no re-encoding) for a bit-identical export.
  const addFileToZip = (zipPath: string, filename: string) => {
    const file = byName.get(filename);
    if (file) {
      // Geen opnieuw encoderen: zelfde bytes als de gekozen `File`. STORE = geen deflate op de entry
      // (JPEG/PNG blijven bit-identiek na uitpakken).
      zip.file(zipPath, file, { compression: "STORE" });
    } else {
      zip.file(`${zipPath}.MISSING.txt`, `Niet gevonden in browsersessie: ${filename}`);
    }
  };

  // Raw model label (English snake_case) captured at classification time.
  const apiLabelFor = (fileName: string): string => {
    const raw = (params.apiClassifyLabelByFileName?.[fileName] || "").trim();
    return raw;
  };

  // Treat missing/explicit "unclassified" labels as "no category".
  const isModelUnclassifiedLabel = (raw: string): boolean => {
    const low = raw.trim().toLowerCase();
    return !raw || low === "unclassified" || low === "niet_geclassificeerd";
  };

  // --- Classified files ---
  // `slots` mode: fixed 12-slot UI → `labels/<slot>/...`
  // `groups` mode: model label columns → `gecategoriseerd/<column>/...` (+ optional `labels/...` orphans)
  let slotLabelToFolder = new Map<string, string>();
  let apiLabelToGroupFolder = new Map<string, string>();

  if (params.mode === "slots") {
    const usedLabels = new Set<string>();
    slotLabelToFolder = new Map<string, string>();

    for (const s of params.slots) {
      if (s.files.length === 0) continue;
      const labelForFolder = s.label.trim() || (isManualSlotId(s.id) ? "Handmatig label" : safePathSegment(s.id));
      const folder = uniqueLabelsFolder(usedLabels, labelForFolder);
      if (!isManualSlotId(s.id)) {
        slotLabelToFolder.set(labelForFolder, folder);
      }
      for (const fn of s.files) {
        addFileToZip(`${folder}/${zipBase(fn)}`, fn);
      }
    }
  } else if (params.groups) {
    const usedFolders = new Set<string>();
    const placedFiles = new Set<string>();
    apiLabelToGroupFolder = new Map<string, string>();

    for (const g of params.groups) {
      const folder = uniqueGecategoriseerdFolder(usedFolders, g.slotHint ?? dutchTitleForApiLabel(g.label));
      apiLabelToGroupFolder.set(g.label, folder);
      for (const fn of g.files) {
        addFileToZip(`${folder}/${zipBase(fn)}`, fn);
        placedFiles.add(fn);
      }
    }
    for (const s of params.manualSlots ?? []) {
      if (s.files.length === 0) continue;
      const folder = uniqueGecategoriseerdFolder(usedFolders, s.label);
      for (const fn of s.files) {
        addFileToZip(`${folder}/${zipBase(fn)}`, fn);
        placedFiles.add(fn);
      }
    }
    const usedLabelOrphans = new Set<string>();
    for (const s of params.groupOrphanSlots ?? []) {
      if (isManualSlotId(s.id)) continue;
      if (s.files.length === 0) continue;
      const labelForFolder = s.label.trim() || safePathSegment(s.id);
      const folder = uniqueLabelsFolder(usedLabelOrphans, labelForFolder);
      for (const fn of s.files) {
        if (placedFiles.has(fn)) continue;
        addFileToZip(`${folder}/${zipBase(fn)}`, fn);
        placedFiles.add(fn);
      }
    }
  }

  // --- Unclassified files ---
  // Keep "unclassified" predictable:
  // - groups: prefer nesting under the model's category folder when we can infer it
  // - slots: treat UI "Nog niet ingedeeld" as its own export label folder
  if (params.mode === "groups" && params.groups) {
    const usedFoldersForUnclassified = new Set<string>();
    // Seed with existing gecategoriseerd folders so we don't collide if we need to create a new one.
    for (const g of params.groups) {
      const folder = apiLabelToGroupFolder.get(g.label);
      if (folder) usedFoldersForUnclassified.add(folder.toLowerCase());
    }

    const resolveUnclassifiedFolderForGroups = (fileName: string): string => {
      const apiRaw = apiLabelFor(fileName);
      if (!isModelUnclassifiedLabel(apiRaw)) {
        const direct = apiLabelToGroupFolder.get(apiRaw);
        if (direct) return `${direct}/niet_ingedeeld`;
        return `${uniqueGecategoriseerdFolder(usedFoldersForUnclassified, dutchTitleForApiLabel(apiRaw))}/niet_ingedeeld`;
      }
      return "niet_ingedeeld";
    };

    for (const u of params.unclassified) {
      const folder = resolveUnclassifiedFolderForGroups(u.name);
      addFileToZip(`${folder}/${zipBase(u.name)}`, u.name);
    }
  } else if (params.mode === "slots") {
    for (const u of params.unclassified) {
      addFileToZip(`labels/niet_ingedeeld/${zipBase(u.name)}`, u.name);
    }
  } else {
    for (const u of params.unclassified) {
      addFileToZip(`niet_ingedeeld/${zipBase(u.name)}`, u.name);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `torxflow-sorted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

