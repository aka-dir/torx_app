# Generates src/hooks/useDoneSessionWorkspace.ts from ImageSorter.tsx body slices + patches.
from pathlib import Path

root = Path(__file__).resolve().parent.parent
lines = (root / "src/pages/ImageSorter.tsx").read_text(encoding="utf-8").splitlines()

def ln(i: int) -> str:
    return lines[i - 1]

# 1-based inclusive ranges (display + handlers, exclude snapshot/startNewSort/startSort/addFiles)
chunks = [
    (147, 160),
    (206, 340),
    (434, 774),
    (776, 818),
]
parts: list[str] = []
for a, b in chunks:
    parts.extend(lines[a - 1 : b])

body = "\n".join(parts)

# patchSlots-style helpers will be prepended; replace React setters
repls = [
    ("setSlots((", "patchSlots(("),
    ("setUnclassified((", "patchUnclassified(("),
    ("setLabelGroups((", "patchLabelGroups(("),
    ("setGroupsUnclassified((", "patchGroupsUnclassified(("),
    ("setExportNames((", "patchExportNames(("),
    ("setResultsLayout(", "patchResultsLayout("),
    ("setZipNameStamp(", "patchZipNameStamp("),
    ("setCompactLayout(", "patchCompactLayout("),
]
for a, b in repls:
    body = body.replace(a, b)

# setInspect* and clearInspect — manual replaces in body
body = body.replace(
    "setInspectUnclassifiedFile(null);",
    "patchInspect({ inspectUnclassifiedFile: null });",
)
body = body.replace(
    """setInspectSlotId(null);
      setInspectSlotFocusFile(null);
      return;""",
    """patchInspect({ inspectSlotId: null, inspectSlotFocusFile: null });
      return;""",
)
body = body.replace(
    "setInspectSlotId(slotId);\n      const s = displaySlots.find",
    "patchInspect({ inspectSlotId: slotId });\n      const s = displaySlots.find",
)
body = body.replace(
    "setInspectSlotFocusFile(s?.files[0] ?? null);",
    "patchInspect({ inspectSlotFocusFile: s?.files[0] ?? null });",
)
body = body.replace(
    """setInspectUnclassifiedFile(null);
    setInspectSlotId(slotId);
    setInspectSlotFocusFile(fileName);""",
    """patchInspect({
      inspectUnclassifiedFile: null,
      inspectSlotId: slotId,
      inspectSlotFocusFile: fileName,
    });""",
)
body = body.replace(
    """setInspectSlotId(null);
    setInspectSlotFocusFile(null);
    setInspectUnclassifiedFile((prev) => (prev === name ? null : name));""",
    """setDoneSession((p) => {
      if (!p) return p;
      const next = p.inspectUnclassifiedFile === name ? null : name;
      return {
        ...p,
        inspectSlotId: null,
        inspectSlotFocusFile: null,
        inspectUnclassifiedFile: next,
      };
    });""",
)
body = body.replace(
    """setInspectSlotId(null);
    setInspectSlotFocusFile(null);
    setInspectUnclassifiedFile(null);""",
    """patchInspect({
      inspectSlotId: null,
      inspectSlotFocusFile: null,
      inspectUnclassifiedFile: null,
    });""",
)

# onSlotCardClick block — still has setInspectUnclassifiedFile(null) first line
body = body.replace(
    """setInspectUnclassifiedFile(null);
      if (inspectSlotId === slotId) {
        setInspectSlotId(null);
        setInspectSlotFocusFile(null);
        return;
      }
      setInspectSlotId(slotId);""",
    """if (inspectSlotId === slotId) {
        patchInspect({ inspectSlotId: null, inspectSlotFocusFile: null, inspectUnclassifiedFile: null });
        return;
      }
      patchInspect({ inspectUnclassifiedFile: null, inspectSlotId: slotId });""",
)

