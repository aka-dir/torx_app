import { emptySlotsNl } from "@/lib/slotTemplates";
import { authFetch } from "@/lib/auth";

/** UI slot row (Image Sorter grid). */
export interface InventorySlot {
  id: string;
  label: string;
  color: string;
  /** All filenames assigned to this slot (same coarse label can stack). */
  files: string[];
  /** Alleen groepsweergave: korte NL-hint welk vaste slot bij dit API-label hoort. */
  slotHint?: string | null;
}

export interface InventoryUnclassified {
  name: string;
  reason: string;
  color: string;
}

export type ClassifyItem = {
  file: string;
  ok: boolean;
  label?: string;
  /** Make/model (free text) from classify API when the model returns a VEHICLE: line. */
  vehicle?: string;
  error?: string;
  stage?: string;
  /** Set when dedupe copied label from cluster representative (no extra Gemini call). */
  phash_dup_of?: string;
};

/**
 * Voertuig-string per bestandsnaam (uit API `vehicle`), voor ZIP-voorvoegsel.
 * Ook bij `ok: false` als het antwoord tóch een VEHICLE-regel had (zeldzaam).
 */
export function buildFileVehicleByFileName(items: ClassifyItem[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const it of items) {
    if (!it.file) continue;
    const v = (it.vehicle || "").trim();
    if (!v) continue;
    const low = v.toLowerCase();
    if (low === "unknown" || low === "onbekend" || low === "n/a" || low === "n.v.t.") continue;
    m[it.file] = v;
  }
  return m;
}

