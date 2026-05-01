import type { LabelGroup } from "@/features/inventory-product";
import type { InventorySlot, InventoryUnclassified } from "@/lib/inventoryClassify";
import { dutchTitleForApiLabel } from "@/lib/inventoryClassify";
import { safePathSegment } from "@/lib/downloadSortOutput";

function fileExtension(original: string): string {
  const i = original.lastIndexOf(".");
  if (i <= 0 || i === original.length - 1) return ".jpg";
  return original.slice(i);
}

function isManualSlotId(id: string): boolean {
  return id.startsWith("manual_");
}

/** Stam van de oorspronkelijke bestandsnaam (zonder pad), geschikt voor in de ZIP. */
function stemForZipFromOriginal(original: string): string {
  const base = original.includes("/") ? (original.split("/").pop() ?? original) : original;
  const dot = base.lastIndexOf(".");
  const stemPart = dot > 0 ? base.slice(0, dot) : base;
  return safePathSegment(stemPart) || "foto";
}

function zipModelSegment(fileName: string, map?: Record<string, string>): string {
  if (!map) return "";
  const raw = map[fileName]?.trim();
  if (!raw) return "";
  return safePathSegment(raw.replace(/\s+/g, "_")) || "";
}

/** Per-bestand API-voertuig, anders sessie-fallback (`vehicleNote` uit classificatie). */
function vehicleStemForFile(
  fileName: string,
  map: Record<string, string> | undefined,
  sessionFallback?: string,
): string {
  const per = zipModelSegment(fileName, map);
  if (per) return per;
  const v = (sessionFallback || "").trim();
  if (!v) return "";
  const low = v.toLowerCase();
  if (low === "unknown" || low === "onbekend" || low === "n/a" || low === "n.v.t.") return "";
  return safePathSegment(v.replace(/\s+/g, "_")) || "";
}

/** NL-weergavenaam van het modelclassificatielabel → veilige stam (spaties/streepjes → _). */
function dutchStemFromApiClassifyLabel(apiLabel: string): string {
  const t = dutchTitleForApiLabel(apiLabel);
  if (!t || t === "Niet geclassificeerd") return "";
  return safePathSegment(t.replace(/\s+/g, "_")) || "";
}

/** Middenstuk van de exportstam: bij voorkeur Nederlandse categorie uit het modelantwoord, anders vak-fallback. */
function zipCategorySegmentForFile(fileName: string, dutchFallback: string, apiClassifyByFile?: Record<string, string>): string {
  const raw = apiClassifyByFile?.[fileName]?.trim();
  if (raw) {
    const low = raw.toLowerCase();
    if (low !== "unclassified" && low !== "niet_geclassificeerd") {
      const seg = dutchStemFromApiClassifyLabel(raw);
      if (seg) return seg;
    }
  }
  return safePathSegment(dutchFallback) || "vak";
}

/** Handmatige labels: geen map-/etiketnaam in de bestandsstam — alleen voertuig (optioneel), modelcategorie (optioneel), fotostam, volgnummer. */
function stemManualSlotZip(
  _slotLabel: string,
  f: string,
  i: number,
  map?: Record<string, string>,
  sessionVehicle?: string,
  apiClassifyByFile?: Record<string, string>,
): string {
  const m = vehicleStemForFile(f, map, sessionVehicle);
  const apiSeg = (() => {
    const raw = apiClassifyByFile?.[f]?.trim();
    if (!raw) return "";
    const low = raw.toLowerCase();
    if (low === "unclassified" || low === "niet_geclassificeerd") return "";
    return dutchStemFromApiClassifyLabel(raw);
  })();
  const stem = stemForZipFromOriginal(f);
  const n = String(i).padStart(2, "0");
  const parts: string[] = [];
  if (m) parts.push(m);
  if (apiSeg) parts.push(apiSeg);
  parts.push(stem, n);
  return parts.join("_");
}

/**
 * Alle niet-ingedeeld-rijen voor ZIP-builders: na wisselen vast ↔ gecategoriseerd kan hetzelfde bestand in één van beide
 * sessie-arrays zitten; anders mist `processUnclassified` ze en blijft de UI op de ruwe bestandsnaam.
 */
