import { useCallback, useRef, useState, type RefObject } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  buildResultsFromItems,
  buildFileVehicleByFileName,
  sessionVehicleNoteFromItems,
  INVENTORY_SORT_STEPS,
  classifyApiReport,
  type InventorySlot as Slot,
} from "@/lib/inventoryClassify";
import {
  classifyWithFinalRetry,
  collectImagesFromUploadList,
  buildLabelGroups,
} from "@/features/inventory-product";
import { uniquifyFileName } from "@/lib/uniqueFileName";
import { emptySlotsNl } from "@/lib/slotTemplates";
import { cn } from "@/lib/utils";
import { useSorterSession } from "@/context/SorterSessionContext";
import { SorterWorkspaceView } from "@/components/inventory/SorterWorkspaceView";

const MANUAL_SLOT_PREFIX = "manual_" as const;

function isManualSlotId(id: string): boolean {
  return id.startsWith(MANUAL_SLOT_PREFIX);
}

// Browser-side duplicate check used by the older working sorter.
// It catches the exact same photo bytes before the slot assignment step.
async function fingerprintFile(file: File): Promise<string> {
  const slice = file.slice(0, Math.min(file.size, 65536));
  const hash = await crypto.subtle.digest("SHA-256", await slice.arrayBuffer());
  const hex = Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${file.size}:${hex.slice(0, 32)}`;
}

async function duplicateFileNamesByContent(files: File[]): Promise<Set<string>> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const file of files) {
    const fp = await fingerprintFile(file);
    if (seen.has(fp)) {
      duplicates.add(file.name);
      continue;
    }
    seen.add(fp);
  }
  return duplicates;
}

export default function ImageSorter() {
  const { doneSession, setDoneSession, setVakkenArchive } = useSorterSession();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [enhance, setEnhance] = useState(false);
  const [useDedupe, setUseDedupe] = useState(true);
  const [slots, setSlots] = useState<Slot[]>(() => emptySlotsNl());
  const [files, setFiles] = useState<File[]>([]);
  const [chunkSize, setChunkSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showResults = state !== "loading" && Boolean(doneSession?.files.length);

  const startNewSort = useCallback(() => {
    if (doneSession?.files.length) {
      setVakkenArchive(doneSession);
    }
    setDoneSession(null);
    setFiles([]);
    setSlots(emptySlotsNl());
    setState("idle");
    setStepIdx(0);
    toast.info("Nieuwe sorter — voeg foto’s toe om opnieuw te beginnen.");
  }, [doneSession, setDoneSession, setVakkenArchive]);

  const startSort = async () => {
    if (files.length === 0) {
      toast.error("Voeg minstens één foto toe (sleep erheen of kies ze hieronder).");
      return;
    }
    if (doneSession?.files.length) {
      setVakkenArchive(doneSession);
    }
    setDoneSession(null);
    setState("loading");
    const t0 = performance.now();
    const dedupe = useDedupe;
    const slotTemplate = emptySlotsNl();

    try {
      setStepIdx(0);
      setStepIdx(1);
      const items = await classifyWithFinalRetry(files, chunkSize, dedupe);
      if (items.length === 0) {
        toast.error("Geen resultaat van de API — draait de classificatie-server wel?");
      }
      const manualSlots = slots.filter((s) => isManualSlotId(s.id));
      const manualKeep = new Map(manualSlots.map((s) => [s.id, { files: [...s.files], color: s.color }] as const));
      const templateWithManual = [
        ...slotTemplate,
        ...manualSlots.map((s) => ({ ...s, files: [] as string[] })),
      ];
      // Keep exact duplicates out of slots. They go to the unclassified side panel.
      const duplicateNames = await duplicateFileNamesByContent(files);
      const { slots: next, unclassified: unc } = buildResultsFromItems(items, templateWithManual, duplicateNames);
      const merged = next.map((s) => {
        if (!isManualSlotId(s.id)) return s;
        const keep = manualKeep.get(s.id);
        return keep && keep.files.length > 0 ? { ...s, files: keep.files, color: keep.color } : s;
      });
      const lg = buildLabelGroups(items);
      const report = classifyApiReport(items);
      console.log(
        "[TorxFlow] Classify API summary:",
        `${report.totalFiles} bestanden | Gemini: ${report.geminiInvocations} | pHash-kopieën: ${report.dedupeCopies} | voorbereidingsfouten: ${report.prepareFailed}`,
      );
      console.log("[TorxFlow] Classify API report object:", report);
      setDoneSession({
        resultsLayout: "fixed",
        slots: merged,
        unclassified: unc,
        labelGroups: lg.groups,
        groupsUnclassified: lg.unclassified,
        files: [...files],
        fileModelLabels: buildFileVehicleByFileName(items),
        fileClassifyLabels: (() => {
          const m: Record<string, string> = {};
          for (const it of items) {
            if (!it.ok || !it.file) continue;
            const lab = (it.label || "").trim();
            if (lab) m[it.file] = lab;
          }
          return m;
        })(),
        exportNames: {},
        zipUseSuggestedNames: true,
        zipSuggestedKind: "category",
        zipNameStamp: "",
        vehicleNote: sessionVehicleNoteFromItems(items),
        runSeconds: Math.round((performance.now() - t0) / 1000),
        compactLayout: false,
        inspectSlotId: null,
        inspectSlotFocusFile: null,
        inspectUnclassifiedFile: null,
      });
      setState("done");
      setStepIdx(2);
      toast.success(`${items.length} bestand(en) geclassificeerd.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Classificatie mislukt");
      setState("idle");
    }
  };

  const addFiles = useCallback(async (list: FileList | File[]) => {
    let arr: File[];
    try {
      arr = await collectImagesFromUploadList(list);
    } catch (e) {
      console.error(e);
      toast.error("ZIP-bestand kon niet worden gelezen.");
      return;
    }
    if (arr.length === 0) {
      toast.error("Geen geldige afbeeldingen in je selectie (of lege ZIP).");
      return;
    }
    setFiles((prev) => {
      const seenContent = new Set(prev.map((f) => `${f.name}\0${f.size}`));
      const takenNames = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      for (const f of arr) {
        const contentKey = `${f.name}\0${f.size}`;
        if (seenContent.has(contentKey)) continue;
        seenContent.add(contentKey);
        let outName = f.name;
        if (takenNames.has(outName)) {
          outName = uniquifyFileName(f.name, takenNames);
        }
        takenNames.add(outName);
        const outFile =
          outName === f.name ? f : new File([f], outName, { type: f.type, lastModified: f.lastModified });
        merged.push(outFile);
      }
      return merged;
    });
  }, []);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto animate-fade-in">
        <header className="max-w-6xl mx-auto w-full mb-6 sm:mb-8 pb-6 sm:pb-7 border-b border-border/70 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Foto’s sorteren</h1>
            <p className="mt-3 sm:mt-4 max-w-prose text-sm text-muted-foreground leading-relaxed">
              Sleep autofoto’s naar het gemarkeerde uploadveld hieronder, of klik op het veld om bestanden te kiezen.
            </p>
          </div>
          {showResults ? (
            <div className="flex w-full sm:w-auto justify-center sm:justify-end shrink-0">
              <Button
                type="button"
                onClick={startNewSort}
                className="gap-2 bg-orange-600 text-white hover:bg-orange-700 border border-orange-700 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" /> Nieuwe sorter
              </Button>
            </div>
          ) : null}
        </header>

        {state === "idle" && !showResults && (
          <IdleView
            enhance={enhance}
            setEnhance={setEnhance}
            useDedupe={useDedupe}
            setUseDedupe={setUseDedupe}
            onSort={startSort}
            files={files}
            onAddFiles={addFiles}
            fileInputRef={fileInputRef}
            onClearFiles={() => setFiles([])}
            chunkSize={chunkSize}
            onChunkSize={setChunkSize}
          />
        )}
        {state === "loading" && <LoadingView stepIdx={stepIdx} steps={INVENTORY_SORT_STEPS} />}
        {showResults && <SorterWorkspaceView surface="sorter" />}
      </div>
    </AppLayout>
  );
}