# inspect effect: replace setInspectSlotId/setInspectSlotFocusFile
body = body.replace(
    """if (!s) {
      setInspectSlotId(null);
      setInspectSlotFocusFile(null);
      return;
    }
    if (s.files.length === 0) {
      setInspectSlotFocusFile(null);
      return;
    }
    setInspectSlotFocusFile((prev) => (prev && s.files.includes(prev) ? prev : s.files[0]));""",
    """if (!s) {
      patchInspect({ inspectSlotId: null, inspectSlotFocusFile: null });
      return;
    }
    if (s.files.length === 0) {
      patchInspect({ inspectSlotFocusFile: null });
      return;
    }
    setDoneSession((p) => {
      if (!p) return p;
      const prevF = p.inspectSlotFocusFile;
      const nextF = prevF && s.files.includes(prevF) ? prevF : s.files[0];
      if (nextF === prevF) return p;
      return { ...p, inspectSlotFocusFile: nextF };
    });""",
)

# handleDownloadOutput: remove setFeedbackOpen — use param in hook wrapper
body = body.replace(
    "setTimeout(() => setFeedbackOpen(true), 500);",
    "setTimeout(() => openFeedback(), 500);",
)

# onSlotCardClick dependency array still valid

header = r'''import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSorterSession, type ResultsLayoutMode } from "@/context/SorterSessionContext";
import type { InventorySlot as Slot } from "@/lib/inventoryClassify";
import { downloadSortedZip, safePathSegment } from "@/lib/downloadSortOutput";
import { buildCategoryUniqueZipNames, buildPrefixOnlyZipNames } from "@/lib/zipExportNames";
import { dutchTitleForApiLabel } from "@/lib/inventoryClassify";
import { groupRowSlotId } from "@/lib/slotTemplates";
import { isManualSlotId, type SlotDragPayload, MANUAL_SLOT_PREFIX } from "@/components/inventory/SorterResultsPanels";

export function useDoneSessionWorkspace() {
  const { doneSession, setDoneSession } = useSorterSession();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<SlotDragPayload | null>(null);

  const patchSlots = useCallback(
    (fn: (prev: Slot[]) => Slot[]) => {
      setDoneSession((p) => (p ? { ...p, slots: fn(p.slots) } : p));
    },
    [setDoneSession],
  );
  const patchUnclassified = useCallback(
    (fn: (prev: typeof doneSession extends infer T ? T extends { unclassified: infer U } ? U : never : never) => typeof doneSession extends infer T ? T extends { unclassified: infer U } ? U : never : never) => {
      setDoneSession((p) => (p ? { ...p, unclassified: fn(p.unclassified) } : p));
    },
    [setDoneSession],
  );
'''

# Simplify patchUnclassified - use any for brevity in generated file
header = r'''import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSorterSession, type ResultsLayoutMode } from "@/context/SorterSessionContext";
import type { InventorySlot as Slot, InventoryUnclassified as Unclassified } from "@/lib/inventoryClassify";
import type { LabelGroup } from "@/features/inventory-product";
import { downloadSortedZip, safePathSegment } from "@/lib/downloadSortOutput";
import { buildCategoryUniqueZipNames, buildPrefixOnlyZipNames } from "@/lib/zipExportNames";
import { dutchTitleForApiLabel } from "@/lib/inventoryClassify";
import { groupRowSlotId } from "@/lib/slotTemplates";
import { isManualSlotId, type SlotDragPayload, MANUAL_SLOT_PREFIX } from "@/components/inventory/SorterResultsPanels";

export function useDoneSessionWorkspace() {
  const { doneSession, setDoneSession } = useSorterSession();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<SlotDragPayload | null>(null);

  const patchSlots = useCallback(
    (fn: (prev: Slot[]) => Slot[]) => {
      setDoneSession((p) => (p ? { ...p, slots: fn(p.slots) } : p));
    },
    [setDoneSession],
  );
  const patchUnclassified = useCallback(
    (fn: (prev: Unclassified[]) => Unclassified[]) => {
      setDoneSession((p) => (p ? { ...p, unclassified: fn(p.unclassified) } : p));
    },
    [setDoneSession],
  );
  const patchLabelGroups = useCallback(
    (fn: (prev: LabelGroup[]) => LabelGroup[]) => {
      setDoneSession((p) => (p ? { ...p, labelGroups: fn(p.labelGroups) } : p));
    },
    [setDoneSession],
  );
  const patchGroupsUnclassified = useCallback(
    (fn: (prev: Unclassified[]) => Unclassified[]) => {
      setDoneSession((p) => (p ? { ...p, groupsUnclassified: fn(p.groupsUnclassified) } : p));
    },
    [setDoneSession],
  );
  const patchExportNames = useCallback(
    (fn: (prev: Record<string, string>) => Record<string, string>) => {
      setDoneSession((p) => (p ? { ...p, exportNames: fn(p.exportNames) } : p));
    },
    [setDoneSession],
  );
  const patchResultsLayout = useCallback(
    (v: ResultsLayoutMode) => {
      setDoneSession((p) => (p ? { ...p, resultsLayout: v } : p));
    },
    [setDoneSession],
  );
  const patchZipNameStamp = useCallback(
    (v: string) => {
      setDoneSession((p) => (p ? { ...p, zipNameStamp: v } : p));
    },
    [setDoneSession],
  );
  const patchCompactLayout = useCallback(
    (v: boolean) => {
      setDoneSession((p) => (p ? { ...p, compactLayout: v } : p));
    },
    [setDoneSession],
  );
  const patchInspect = useCallback(
    (patch: Partial<{
      inspectSlotId: string | null;
      inspectSlotFocusFile: string | null;
      inspectUnclassifiedFile: string | null;
    }>) => {
      setDoneSession((p) => (p ? { ...p, ...patch } : p));
    },
    [setDoneSession],
  );

  if (!doneSession) return null;

  const {
    resultsLayout,
    slots,
    unclassified,
    labelGroups,
    groupsUnclassified,
    files,
    exportNames,
    zipNameStamp,
    runSeconds,
    compactLayout,
    inspectSlotId,
    inspectSlotFocusFile,
    inspectUnclassifiedFile,
  } = doneSession;

'''

