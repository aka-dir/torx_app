import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download,
  MessageSquare,
  ArrowRight,
  ImageIcon,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventorySlot as Slot, InventoryUnclassified as Unclassified } from "@/lib/inventoryClassify";
import { fixedSlotOrdinal } from "@/lib/slotTemplates";
import { cn } from "@/lib/utils";
import type { ResultsLayoutMode } from "@/context/SorterSessionContext";

export const MANUAL_SLOT_PREFIX = "manual_" as const;
export function isManualSlotId(id: string): boolean {
  return id.startsWith(MANUAL_SLOT_PREFIX);
}
export type SlotDragPayload =
  | { source: "unclassified"; fileName: string }
  | { source: "slot"; slotId: string; fileName: string };

const INITIAL_THUMB_LIMIT = 24;

/** Bestandsnaam voor export bewerken; bron-`File` in het geheugen blijft ongewijzigd. */
export function EditableZipExportName({
  original,
  getZipExportName,
  onCommit,
  className,
  inputClassName,
}: {
  original: string;
  getZipExportName: (original: string) => string;
  onCommit: (original: string, raw: string) => boolean;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (editing) setDraft(getZipExportName(original));
  }, [editing, original, getZipExportName]);

  if (editing) {
    return (
      <Input
        autoFocus
        className={cn("h-7 text-[11px] font-mono px-1.5", inputClassName)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!onCommit(original, draft)) {
            setDraft(getZipExportName(original));
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(getZipExportName(original));
            setEditing(false);
          }
        }}
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn("font-mono text-[11px] truncate block cursor-text", className)}
      title={`Dubbelklik om te bewerken (alleen export). Bron: ${original}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {getZipExportName(original)}
    </span>
  );
}

export function SelectedInspectPanel({
  slots,
  resultsLayout,
  inspectSlotId,
  inspectSlotFocusFile,
  onFocusSlotFile,
  inspectUnclassifiedFile,
  files,
  onClose,
  getZipExportName,
  onCommitExportName,
  previewByName,
  unclassified,
}: {
  slots: Slot[];
  resultsLayout: ResultsLayoutMode;
  inspectSlotId: string | null;
  inspectSlotFocusFile: string | null;
  onFocusSlotFile: (name: string) => void;
  inspectUnclassifiedFile: string | null;
  files: File[];
  onClose: () => void;
  getZipExportName: (original: string) => string;
  onCommitExportName: (original: string, raw: string) => boolean;
  previewByName: Map<string, string>;
  unclassified: Unclassified[];
}) {
  const slot = inspectSlotId ? slots.find((s) => s.id === inspectSlotId) : undefined;
  const unclassifiedRow = inspectUnclassifiedFile
    ? unclassified.find((u) => u.name === inspectUnclassifiedFile)
    : undefined;
  const slotPreviewFile =
    slot && slot.files.length > 0
      ? inspectSlotFocusFile && slot.files.includes(inspectSlotFocusFile)
        ? inspectSlotFocusFile
        : slot.files[0]
      : null;
  const focusFile = inspectUnclassifiedFile ?? slotPreviewFile;
  const largePreviewSrc = focusFile && previewByName.has(focusFile) ? previewByName.get(focusFile)! : null;
  const missingInSession = Boolean(focusFile && !files.some((x) => x.name === focusFile));

  const hasSelection = Boolean(slot || inspectUnclassifiedFile);

  const previewColumn =
    focusFile != null ? (
      <div className="space-y-2 w-full min-w-0">
        <Label className="text-[11px] text-muted-foreground mb-1.5 block">Voorbeeld (geselecteerd)</Label>
        {largePreviewSrc ? (
          <div className="rounded-lg overflow-hidden border border-border bg-muted/40 flex justify-center items-center min-h-[120px]">
            <img
              src={largePreviewSrc}
              alt=""
              className="max-h-[min(70vh,32rem)] w-auto max-w-full object-contain mx-auto"
            />
          </div>
        ) : missingInSession ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Dit bestand staat niet meer in je browserlijst (sessie).
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Geen voorbeeld beschikbaar.</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Bronsbestand: <span className="font-mono break-all">{focusFile}</span>
        </p>
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">
            Bestandsnaam in export (alleen ZIP; bronbestand ongewijzigd)
          </Label>
          <EditableZipExportName
            original={focusFile}
            getZipExportName={getZipExportName}
            onCommit={onCommitExportName}
            className="text-sm"
            inputClassName="max-w-md"
          />
        </div>
      </div>
    ) : null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-foreground">
          {inspectUnclassifiedFile
            ? "Geselecteerde foto (niet ingedeeld)"
            : resultsLayout === "groups"
              ? "Geselecteerde gecategoriseerde kolom"
              : "Geselecteerd vak"}
        </h2>
        {hasSelection ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
            Sluiten
          </Button>
        ) : null}
      </div>
      {!hasSelection ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Klik op een <strong className="text-foreground">vak of gecategoriseerde kolom</strong> om foto's te bekijken. Onder het
          grote voorbeeld staan het bronsbestand en (dubbelklik) de bestandsnaam voor de export — je lokale bestanden
          blijven ongewijzigd.
        </p>
      ) : slot ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs font-normal max-w-[min(100%,28rem)] truncate">
              {slot.label}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {slot.files.length} bestand{slot.files.length !== 1 ? "en" : ""}
            </span>
          </div>
          {slot.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {resultsLayout === "groups"
                ? "Deze gecategoriseerde kolom is nog leeg — sleep er foto's naartoe."
                : "Dit vak is nog leeg — sleep er foto's naartoe."}
            </p>
          ) : (
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-stretch">
              <div className="flex-1 min-w-0 w-full flex flex-col gap-3 md:max-w-[min(100%,28rem)]">
                <Label className="text-[11px] text-muted-foreground">
                  Miniaturen — klik voor groot voorbeeld
                </Label>
                <div className="flex flex-col gap-2 max-h-[min(50vh,22rem)] overflow-y-auto pr-1 -mr-0.5">
                  {slot.files.map((fn) => (
                    <div
                      key={fn}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex flex-row items-center gap-3 rounded-lg border bg-muted/20 p-2 cursor-pointer transition-shadow text-left w-full max-w-md",
                        inspectSlotFocusFile === fn
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                      onClick={() => onFocusSlotFile(fn)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onFocusSlotFile(fn);
                        }
                      }}
                    >
                      <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden border border-border bg-muted/40">
                        {previewByName.has(fn) ? (
                          <img
                            src={previewByName.get(fn)!}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="h-full w-full flex items-center justify-center"
                            style={{ background: slot.color }}
                          >
                            <ImageIcon className="w-6 h-6 text-foreground/20" />
                          </div>
                        )}
                      </div>
                      <span
                        className="font-mono text-[10px] truncate min-w-0 flex-1"
                        title={`${fn} → ${getZipExportName(fn)}`}
                      >
                        {getZipExportName(fn)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {previewColumn ? (
                <div className="w-full md:flex-1 min-w-0 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-6 flex flex-col items-stretch">
                  <div className="w-full max-w-xl mx-auto">{previewColumn}</div>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : inspectUnclassifiedFile ? (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-stretch">
          <div className="flex-1 min-w-0 md:max-w-[min(100%,28rem)]">
            {unclassifiedRow ? (
              <p className="text-[11px] text-muted-foreground leading-snug">{unclassifiedRow.reason}</p>
            ) : null}
          </div>
          {previewColumn ? (
            <div className="w-full md:flex-1 min-w-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 flex flex-col items-stretch">
              <div className="w-full max-w-xl mx-auto">{previewColumn}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Memoized sub-components for the results grid.
 * Each renders independently so slot/drag/inspect changes
 * only re-draw the affected card or row.
 * ──────────────────────────────────────────────────────────── */

const SlotPhotoThumb = memo(function SlotPhotoThumb({
  fileName,
  slotId,
  previewSrc,
  slotColor,
  thumbSize,
  displayName,
  onSlotFileClick,
  onDragStart,
  onDragEnd,
}: {
  fileName: string;
  slotId: string;
  previewSrc: string | undefined;
  slotColor: string;
  thumbSize: string;
  displayName: string;
  onSlotFileClick: (slotId: string, fileName: string) => void;
  onDragStart: (payload: SlotDragPayload) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className="shrink-0 flex flex-col items-center gap-1 max-w-[6.5rem] sm:max-w-[7rem]"
      onClick={(e) => {
        e.stopPropagation();
        onSlotFileClick(slotId, fileName);
      }}
    >
      <div
        className={cn(
          "rounded-md overflow-hidden border border-border bg-muted/30 cursor-grab active:cursor-grabbing",
          thumbSize,
        )}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", slotId);
          onDragStart({ source: "slot", slotId, fileName });
        }}
        onDragEnd={onDragEnd}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center" style={{ background: slotColor }}>
            <ImageIcon className="w-5 h-5 text-foreground/25" />
          </div>
        )}
      </div>
      <span
        className="font-mono text-[10px] sm:text-[11px] text-center w-full truncate block leading-tight"
        title={`${fileName} → ${displayName}`}
      >
        {displayName}
      </span>
    </div>
  );
});

const CompactSlotFileRow = memo(function CompactSlotFileRow({
  fileName,
  slotId,
  displayName,
  onSlotFileClick,
  onDragStart,
  onDragEnd,
}: {
  fileName: string;
  slotId: string;
  displayName: string;
  onSlotFileClick: (slotId: string, fileName: string) => void;
  onDragStart: (payload: SlotDragPayload) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left hover:border-primary/40 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onSlotFileClick(slotId, fileName);
      }}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", slotId);
        onDragStart({ source: "slot", slotId, fileName });
      }}
      onDragEnd={onDragEnd}
      title={`${fileName} → ${displayName}`}
    >
      <span className="font-mono text-[11px] text-foreground truncate min-w-0 flex-1">
        {displayName}
      </span>
    </button>
  );
});

const SlotCard = memo(function SlotCard({
  slot,
  isSelected,
  isDragOver,
  compactLayout,
  isGroups,
  previewByName,
  getZipExportName,
  onSlotCardClick,
  onSlotFileClick,
  setDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onRemoveManualSlot,
}: {
  slot: Slot;
  isSelected: boolean;
  isDragOver: boolean;
  compactLayout: boolean;
  isGroups: boolean;
  previewByName: Map<string, string>;
  getZipExportName: (original: string) => string;
  onSlotCardClick: (slotId: string) => void;
  onSlotFileClick: (slotId: string, fileName: string) => void;
  setDragOver: (v: string | null) => void;
  onDrop: (slotId: string) => void;
  onDragStart: (payload: SlotDragPayload) => void;
  onDragEnd: () => void;
  onRemoveManualSlot: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const thumbSize = compactLayout ? "w-16 h-16" : "w-[5.75rem] h-[5.75rem] sm:w-24 sm:h-24";
  const slotPad = compactLayout ? "p-3" : "p-4 sm:p-5";

  const visibleFiles = useMemo(() => {
    if (expanded || slot.files.length <= INITIAL_THUMB_LIMIT) return slot.files;
    return slot.files.slice(0, INITIAL_THUMB_LIMIT);
  }, [slot.files, expanded]);

  const hiddenCount = slot.files.length - visibleFiles.length;

  const handleCardClick = useCallback(() => onSlotCardClick(slot.id), [onSlotCardClick, slot.id]);
  const handleDragOver = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(slot.id); },
    [setDragOver, slot.id],
  );
  const handleDragLeave = useCallback(() => setDragOver(null), [setDragOver]);
  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); onDrop(slot.id); },
    [onDrop, slot.id],
  );

  return (
    <div
      className={cn(
        "border rounded-xl transition-colors",
        slotPad,
        isDragOver ? "border-primary bg-accent" : "border-border",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      onClick={handleCardClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          {!isGroups && fixedSlotOrdinal(slot.id) != null ? (
            <p className="text-[10px] font-mono text-muted-foreground tabular-nums mb-0.5">
              {fixedSlotOrdinal(slot.id)} / 12
            </p>
          ) : null}
          <p
            className={cn(
              "font-semibold text-foreground leading-snug truncate",
              compactLayout ? "text-xs" : "text-sm",
            )}
            title={slot.label}
          >
            {slot.label}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {slot.files.length > 1 ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">×{slot.files.length}</span>
          ) : null}
          {isManualSlotId(slot.id) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label="Handmatig vak verwijderen"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveManualSlot(slot.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {slot.files.length > 0 ? (
        compactLayout ? (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {visibleFiles.map((fn) => (
              <CompactSlotFileRow
                key={fn}
                fileName={fn}
                slotId={slot.id}
                displayName={getZipExportName(fn)}
                onSlotFileClick={onSlotFileClick}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="w-full text-center text-xs text-primary hover:underline py-1"
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              >
                +{hiddenCount} meer
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 pt-0.5 -mx-0.5 px-0.5 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {visibleFiles.map((fn) => (
                <SlotPhotoThumb
                  key={fn}
                  fileName={fn}
                  slotId={slot.id}
                  previewSrc={previewByName.get(fn)}
                  slotColor={slot.color}
                  thumbSize={thumbSize}
                  displayName={getZipExportName(fn)}
                  onSlotFileClick={onSlotFileClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={cn(
                    "shrink-0 rounded-md border-2 border-dashed border-primary/40 flex items-center justify-center text-xs text-primary hover:bg-primary/5 transition-colors",
                    thumbSize,
                  )}
                  onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                >
                  +{hiddenCount}
                </button>
              )}
            </div>
          </>
        )
      ) : (
        <div
          className={cn(
            "rounded-lg border-2 border-dashed border-border flex items-center justify-center",
            compactLayout ? "min-h-[4.5rem]" : "min-h-[7rem] sm:min-h-[8rem]",
          )}
        >
          <span className="text-[11px] sm:text-xs text-muted-foreground text-center px-2 py-2">
            Leeg — sleep een foto
          </span>
        </div>
      )}
    </div>
  );
});

const UnclassifiedRow = memo(function UnclassifiedRow({
  item,
  isSelected,
  previewSrc,
  compactLayout,
  displayName,
  onUnclassifiedInspectClick,
  onDragStart,
  onDragEnd,
}: {
  item: Unclassified;
  isSelected: boolean;
  previewSrc: string | undefined;
  compactLayout: boolean;
  displayName: string;
  onUnclassifiedInspectClick: (fileName: string) => void;
  onDragStart: (payload: SlotDragPayload) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onClick={(e) => {
        e.stopPropagation();
        onUnclassifiedInspectClick(item.name);
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.name);
        onDragStart({ source: "unclassified", fileName: item.name });
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-3 sm:gap-4 border rounded-lg p-2.5 sm:p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors bg-card",
        isSelected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <div
        className={cn(
          "rounded flex-shrink-0 overflow-hidden bg-muted/40",
          compactLayout ? "w-10 h-10" : "w-14 h-14",
        )}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: item.color }}
          >
            <ImageIcon className="w-3.5 h-3.5 text-foreground/20" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-medium text-foreground truncate"
          title={`${item.name} → ${displayName}`}
        >
          {displayName}
        </p>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-4 break-words">
          {item.reason}
        </p>
      </div>
      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
    </div>
  );
});

const ResultsStats = memo(function ResultsStats({
  slots,
  unclassified,
  isGroups,
  runSeconds,
}: {
  slots: Slot[];
  unclassified: Unclassified[];
  isGroups: boolean;
  runSeconds: number | null;
}) {
  const filled = slots.filter((s) => s.files.length > 0).length;
  const empty = slots.filter((s) => s.files.length === 0).length;
  const entries: [string, string][] = [
    [isGroups ? "Labelkolommen" : "Bewerkt totaal", String(slots.length)],
    ["Met foto's", String(filled)],
    ["Leeg", String(empty)],
    ["Niet ingedeeld", String(unclassified.length)],
    ["Duur", runSeconds != null ? `${runSeconds}s` : "—"],
  ];
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 max-w-5xl mx-auto">
        {entries.map(([label, val]) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-xl font-bold text-foreground">{val}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

export function ResultsView({
  slots,
  unclassified,
  resultsLayout,
  onResultsLayoutChange,
  selectedSlotId,
  selectedUnclassifiedFile,
  onSlotCardClick,
  onSlotFileClick,
  onUnclassifiedInspectClick,
  dragOver,
  setDragOver,
  onDrop,
  onDropToUnclassified,
  onDragStart,
  onDragEnd,
  onDownload,
  onFeedback,
  runSeconds,
  onAddManualSlot,
  onRemoveManualSlot,
  previewByName,
  zipNameStamp,
  onZipNameStampChange,
  onApplyPrefixZipNames,
  onApplyAiZipNames,
  onResetZipNames,
  compactLayout,
  onCompactLayoutChange,
  onClearVakken,
  getZipExportName,
}: {
  slots: Slot[];
  unclassified: Unclassified[];
  resultsLayout: ResultsLayoutMode;
  onResultsLayoutChange: (v: ResultsLayoutMode) => void;
  selectedSlotId: string | null;
  selectedUnclassifiedFile: string | null;
  onSlotCardClick: (slotId: string) => void;
  onSlotFileClick: (slotId: string, fileName: string) => void;
  onUnclassifiedInspectClick: (fileName: string) => void;
  dragOver: string | null;
  setDragOver: (v: string | null) => void;
  onDrop: (slotId: string) => void;
  onDropToUnclassified: () => void;
  onDragStart: (payload: SlotDragPayload) => void;
  onDragEnd: () => void;
  onDownload: () => void | Promise<void>;
  onFeedback: () => void;
  runSeconds: number | null;
  onAddManualSlot: (label: string) => void;
  onRemoveManualSlot: (id: string) => void;
  previewByName: Map<string, string>;
  zipNameStamp: string;
  onZipNameStampChange: (v: string) => void;
  onApplyPrefixZipNames: () => void;
  onApplyAiZipNames: () => void;
  onResetZipNames: () => void;
  compactLayout: boolean;
  onCompactLayoutChange: (v: boolean) => void;
  onClearVakken?: () => void;
  getZipExportName: (original: string) => string;
}) {
  const [manualLabelDraft, setManualLabelDraft] = useState("");
  const isGroups = resultsLayout === "groups";

  // Stable ref wrappers for callbacks that the hook recreates each render.
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const stableOnDrop = useCallback((slotId: string) => onDropRef.current(slotId), []);

  const handleUnclassifiedDragOver = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver("__unclassified__"); },
    [setDragOver],
  );
  const handleUnclassifiedDragLeave = useCallback(() => setDragOver(null), [setDragOver]);
  const handleUnclassifiedDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); onDropToUnclassified(); },
    [onDropToUnclassified],
  );

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 min-w-0 flex-1 max-w-xl">
          <div className="flex flex-col gap-1 max-w-md">
            <Label className="text-xs text-muted-foreground">Gesorteerd · vakken</Label>
            <Select
              value={resultsLayout}
              onValueChange={(v) => onResultsLayoutChange(v as ResultsLayoutMode)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[min(100%,22rem)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Vast raster (twaalf categorieën)</SelectItem>
                <SelectItem value="groups">Gecategoriseerde weergave (één kolom per classificatielabel)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {isGroups
              ? "Elke kolom = één modelclassificatie (gecategoriseerd). Gelijknamige categorieën krijgen een korte onderscheider. Handmatige vakken rechts onderaan."
              : "Vast raster van twaalf categorieën. Handmatige vakken staan rechts onderaan, onder «Nog niet ingedeeld»."}
          </p>
        </div>
        <div className="flex flex-col gap-4 items-stretch shrink-0 w-full lg:w-[min(100%,380px)] lg:ml-auto">
          <div className="flex items-center gap-2 lg:justify-end">
            <Switch checked={compactLayout} onCheckedChange={onCompactLayoutChange} id="compact-layout" />
            <Label htmlFor="compact-layout" className="text-sm cursor-pointer whitespace-nowrap">
              Compacte weergave
            </Label>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 w-full">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-foreground">Namen bewerken</Label>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    aria-label="Uitleg: namen bewerken voor export"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed space-y-2">
                  <p className="font-medium text-foreground">Export (ZIP)</p>
                  <p>
                    Je originele bestanden blijven onaangetast. Hier stel je in hoe bestanden in het zipbestand heten —
                    onder meer via dubbelklik op een miniatuur.
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                    <li>
                      <span className="text-foreground font-medium">Alleen voorvoegsel</span> — het veld hierboven vóór elke
                      oorspronkelijke bestandsnaam (bijv. <code className="text-[10px] bg-muted px-1 rounded">Voorraad_2026_</code>
                      + bestaande naam).
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Voorvoegsel + door het model voorgestelde namen</span>{" "}
                      — zelfde voorvoegsel, plus waar mogelijk <span className="text-foreground font-medium">merk en model</span>{" "}
                      uit het classificatie-antwoord, een <span className="text-foreground font-medium">Nederlandse categorienaam</span>{" "}
                      (afgeleid van het model, zoals «Interieur – Kofferbak») en een volgnummer. Ontbreekt die categorie uit het
                      model, dan de naam van het huidige vak. Bij een{" "}
                      <span className="text-foreground font-medium">handmatig vak</span> wordt de vaknaam niet in de
                      bestandsnaam gezet; alleen fotostam en volgnummer, met optioneel voertuig en modelcategorie als die bekend zijn.
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Naamwijzigingen wissen</span> — de export gebruikt weer
                      de oorspronkelijke bestandsnamen.
                    </li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Standaard: originele namen in het overzicht en in de export. Pas hieronder voorvoegsel toe of kies{" "}
              <span className="text-foreground font-medium">voorvoegsel + door het model voorgestelde namen</span>.
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor="zip-name-stamp" className="text-[10px] text-muted-foreground">
                Voorvoegsel (bijv. Voorraad_2026)
              </Label>
              <Input
                id="zip-name-stamp"
                className="h-9"
                placeholder="Voorraad_2026"
                value={zipNameStamp}
                onChange={(e) => onZipNameStampChange(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 h-auto w-full justify-center text-center whitespace-normal px-2 py-2.5 text-xs leading-snug border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                onClick={onApplyPrefixZipNames}
              >
                Alleen voorvoegsel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 h-auto w-full justify-center text-center whitespace-normal px-2 py-2.5 text-xs leading-snug border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                onClick={onApplyAiZipNames}
              >
                Voorvoegsel + modelnamen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 h-auto w-full justify-center text-center whitespace-normal px-2 py-2.5 text-xs leading-snug sm:col-span-2 border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                onClick={onResetZipNames}
              >
                Naamwijzigingen wissen
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_min(100%,380px)] gap-8 lg:gap-10">
        <div className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                isDragOver={dragOver === slot.id}
                compactLayout={compactLayout}
                isGroups={isGroups}
                previewByName={previewByName}
                getZipExportName={getZipExportName}
                onSlotCardClick={onSlotCardClick}
                onSlotFileClick={onSlotFileClick}
                setDragOver={setDragOver}
                onDrop={stableOnDrop}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onRemoveManualSlot={onRemoveManualSlot}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5 min-w-0 w-full lg:max-w-[380px] lg:justify-self-end lg:sticky lg:top-4 h-fit">
          <div
            className={cn(
              "border rounded-xl p-5 sm:p-6 h-fit transition-colors",
              dragOver === "__unclassified__" ? "border-primary bg-accent" : "border-border",
            )}
            onDragOver={handleUnclassifiedDragOver}
            onDragLeave={handleUnclassifiedDragLeave}
            onDrop={handleUnclassifiedDrop}
          >
            <h3 className="font-semibold text-foreground text-sm mb-1">Nog niet ingedeeld</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Sleep naar een vak of zet terug vanuit een vak. Lange lijsten scrollen hier.
            </p>
            <div className="space-y-3 max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain pr-1">
              {unclassified.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">Alles ingedeeld</p>
              )}
              {unclassified.map((u, ui) => (
                <UnclassifiedRow
                  key={`${u.name}-${ui}`}
                  item={u}
                  isSelected={selectedUnclassifiedFile === u.name}
                  previewSrc={previewByName.get(u.name)}
                  compactLayout={compactLayout}
                  displayName={getZipExportName(u.name)}
                  onUnclassifiedInspectClick={onUnclassifiedInspectClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-2">
            <p className="text-xs font-semibold text-foreground">Handmatig vak toevoegen</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Jouw naam wordt de map onder <span className="font-medium text-foreground">gecategoriseerd/</span> in het
              exportbestand. Sleep foto's erheen vanuit «niet ingedeeld» of een andere kolom.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Naam categoriemap (export)</Label>
                <Input
                  placeholder="Bijv. Extra — kofferbak"
                  value={manualLabelDraft}
                  onChange={(e) => setManualLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    onAddManualSlot(manualLabelDraft);
                    setManualLabelDraft("");
                  }}
                  className="h-9"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 h-9 w-full"
                onClick={() => {
                  onAddManualSlot(manualLabelDraft);
                  setManualLabelDraft("");
                }}
              >
                <Plus className="w-4 h-4" /> Vak toevoegen
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ResultsStats slots={slots} unclassified={unclassified} isGroups={isGroups} runSeconds={runSeconds} />

      <div className="flex flex-wrap items-center justify-between gap-3 w-full">
        <div className="flex flex-wrap gap-3">
          <Button className="gap-2" onClick={() => void onDownload()}>
            <Download className="w-4 h-4" /> Resultaat downloaden
          </Button>
          <Button variant="outline" onClick={onFeedback} className="gap-2">
            <MessageSquare className="w-4 h-4" /> Terugkoppeling
          </Button>
        </div>
        {onClearVakken != null ? (
          <Button type="button" variant="destructive" onClick={onClearVakken} className="gap-2 shrink-0">
            <Trash2 className="w-4 h-4" /> Resultaat wissen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