function IdleView({
  enhance,
  setEnhance,
  useDedupe,
  setUseDedupe,
  onSort,
  files,
  onAddFiles,
  fileInputRef,
  onClearFiles,
  chunkSize,
  onChunkSize,
}: {
  enhance: boolean;
  setEnhance: (v: boolean) => void;
  useDedupe: boolean;
  setUseDedupe: (v: boolean) => void;
  onSort: () => void;
  files: File[];
  onAddFiles: (list: FileList | File[]) => void | Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClearFiles: () => void;
  chunkSize: number;
  onChunkSize: (n: number) => void;
}) {
  const [dropActive, setDropActive] = useState(false);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif,.zip,application/zip"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "w-full border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer bg-muted/20",
          dropActive
            ? "border-primary bg-primary/10 shadow-sm"
            : "border-primary/40 hover:border-primary hover:bg-primary/5",
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropActive(false);
          if (e.dataTransfer.files?.length) void onAddFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="w-10 h-10 mx-auto text-primary mb-3" />
        <p className="font-medium text-foreground">Sleep autofoto’s hierheen of klik om te bladeren</p>
        <p className="text-sm text-muted-foreground mt-1">
          Afbeeldingen of een .zip met foto’s — grote batches kunnen enkele minuten duren (JPEG, PNG, WebP, HEIC…).
        </p>
        {files.length > 0 && (
          <p className="text-sm text-primary mt-3 font-medium">{files.length} foto’s geselecteerd</p>
        )}
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:items-start">
        <div className="min-w-0 space-y-0">
          <Label className="mb-1.5 block text-sm font-medium text-foreground">Referentieset</Label>
          <Select defaultValue="standard">
            <SelectTrigger className="h-10 w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standaard personenauto</SelectItem>
              <SelectItem value="ev">EV-layout</SelectItem>
              <SelectItem value="oldtimer">Oldtimer-layout</SelectItem>
              <SelectItem value="premium">Premium advertentie</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-0">
          <Label htmlFor="batch-size" className="mb-1.5 block text-sm font-medium text-foreground">
            Batchgrootte
          </Label>
          <Input
            id="batch-size"
            type="number"
            min={0}
            max={500}
            className="h-10 w-full max-w-[8.5rem] tabular-nums"
            value={chunkSize}
            onChange={(e) => onChunkSize(Number(e.target.value) || 0)}
          />
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
            0 = alle foto’s in één classificatieverzoek; hoger = kleinere batches.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 items-center">
          <div className="flex items-center gap-3 min-h-10">
            <Switch checked={enhance} onCheckedChange={setEnhance} id="enhance" className="shrink-0" />
            <Label htmlFor="enhance" className="text-sm font-medium text-foreground cursor-pointer leading-snug">
              Alle beelden verbeteren
            </Label>
          </div>
          <div className="flex items-center gap-3 min-h-10">
            <Switch checked={useDedupe} onCheckedChange={setUseDedupe} id="dedupe" className="shrink-0" />
            <Label htmlFor="dedupe" className="text-sm font-medium text-foreground cursor-pointer leading-snug">
              Vergelijkbare foto’s samenvoegen
            </Label>
          </div>
        </div>
        {files.length > 0 ? (
          <div className="flex justify-start">
            <Button type="button" variant="outline" size="sm" onClick={onClearFiles}>
              Foto’s wissen
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex justify-center pt-1">
        <Button onClick={onSort} size="lg" className="gap-2 min-w-[14rem]">
          <Sparkles className="w-4 h-4" /> Start sorteren
        </Button>
      </div>
    </div>
  );
}

function LoadingView({ stepIdx, steps }: { stepIdx: number; steps: readonly string[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin mb-6" />
      <p className="text-sm text-muted-foreground mb-4 max-w-md text-center leading-relaxed">
        Even geduld — je foto’s worden geclassificeerd. Grote batches kunnen enkele minuten duren.
      </p>
      <div className="space-y-2 w-full max-w-xs">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-3 text-sm transition-opacity ${i > stepIdx ? "opacity-30" : ""}`}>
            <div className={`w-2 h-2 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            <span className={i === stepIdx ? "font-medium text-foreground" : "text-muted-foreground"}>{s}</span>
            {i < stepIdx && (
              <span className="text-xs text-primary ml-auto" aria-hidden>
                ✓
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