/** Meest voorkomende niet-lege `vehicle` onder geslaagde items (sessie-notitie). */
export function sessionVehicleNoteFromItems(items: ClassifyItem[]): string {
  const counts = new Map<string, number>();
  for (const it of items) {
    if (!it.file) continue;
    const v = (it.vehicle || "").trim();
    if (!v) continue;
    const low = v.toLowerCase();
    if (low === "unknown" || low === "onbekend" || low === "n/a" || low === "n.v.t.") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** Derived from API `items` — how many images triggered vision vs pHash copy. */
export type ClassifyApiReport = {
  totalFiles: number;
  geminiInvocations: number;
  dedupeCopies: number;
  prepareFailed: number;
};

export function classifyApiReport(items: ClassifyItem[]): ClassifyApiReport {
  let geminiInvocations = 0;
  let dedupeCopies = 0;
  let prepareFailed = 0;
  for (const it of items) {
    if (!it.ok) {
      if (it.stage === "inference") geminiInvocations++;
      else prepareFailed++;
      continue;
    }
    if (it.phash_dup_of) dedupeCopies++;
    else geminiInvocations++;
  }
  return {
    totalFiles: items.length,
    geminiInvocations,
    dedupeCopies,
    prepareFailed,
  };
}

/** Leeg 12-slot raster (Exterieur / Interieur); zie {@link emptySlotsNl} in `slotTemplates.ts`. */
export function makeEmptySlots(): InventorySlot[] {
  return emptySlotsNl();
}

export function buildResultsFromItems(
  items: ClassifyItem[],
  template: InventorySlot[],
  duplicateFileNames: Set<string> = new Set(),
): { slots: InventorySlot[]; unclassified: InventoryUnclassified[] } {
  const slots = template.map((s) => ({ ...s, files: [] as string[] }));
  const unclassified: InventoryUnclassified[] = [];
  /** A filename can appear in at most one slot; repeats → unclassified. */
  const placedFileNames = new Set<string>();

  for (const it of items) {
    const name = it.file || "unknown";
    // Exact duplicate files are not placed into a slot, even if the model found a label.
    if (duplicateFileNames.has(name)) {
      unclassified.push({
        name,
        reason: "Duplicaat (zelfde inhoud)",
        color: "hsl(180 50% 90%)",
      });
      continue;
    }
    if (!it.ok) {
      unclassified.push({
        name,
        reason:
          [it.stage, it.error].filter(Boolean).join(" — ") || "Fout op de server of bij het voorbereiden van het bestand",
        color: "hsl(45 70% 88%)",
      });
      continue;
    }
    // pHash-kopieën: API zet zelfde label als representant; zelfde vak als groepsweergave (buildLabelGroups).
    const label = (it.label || "").trim();
    const lowLab = label.toLowerCase();
    if (!label || lowLab === "unclassified" || lowLab === "niet_geclassificeerd") {
      unclassified.push({
        name,
        reason: "Niet geclassificeerd door het model.",
        color: "hsl(310 50% 90%)",
      });
      continue;
    }
    const slotId = modelLabelToSlotId(label);
    if (!slotId) {
      unclassified.push({
        name,
        reason: `Geen vaste categorie voor dit model (${dutchTitleForApiLabel(label)}).`,
        color: "hsl(310 50% 90%)",
      });
      continue;
    }
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) continue;

    if (placedFileNames.has(name)) {
      unclassified.push({
        name,
        reason:
          "Deze bestandsnaam bestaat al in een vak. Dubbele invoer blijft daarom hier (niet geclassificeerd).",
        color: "hsl(38 85% 88%)",
      });
      continue;
    }

    slot.files.push(name);
    placedFileNames.add(name);
  }
  return { slots, unclassified };
}

const MANUAL_SLOT_ID_PREFIX = "manual_";

export function isManualInventorySlotId(id: string): boolean {
  return id.startsWith(MANUAL_SLOT_ID_PREFIX);
}

/**
 * Gecategoriseerde weergave → vast raster: vaste twaalf vakken worden gevuld vanuit ``labelGroups``;
 * handmatige vakken blijven zoals in ``currentSlots``. API-labels zonder vaste bucket komen als ``loose``.
 */
export function fixedSlotsAndLooseFromLabelGroups(
  currentSlots: InventorySlot[],
  labelGroups: Array<{ label: string; files: string[]; color: string }>,
): { slots: InventorySlot[]; loose: InventoryUnclassified[] } {
  const manualSlots = currentSlots.filter((s) => isManualInventorySlotId(s.id));
  const fixedTemplate = emptySlotsNl();
  const byId: Record<string, string[]> = Object.fromEntries(fixedTemplate.map((s) => [s.id, [] as string[]]));
  const loose: InventoryUnclassified[] = [];
  for (const g of labelGroups) {
    const sid = modelLabelToSlotId(g.label);
    if (!sid || !(sid in byId)) {
      for (const fn of g.files) {
        loose.push({
          name: fn,
          reason: `Geen vaste categorie voor dit model (${dutchTitleForApiLabel(g.label)}).`,
          color: g.color,
        });
      }
      continue;
    }
    for (const fn of g.files) {
      if (!byId[sid].includes(fn)) byId[sid].push(fn);
    }
  }
  const mergedFixed = fixedTemplate.map((s) => ({ ...s, files: byId[s.id] ?? [] }));
  return { slots: [...mergedFixed, ...manualSlots], loose };
}

/** Eerste lijst wint bij dezelfde ``name`` (stabiele merge voor twee «niet ingedeeld»-bronnen). */
export function mergeInventoryUnclassifiedDedupe(a: InventoryUnclassified[], b: InventoryUnclassified[]): InventoryUnclassified[] {
  const m = new Map<string, InventoryUnclassified>();
  for (const u of a) m.set(u.name, u);
  for (const u of b) {
    if (!m.has(u.name)) m.set(u.name, u);
  }
  return [...m.values()];
}

export const INVENTORY_SORT_STEPS = [
  "Foto’s voorbereiden",
  "Foto’s laten classificeren",
  "Resultaat samenstellen",
];

/**
 * Nederlandse labels uit prompts.yaml → interne Engelse sleutel (zelfde slot-tabel).
 * Oude runs met Engelse labels blijven werken.
 */
const NL_INVENTORY_LABEL_TO_EN: Record<string, string> = {
  exterieur_overzicht: "exterior_overview",
  exterieur_vooraanzicht: "exterior_front",
  exterieur_voor_links_3_4: "exterior_front_left",
  exterieur_voor_rechts_3_4: "exterior_front_right",
  exterieur_zijkant_links: "exterior_side_left",
  exterieur_zijkant_rechts: "exterior_side_right",
  exterieur_achteraanzicht: "exterior_rear",
  exterieur_achter_links_3_4: "exterior_rear_left",
  exterieur_achter_rechts_3_4: "exterior_rear_right",
  exterieur_wiel: "exterior_wheel",
  exterieur_koplamp: "exterior_headlight",
  exterieur_achterlicht: "exterior_taillight",
  exterieur_mistlamp: "exterior_fog_light",
  exterieur_verlichting: "exterior_light",
  exterieur_embleem: "exterior_badge",
  exterieur_oplaadpunt: "exterior_charging_port",
  exterieur_detail: "exterior_detail",
  exterieur_hoofdbeeld: "exterior_hero",
  exterieur_bovenaanzicht: "exterior_top_view",
  exterieur_lage_camphoek: "exterior_low_angle",
  exterieur_hoge_camphoek: "exterior_high_angle",
  exterieur_wiel_close_up: "exterior_wheel_close",
  exterieur_band: "exterior_tire",
  exterieur_logo_close_up: "exterior_logo_close",
  exterieur_buitenspiegel: "exterior_mirror",
  exterieur_deurgreep: "exterior_door_handle",
  exterieur_dak: "exterior_roof",
  exterieur_dak_detail: "exterior_roof_detail",
  exterieur_schuifdak_open: "exterior_sunroof_open",
  exterieur_deuren_open: "exterior_doors_open",
  exterieur_voordeur_open: "exterior_front_door_open",
  exterieur_achterdeur_open: "exterior_rear_door_open",
  motorcompartiment_open: "engine_bay_open",
  motorcompartiment_detail: "engine_bay_detail",
  motorafdekking: "engine_cover",
  kofferbak_open: "trunk_open",
  kofferbak_onderverdiep_open: "trunk_lower_compartment_open",
  kofferbak_gesloten: "trunk_closed",
  kofferbak_detail: "trunk_detail",
  kofferbak_volume_demo: "trunk_capacity_demo",
  kofferbak_met_bagage: "trunk_luggage_loaded",
  interieur_voorstoelen: "interior_frontrow",
  interieur_bijrijdersstoel: "interior_passenger_seat",
  interieur_achterbank: "interior_rearrow",
  interieur_dashboard: "interior_dashboard",
  interieur_hoofdscherm: "interior_screen_main",
  interieur_instrumentenschaal: "interior_screen_cluster",
  interieur_hud: "interior_screen_hud",
  interieur_scherm_achter: "interior_screen_rear",
  interieur_klimaatscherm: "interior_screen_climate",
  interieur_bediening: "interior_controls",
  interieur_stuurwiel_cluster: "interior_steering_cluster",
  interieur_stoelen: "interior_seats",
  interieur_deurpaneel: "interior_door_panel",
  interieur_middenconsole: "interior_console",
  interieur_schuifdak: "interior_sunroof_top",
  interieur_binnenspiegel: "interior_mirror",
  interieur_zicht_bestuurder: "interior_driver_view",
  interieur_beenruimte_voor: "interior_legroom_front",
  interieur_beenruimte_achter: "interior_legroom_rear",
  interieur_navigatie: "interior_navigation_screen",
  interieur_digitale_cockpit: "interior_digital_cockpit",
  interieur_pook: "interior_gear_selector",
  interieur_ambient_verlichting: "interior_ambient_lighting",
  interieur_stiksel_detail: "interior_stitching_detail",
  autosleutel: "car_key_fob",
  parkeercamera: "parking_camera",
  audiosysteem: "audio_system",
  niet_geclassificeerd: "unclassified",
};

/**
 * Maps inventory-photo-kit model labels (Nederlands of Engels, prompts.yaml)
 * to ImageSorter slot ids (12 vaste NL-buckets).
 */
export function modelLabelToSlotId(label: string): string | null {
  const l = (label || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!l || l === "unclassified" || l === "niet_geclassificeerd") return null;

  const exact: Record<string, string> = {
    // Exterieur — voor / 3-4
    exterior_overview: "outside_front_3_4",
    exterior_front_left: "outside_front_3_4",
    exterior_front_right: "outside_front_3_4",
    exterior_hero: "outside_front_3_4",
    exterior_low_angle: "outside_front_3_4",
    exterior_high_angle: "outside_front_3_4",
    exterior_top_view: "outside_front_3_4",
    exterior_light: "outside_front_3_4",
    exterior_badge: "outside_front_3_4",
    exterior_charging_port: "outside_front_3_4",
    exterior_detail: "outside_front_3_4",
    exterior_logo_close: "outside_front_3_4",
    exterior_mirror: "outside_front_3_4",
    exterior_door_handle: "outside_front_3_4",
    exterior_roof: "outside_front_3_4",
    exterior_roof_detail: "outside_front_3_4",
    exterior_sunroof_open: "outside_front_3_4",
    exterior_doors_open: "outside_front_3_4",
    exterior_front_door_open: "outside_front_3_4",
    exterior_rear_door_open: "outside_rear_3_4",
    // Exterieur — frontaal / motorkap
    exterior_front: "outside_front_straight",
    exterior_headlight: "outside_front_straight",
    exterior_fog_light: "outside_front_straight",
    engine_bay_open: "outside_front_straight",
    engine_bay_detail: "outside_front_straight",
    engine_cover: "outside_front_straight",
    // Zijkanten
    exterior_side_left: "outside_side_left",
    exterior_side_right: "outside_side_right",
    // Achter
    exterior_rear: "outside_rear_straight",
    exterior_taillight: "outside_rear_straight",
    trunk_closed: "outside_rear_straight",
    exterior_rear_left: "outside_rear_3_4",
    exterior_rear_right: "outside_rear_3_4",
    // Velgen
    exterior_wheel: "detail_wheels",
    exterior_wheel_close: "detail_wheels",
    exterior_tire: "detail_wheels",
    // Kofferbak (open / inhoud)
    trunk_open: "inside_trunk",
    trunk_lower_compartment_open: "inside_trunk",
    trunk_detail: "inside_trunk",
    trunk_capacity_demo: "inside_trunk",
    trunk_luggage_loaded: "inside_trunk",
    // Interieur — dashboard / schermen
    interior_dashboard: "inside_dashboard",
    interior_screen_main: "inside_dashboard",
    interior_screen_cluster: "inside_dashboard",
    interior_screen_hud: "inside_dashboard",
    interior_screen_climate: "inside_dashboard",
    interior_navigation_screen: "inside_dashboard",
    interior_digital_cockpit: "inside_dashboard",
    interior_mirror: "inside_dashboard",
    interior_ambient_lighting: "inside_dashboard",
    car_key_fob: "inside_dashboard",
    parking_camera: "inside_dashboard",
    audio_system: "inside_dashboard",
    // Stuur / bediening
    interior_steering_cluster: "inside_steering_wheel",
    interior_controls: "inside_steering_wheel",
    interior_gear_selector: "inside_steering_wheel",
    // Voor stoelen / ruimte
    interior_frontrow: "inside_front_seats",
    interior_passenger_seat: "inside_front_seats",
    interior_seats: "inside_front_seats",
    interior_legroom_front: "inside_front_seats",
    interior_driver_view: "inside_front_seats",
    interior_door_panel: "inside_front_seats",
    interior_console: "inside_front_seats",
    interior_sunroof_top: "inside_front_seats",
    interior_stitching_detail: "inside_front_seats",
    // Achterbank
    interior_rearrow: "inside_back_seats",
    interior_screen_rear: "inside_back_seats",
    interior_legroom_rear: "inside_back_seats",
  };

  const enKey = NL_INVENTORY_LABEL_TO_EN[l] ?? l;
  if (exact[enKey]) return exact[enKey];
  if (exact[l]) return exact[l];

  if (l.startsWith("kofferbak_") || l.startsWith("trunk_")) return "inside_trunk";
  if (l.startsWith("motorcompartiment_") || l.startsWith("motorafdekking") || l.startsWith("engine_")) {
    return "outside_front_straight";
  }

  if (l.startsWith("interieur_") || l.startsWith("interior_")) {
    if (
      l.includes("rearrow") ||
      l.includes("legroom_rear") ||
      l.includes("screen_rear") ||
      l.includes("achterbank") ||
      l.includes("beenruimte_achter") ||
      l.includes("scherm_achter")
    ) {
      return "inside_back_seats";
    }
    if (
      l.includes("dashboard") ||
      l.includes("screen") ||
      l.includes("scherm") ||
      l.includes("hud") ||
      l.includes("climate") ||
      l.includes("klimaat") ||
      l.includes("navigatie")
    ) {
      return "inside_dashboard";
    }
    if (l.includes("steering") || l.includes("cluster") || l.includes("gear") || l.includes("stuur") || l.includes("pook")) {
      return "inside_steering_wheel";
    }
    return "inside_front_seats";
  }

  if (l.startsWith("exterieur_") || l.startsWith("exterior_")) {
    if (l.includes("rear") || l.includes("achter")) {
      if (l.includes("left") || l.includes("links") || l.includes("right") || l.includes("rechts")) return "outside_rear_3_4";
      return "outside_rear_straight";
    }
    if (l.includes("side_left") || l.includes("zijkant_links")) return "outside_side_left";
    if (l.includes("side_right") || l.includes("zijkant_rechts")) return "outside_side_right";
    if (l.includes("wheel") || l.includes("tire") || l.includes("wiel") || l.includes("band")) return "detail_wheels";
    if (l.includes("front") || l.includes("vooraanzicht")) return "outside_front_straight";
    return "outside_front_3_4";
  }

  return null;
}

/**
 * Woorddelen uit Engels API-label (snake_case) → leesbare NL-termen als er geen vaste categorie is.
 */
const API_LABEL_TOKEN_NL: Record<string, string> = {
  exterior: "exterieur",
  interior: "interieur",
  overview: "overzicht",
  hero: "hoofdbeeld",
  front: "voor",
  rear: "achter",
  left: "links",
  right: "rechts",
  side: "zijkant",
  straight: "frontaal",
  low: "laag",
  angle: "hoek",
  high: "hoog",
  top: "boven",
  view: "aanzicht",
  badge: "embleem",
  charging: "oplaad",
  port: "klep",
  detail: "detail",
  logo: "logo",
  close: "close-up",
  mirror: "spiegel",
  door: "deur",
  doors: "deuren",
  handle: "greep",
  roof: "dak",
  sunroof: "schuifdak",
  open: "open",
  headlight: "koplamp",
  fog: "mist",
  light: "licht",
  taillight: "achterlicht",
  wheel: "velg",
  wheels: "velgen",
  tire: "band",
  trunk: "kofferbak",
  closed: "gesloten",
  lower: "onder",
  compartment: "ruimte",
  capacity: "inhoud",
  luggage: "bagage",
  loaded: "geladen",
  demo: "voorbeeld",
  engine: "motor",
  bay: "ruimte",
  cover: "afdekking",
  dashboard: "dashboard",
  screen: "scherm",
  main: "hoofd",
  cluster: "tellergroep",
  hud: "HUD",
  climate: "klimaat",
  navigation: "navigatie",
  digital: "digitaal",
  cockpit: "cockpit",
  ambient: "sfeer",
  lighting: "verlichting",
  car: "auto",
  key: "sleutel",
  fob: "afstandsbediening",
  parking: "parkeer",
  camera: "camera",
  audio: "audio",
  system: "systeem",
  steering: "stuur",
  controls: "bediening",
  gear: "versnellings",
  selector: "hendel",
  frontrow: "voorste rij",
  passenger: "bijrijder",
  seats: "stoelen",
  seat: "stoel",
  legroom: "beenruimte",
  driver: "bestuurder",
  panel: "paneel",
  console: "middenconsole",
  stitching: "stiksel",
  rearrow: "achterbank",
  row: "rij",
};

function normalizeApiLabelKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Unieke NL-titel per ruwe API-sleutel (woord-voor-woord); handig als meerdere labels dezelfde vaste categorie delen. */
export function dutchPhraseFromSnakeCaseApiLabel(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const parts = normalized.split("_").filter(Boolean);
  if (parts.length === 0) return "Onbekend label";
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i] === "3" && parts[i + 1] === "4") {
      out.push("3/4");
      i += 2;
      continue;
    }
    const p = parts[i];
    out.push(API_LABEL_TOKEN_NL[p] ?? p);
    i += 1;
  }
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Kolomtitel in groepsweergave: canonieke categorie, of «categorie · korte onderscheider»
 * (zonder exterieur/interieur in elke titel te herhalen).
 */
