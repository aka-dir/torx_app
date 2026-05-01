import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { InventorySlot, InventoryUnclassified } from "@/lib/inventoryClassify";
import type { LabelGroup } from "@/features/inventory-product";

export type ResultsLayoutMode = "fixed" | "groups";

/** Gedeelde sort-resultaat (interactief op /sorter en /slots). */
export type SorterDoneSession = {
  resultsLayout: ResultsLayoutMode;
  slots: InventorySlot[];
  unclassified: InventoryUnclassified[];
  labelGroups: LabelGroup[];
  groupsUnclassified: InventoryUnclassified[];
  files: File[];
  /** API-ingeschat voertuig (make/model) per oorspronkelijke bestandsnaam — o.a. ZIP-voorvoegsel. */
  fileModelLabels?: Record<string, string>;
  /** Eerste classificatie-label per bestand (Engels snake_case) — verandert niet als je het vak wijzigt. */
  fileClassifyLabels?: Record<string, string>;
  exportNames: Record<string, string>;
  /** Alleen `true` na expliciet toepassen van «Alleen voorvoegsel» of «Voorvoegsel + modelnamen»; anders originele namen. */
  zipUseSuggestedNames?: boolean;
  /** Welk voorgesteld patroon actief is; `exportNames` bevat dan alleen handmatige correcties bovenop de herberekende basis. */
  zipSuggestedKind?: "prefix" | "category" | null;
  zipNameStamp: string;
  /** Indien ingevuld door de classificatie-API: gebruikt o.a. voor voorgestelde exportnamen; geen handmatig veld in de UI. */
  vehicleNote?: string;
  runSeconds: number | null;
  compactLayout: boolean;
  inspectSlotId: string | null;
  inspectSlotFocusFile: string | null;
  inspectUnclassifiedFile: string | null;
};

type Ctx = {
  doneSession: SorterDoneSession | null;
  setDoneSession: Dispatch<SetStateAction<SorterDoneSession | null>>;
  /** Laatste voltooide run die op Bewerkt (/slots) blijft staan als je op de sorter een nieuwe batch start. */
  vakkenArchive: SorterDoneSession | null;
  setVakkenArchive: Dispatch<SetStateAction<SorterDoneSession | null>>;
};

const SorterSessionContext = createContext<Ctx | null>(null);

export function SorterSessionProvider({ children }: { children: ReactNode }) {
  const [doneSession, setDoneSession] = useState<SorterDoneSession | null>(null);
  const [vakkenArchive, setVakkenArchive] = useState<SorterDoneSession | null>(null);
  const value = useMemo(
    () => ({ doneSession, setDoneSession, vakkenArchive, setVakkenArchive }),
    [doneSession, vakkenArchive],
  );
  return <SorterSessionContext.Provider value={value}>{children}</SorterSessionContext.Provider>;
}

export function useSorterSession(): Ctx {
  const c = useContext(SorterSessionContext);
  if (!c) throw new Error("useSorterSession must be used within SorterSessionProvider");
  return c;
}