export function unclassifiedRowsForZipExport(
  unclassified: InventoryUnclassified[],
  groupsUnclassified: InventoryUnclassified[],
): InventoryUnclassified[] {
  const byName = new Map<string, InventoryUnclassified>();
  for (const r of unclassified) {
    if (!byName.has(r.name)) byName.set(r.name, r);
  }
  for (const r of groupsUnclassified) {
    byName.set(r.name, r);
  }
  return [...byName.values()];
}

function catWithOptionalModel(
  f: string,
  cat: string,
  i: number,
  map?: Record<string, string>,
  sessionVehicle?: string,
  apiClassifyByFile?: Record<string, string>,
): string {
  const m = vehicleStemForFile(f, map, sessionVehicle);
  const catSeg = zipCategorySegmentForFile(f, cat, apiClassifyByFile);
  const n = String(i).padStart(2, "0");
  return m ? `${m}_${catSeg}_${n}` : `${catSeg}_${n}`;
}

/** «Nog niet ingedeeld»: API-voertuig per bestand of sessie-fallback. */
function nietIngedeeldCategoryStem(
  fileName: string,
  ordinal: number,
  vehicleByFileName?: Record<string, string>,
  sessionVehicle?: string,
  apiClassifyByFile?: Record<string, string>,
): string {
  const n = String(ordinal).padStart(2, "0");
  const veh = vehicleStemForFile(fileName, vehicleByFileName, sessionVehicle);
  const mid = zipCategorySegmentForFile(fileName, "niet_ingedeeld", apiClassifyByFile);
  if (!veh) return `${mid}_${n}`;
  return `${veh}_${mid}_${n}`;
}

export type CategoryZipNameOptions = {
  /** Voorvoegsel op elke gegenereerde ZIP-bestandsnaam (alleen stam; extensie blijft). */
  fileNamePrefix?: string;
  /** Alle `File.name` uit de sessie — ontbrekende krijgen alsnog een naam (voorkomt lege exportNames na volledige replace). */
  allSourceFileNames?: readonly string[];
  /** API `vehicle` (make/model) per bestandsnaam — voorvoegsel in voorgestelde ZIP-namen. */
  modelLabelByFileName?: Record<string, string>;
  /** Meest voorkomende VEHICLE uit de run — als fallback voor bestanden zonder eigen `vehicle`-veld. */
  sessionVehicleNote?: string;
  /** Engels modelclassificatielabel per bestand → wordt in ZIP-stam naar het Nederlandse categorielabel omgezet. */
  apiClassifyLabelByFileName?: Record<string, string>;
};

/**
 * Bouwt ZIP-bestandsnamen op basis van classificatie:
 * - Optioneel voertuig (model) + **Nederlandse categorie** afgeleid van het modelantwoord (anders vaknaam) + volgnummer.
 * - Handmatige vakken / niet ingedeeld: zelfde voertuigvoorvoegsel als gecategoriseerde kolommen (per bestand of sessiefallback).
 */