footer = r'''
  const handleDownloadOutput = useCallback(
    async (openFeedback: () => void) => {
      if (!doneSession) return;
      try {
        if (doneSession.resultsLayout === "groups") {
          await downloadSortedZip({
            mode: "groups",
            slots: [],
            manualSlots: doneSession.slots.filter((s) => isManualSlotId(s.id)),
            groups: doneSession.labelGroups,
            unclassified: doneSession.groupsUnclassified,
            files: doneSession.files,
            exportNames: Object.keys(doneSession.exportNames).length > 0 ? doneSession.exportNames : undefined,
          });
        } else {
          await downloadSortedZip({
            mode: "slots",
            slots: doneSession.slots,
            groups: null,
            unclassified: doneSession.unclassified,
            files: doneSession.files,
            exportNames: Object.keys(doneSession.exportNames).length > 0 ? doneSession.exportNames : undefined,
          });
        }
        toast.success("ZIP gedownload.");
        setTimeout(() => openFeedback(), 500);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Download mislukt");
      }
    },
    [doneSession],
  );

  return {
    displaySlots,
    activeUnclassified,
    files,
    resultsLayout,
    setResultsLayout: patchResultsLayout,
    inspectSlotId,
    inspectSlotFocusFile,
    setInspectSlotFocusFile: (v: string | null) => patchInspect({ inspectSlotFocusFile: v }),
    inspectUnclassifiedFile,
    getZipExportName,
    commitExportName,
    previewByName,
    clearInspect,
    onSlotCardClick,
    onSlotFileClick,
    onUnclassifiedInspectClick,
    dragOver,
    setDragOver,
    handleDrop,
    handleDropToUnclassified,
    setDraggedItem,
    clearDrag: () => {
      setDraggedItem(null);
      setDragOver(null);
    },
    handleDownloadOutput,
    runSeconds,
    addManualSlot,
    removeManualSlot,
    zipNameStamp,
    setZipNameStamp: patchZipNameStamp,
    applyPrefixOnlyZipNames,
    applyAiZipNames,
    resetZipExportNames,
    compactLayout,
    setCompactLayout: patchCompactLayout,
  };
}
'''

# body still contains old handleDownloadOutput - we sliced it in 434-774 which INCLUDES handleDownloadOutput
# Remove duplicate - the chunk 434-774 includes handleDownloadOutput - we'll strip it from body and use footer version

import re

body = re.sub(
    r"  const handleDownloadOutput = useCallback\(async \(\) => \{[\s\S]*?\}, \[resultsLayout, slots.*?\]\);\n\n",
    "",
    body,
    count=1,
)

out = header + "\n" + body + "\n" + footer
out_path = root / "src/hooks/useDoneSessionWorkspace.ts"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(out, encoding="utf-8")
print("wrote", out_path, "lines", len(out.splitlines()))