export function labelGroupGridTitle(groupLabel: string, allGroupLabels: readonly string[]): string {
  const canonical = dutchTitleForApiLabel(groupLabel);
  const peers = allGroupLabels.filter((l) => dutchTitleForApiLabel(l) === canonical);
  if (peers.length <= 1) return canonical;

  const snakes = [...new Set(peers.map((l) => normalizeApiLabelKey(l)))].sort();
  let lcp = snakes[0] ?? "";
  for (const s of snakes.slice(1)) {
    let i = 0;
    while (i < lcp.length && i < s.length && lcp.charCodeAt(i) === s.charCodeAt(i)) i++;
    lcp = lcp.slice(0, i);
  }
  const u = lcp.lastIndexOf("_");
  const prefix = u >= 0 ? lcp.slice(0, u + 1) : "";

  let rest = normalizeApiLabelKey(groupLabel);
  if (prefix && rest.startsWith(prefix)) rest = rest.slice(prefix.length);
  rest = rest.replace(/^_+/, "");

  if (!rest) {
    return `${canonical} · ${normalizeApiLabelKey(groupLabel).replace(/_/g, " ")}`;
  }
  return `${canonical} · ${dutchPhraseFromSnakeCaseApiLabel(rest)}`;
}

/**
 * Vak-/categorie-label voor UI en ZIP (Exterieur / Interieur, kofferbak e.d.),
 * op basis van het ruwe classificatielabel (Nederlands of Engels).
 */