export function buildCategoryUniqueZipNames(
  layout: "fixed" | "groups",
  slots: InventorySlot[],
  labelGroups: LabelGroup[],
  unclassified: InventoryUnclassified[],
  options?: CategoryZipNameOptions,
): Record<string, string> {
  const prefixRaw = options?.fileNamePrefix?.trim() ?? "";
  const prefixSeg = prefixRaw ? safePathSegment(prefixRaw) : "";

  const used = new Set<string>();
  const out: Record<string, string> = {};
  const assignedFiles = new Set<string>();

  const reserve = (original: string, stem: string) => {
    const ext = fileExtension(original);
    const core = safePathSegment(stem) || "foto";
    const withPrefix = prefixSeg ? `${prefixSeg}_${core}` : core;
    let base = withPrefix;
    let candidate = `${base}${ext}`;
    let n = 1;
    while (used.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${base}_${n}${ext}`;
    }
    used.add(candidate.toLowerCase());
    out[original] = candidate;
    assignedFiles.add(original);
  };

  let uNiet = 0;
  const processUnclassified = () => {
    for (const row of unclassified) {
      if (assignedFiles.has(row.name)) continue;
      uNiet += 1;
      reserve(
        row.name,
        nietIngedeeldCategoryStem(
          row.name,
          uNiet,
          options?.modelLabelByFileName,
          options?.sessionVehicleNote,
          options?.apiClassifyLabelByFileName,
        ),
      );
    }
  };

  if (layout === "fixed") {
    // Handmatige vakken eerst: zo winnen ze t.o.v. dubbele entries in vaste vakken.
    const manualList = slots.filter((s) => isManualSlotId(s.id));
    const fixedList = slots.filter((s) => !isManualSlotId(s.id));
    for (const s of manualList) {
      let i = 0;
      for (const f of s.files) {
        i += 1;
        reserve(
          f,
          stemManualSlotZip(
            s.label,
            f,
            i,
            options?.modelLabelByFileName,
            options?.sessionVehicleNote,
            options?.apiClassifyLabelByFileName,
          ),
        );
      }
    }
    // «Nog niet ingedeeld» vóór vaste vakken: anders blijft een rij in slots staan en krijgt die categorie-naam i.p.v. niet_ingedeeld.
    processUnclassified();
    for (const s of fixedList) {
      const cat = safePathSegment(s.label) || safePathSegment(s.id) || "vak";
      let i = 0;
      for (const f of s.files) {
        if (assignedFiles.has(f)) continue;
        i += 1;
        reserve(
          f,
          catWithOptionalModel(f, cat, i, options?.modelLabelByFileName, options?.sessionVehicleNote, options?.apiClassifyLabelByFileName),
        );
      }
    }
  } else {
    // Zelfde volgorde als vast raster: eerst handmatig (bestemming na slepen), dan gecategoriseerde kolommen.
    // Anders blijft een bestand soms in labelGroups staan én in een handmatig vak → verkeerde categorie-naam.
    const manualOnly = slots.filter((s) => isManualSlotId(s.id));
    for (const s of manualOnly) {
      let i = 0;
      for (const f of s.files) {
        i += 1;
        reserve(
          f,
          stemManualSlotZip(
            s.label,
            f,
            i,
            options?.modelLabelByFileName,
            options?.sessionVehicleNote,
            options?.apiClassifyLabelByFileName,
          ),
        );
      }
    }
    for (const g of labelGroups) {
      const titelNl = (g.slotHint ?? dutchTitleForApiLabel(g.label)).trim();
      const groepStem = safePathSegment(titelNl.replace(/\s+/g, "_")) || "categorie";
      let i = 0;
      for (const f of g.files) {
        if (assignedFiles.has(f)) continue;
        i += 1;
        reserve(
          f,
          catWithOptionalModel(f, groepStem, i, options?.modelLabelByFileName, options?.sessionVehicleNote, options?.apiClassifyLabelByFileName),
        );
      }
    }
    processUnclassified();
    // Vaste vakken als laatste: zo wint «niet ingedeeld» bij dubbele state (rij in slots + in de lijst).
    for (const s of slots) {
      if (isManualSlotId(s.id)) continue;
      const cat = safePathSegment(s.label) || safePathSegment(s.id) || "vak";
      let i = 0;
      for (const f of s.files) {
        if (assignedFiles.has(f)) continue;
        i += 1;
        reserve(
          f,
          catWithOptionalModel(f, cat, i, options?.modelLabelByFileName, options?.sessionVehicleNote, options?.apiClassifyLabelByFileName),
        );
      }
    }
  }

  if (options?.allSourceFileNames?.length) {
    for (const name of new Set(options.allSourceFileNames)) {
      if (!name || out[name]) continue;
      uNiet += 1;
      reserve(
        name,
        nietIngedeeldCategoryStem(
          name,
          uNiet,
          options?.modelLabelByFileName,
          options?.sessionVehicleNote,
          options?.apiClassifyLabelByFileName,
        ),
      );
    }
  }

  return out;
}

/**
 * ZIP names: alleen `voorvoegsel` + originele bestandsstam (+ extensie); geen model- of categorie-labels.
 */
export function buildPrefixOnlyZipNames(
  layout: "fixed" | "groups",
  slots: InventorySlot[],
  labelGroups: LabelGroup[],
  unclassified: InventoryUnclassified[],
  options?: CategoryZipNameOptions,
): Record<string, string> {
  const prefixRaw = options?.fileNamePrefix?.trim() ?? "";
  const prefixSeg = prefixRaw ? safePathSegment(prefixRaw) : "";
  if (!prefixSeg) return {};

  const used = new Set<string>();
  const out: Record<string, string> = {};
  const assignedFiles = new Set<string>();

  const reserve = (original: string) => {
    const ext = fileExtension(original);
    const stem = stemForZipFromOriginal(original);
    const core = `${prefixSeg}_${stem}`;
    let candidate = `${core}${ext}`;
    let n = 1;
    while (used.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${core}_${n}${ext}`;
    }
    used.add(candidate.toLowerCase());
    out[original] = candidate;
    assignedFiles.add(original);
  };

  if (layout === "fixed") {
    const manualList = slots.filter((s) => isManualSlotId(s.id));
    const fixedList = slots.filter((s) => !isManualSlotId(s.id));
    for (const s of manualList) {
      for (const f of s.files) reserve(f);
    }
    for (const row of unclassified) {
      if (assignedFiles.has(row.name)) continue;
      reserve(row.name);
    }
    for (const s of fixedList) {
      for (const f of s.files) {
        if (assignedFiles.has(f)) continue;
        reserve(f);
      }
    }
  } else {
    const manualOnly = slots.filter((s) => isManualSlotId(s.id));
    for (const s of manualOnly) {
      for (const f of s.files) reserve(f);
    }
    for (const g of labelGroups) {
      for (const f of g.files) {
        if (assignedFiles.has(f)) continue;
        reserve(f);
      }
    }
    for (const row of unclassified) {
      if (assignedFiles.has(row.name)) continue;
      reserve(row.name);
    }
    for (const s of slots) {
      if (isManualSlotId(s.id)) continue;
      for (const f of s.files) {
        if (assignedFiles.has(f)) continue;
        reserve(f);
      }
    }
  }

  if (options?.allSourceFileNames?.length) {
    for (const name of new Set(options.allSourceFileNames)) {
      if (!name || out[name]) continue;
      reserve(name);
    }
  }

  return out;
}