export function dutchTitleForApiLabel(apiLabel: string): string {
  const raw = (apiLabel || "").trim();
  const low = raw.toLowerCase();
  if (!raw || low === "unclassified" || low === "niet_geclassificeerd") return "Niet geclassificeerd";
  const sid = modelLabelToSlotId(raw);
  if (sid) {
    const slot = emptySlotsNl().find((s) => s.id === sid);
    if (slot) return slot.label;
  }
  return dutchPhraseFromSnakeCaseApiLabel(raw);
}

export function extractClassifyItems(data: unknown): ClassifyItem[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (o.mode === "chunked" && o.merged && typeof o.merged === "object") {
    const merged = o.merged as { items?: unknown };
    if (Array.isArray(merged.items)) return merged.items as ClassifyItem[];
  }
  if (Array.isArray(o.items)) return o.items as ClassifyItem[];
  return [];
}

/**
 * Same-origin API base by default (Cloud Run serves SPA + API together).
 * Dev: leave empty and use Vite proxy (vite.config.ts → 127.0.0.1:8087), or set
 * VITE_CLASSIFY_API_URL=http://127.0.0.1:8087 if the proxy target port changes.
 */
export function classifyApiUrl(): string {
  const v = (import.meta.env.VITE_CLASSIFY_API_URL as string | undefined)?.trim();
  return v || "";
}

export async function postClassify(files: File[], chunkSize: number, dedupe = false): Promise<unknown> {
  const base = classifyApiUrl().replace(/\/$/, "");
  const fd = new FormData();
  for (const f of files) fd.append("files", f, f.name);
  const q = `?chunk_size=${encodeURIComponent(String(chunkSize))}&dedupe=${dedupe ? "1" : "0"}`;
  const res = await authFetch(`${base}/api/classify${q}`, { method: "POST", body: fd });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Bad JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err = (json as { detail?: string })?.detail || text.slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return json;
}

export async function completeRun(runId: string): Promise<void> {
  const base = classifyApiUrl().replace(/\/$/, "");
  await authFetch(`${base}/api/runs/${encodeURIComponent(runId)}/complete`, { method: "POST" });
}