/** Minimale sessievelden voor voorgestelde + handmatige ZIP-namen (geen React-context import). */
export type ZipNameSessionInput = {
  resultsLayout: "fixed" | "groups";
  slots: InventorySlot[];
  labelGroups: LabelGroup[];
  unclassified: InventoryUnclassified[];
  groupsUnclassified: InventoryUnclassified[];
  files: readonly { name: string }[];
  fileModelLabels?: Record<string, string>;
  exportNames: Record<string, string>;
  zipNameStamp: string;
  zipUseSuggestedNames?: boolean;
  /** Zonder dit veld (oude sessies): bij `zipUseSuggestedNames` wordt «category» gebruikt. */
  zipSuggestedKind?: "prefix" | "category" | null;
  vehicleNote?: string;
  fileClassifyLabels?: Record<string, string>;
};

/**
 * Map voor download / UI:
 * - `zipUseSuggestedNames: false` → alleen `exportNames` (handmatig) of geen map (= originele namen).
 * - `zipUseSuggestedNames: true` → basis wordt **elke keer** herberekend; `exportNames` zijn alleen correcties (dubbelklik).
 */
export function resolveSessionZipExportNames(s: ZipNameSessionInput): Record<string, string> | undefined {
  const zipUseSuggested = s.zipUseSuggestedNames === true;
  if (!zipUseSuggested) {
    return Object.keys(s.exportNames).length > 0 ? s.exportNames : undefined;
  }
  const unc = unclassifiedRowsForZipExport(s.unclassified, s.groupsUnclassified);
  const layout = s.resultsLayout === "groups" ? "groups" : "fixed";
  const opts = {
    fileNamePrefix: s.zipNameStamp,
    allSourceFileNames: s.files.map((f) => f.name),
    modelLabelByFileName: s.fileModelLabels,
    sessionVehicleNote: s.vehicleNote,
    apiClassifyLabelByFileName: s.fileClassifyLabels,
  };
  const kind = s.zipSuggestedKind ?? "category";
  let base: Record<string, string>;
  if (kind === "prefix") {
    base = buildPrefixOnlyZipNames(layout, s.slots, s.labelGroups, unc, opts);
  } else {
    base = buildCategoryUniqueZipNames(layout, s.slots, s.labelGroups, unc, opts);
  }
  return { ...base, ...s.exportNames };
}
