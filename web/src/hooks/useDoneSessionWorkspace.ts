import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSorterSession, type ResultsLayoutMode, type SorterDoneSession } from "@/context/SorterSessionContext";
import type { InventorySlot as Slot, InventoryUnclassified as Unclassified } from "@/lib/inventoryClassify";
import type { LabelGroup } from "@/features/inventory-product";
import { downloadSortedZip, safePathSegment } from "@/lib/downloadSortOutput";
import {
  buildCategoryUniqueZipNames,
  buildPrefixOnlyZipNames,
  resolveSessionZipExportNames,
  unclassifiedRowsForZipExport,
} from "@/lib/zipExportNames";
import {
  fixedSlotsAndLooseFromLabelGroups,
  labelGroupGridTitle,
  mergeInventoryUnclassifiedDedupe,
} from "@/lib/inventoryClassify";
import { groupRowSlotId } from "@/lib/slotTemplates";
import { isManualSlotId, type SlotDragPayload, MANUAL_SLOT_PREFIX } from "@/components/inventory/SorterResultsPanels";

export function useDoneSessionWorkspace(surface: "sorter" | "vakken" = "sorter") {
  const { doneSession, setDoneSession, vakkenArchive, setVakkenArchive } = useSorterSession();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<SlotDragPayload | null>(null);
  const clearDrag = useCallback(() => {
    setDraggedItem(null);
    setDragOver(null);
  }, []);

  const doneRef = useRef(doneSession);
  const archRef = useRef(vakkenArchive);
  doneRef.current = doneSession;
  archRef.current = vakkenArchive;

  const applyToActiveSession = useCallback(
    (fn: (p: SorterDoneSession) => SorterDoneSession) => {
      if (surface === "sorter") {
        setDoneSession((p) => (p ? fn(p) : p));
        return;
      }
      const d = doneRef.current;
      if (d) {
        setDoneSession((p) => (p ? fn(p) : p));
      } else {
        setVakkenArchive((a) => (a ? fn(a) : a));
      }
    },
    [surface, setDoneSession, setVakkenArchive],
  );

  const patchSlots = useCallback(
    (fn: (prev: Slot[]) => Slot[]) => {
      applyToActiveSession((p) => ({ ...p, slots: fn(p.slots) }));
    },
    [applyToActiveSession],
  );
  const patchUnclassified = useCallback(
    (fn: (prev: Unclassified[]) => Unclassified[]) => {
      applyToActiveSession((p) => ({ ...p, unclassified: fn(p.unclassified) }));
    },
    [applyToActiveSession],
  );
  const patchLabelGroups = useCallback(
    (fn: (prev: LabelGroup[]) => LabelGroup[]) => {
      applyToActiveSession((p) => ({ ...p, labelGroups: fn(p.labelGroups) }));
    },
    [applyToActiveSession],
  );
  const patchGroupsUnclassified = useCallback(
    (fn: (prev: Unclassified[]) => Unclassified[]) => {
      applyToActiveSession((p) => ({ ...p, groupsUnclassified: fn(p.groupsUnclassified) }));
    },
    [applyToActiveSession],
  );
  const patchExportNames = useCallback(
    (fn: (prev: Record<string, string>) => Record<string, string>) => {
      applyToActiveSession((p) => ({ ...p, exportNames: fn(p.exportNames) }));
    },
    [applyToActiveSession],
  );
  const patchResultsLayout = useCallback(
    (v: ResultsLayoutMode) => {
      applyToActiveSession((p) => {
        if (v === p.resultsLayout) return p;
        if (v === "fixed" && p.resultsLayout === "groups") {
          const uBase = mergeInventoryUnclassifiedDedupe(p.unclassified, p.groupsUnclassified);
          const { slots: nextSlots, loose } = fixedSlotsAndLooseFromLabelGroups(p.slots, p.labelGroups);
          const unclassified = mergeInventoryUnclassifiedDedupe(uBase, loose);
          return { ...p, slots: nextSlots, unclassified, groupsUnclassified: [], resultsLayout: "fixed" };
        }
        if (v === "groups" && p.resultsLayout === "fixed") {
          const u = mergeInventoryUnclassifiedDedupe(p.unclassified, p.groupsUnclassified);
          return { ...p, unclassified: u, groupsUnclassified: u, resultsLayout: "groups" };
        }
        return { ...p, resultsLayout: v };
      });
    },
    [applyToActiveSession],
  );
  const patchZipNameStamp = useCallback(
    (v: string) => {
      applyToActiveSession((p) => ({ ...p, zipNameStamp: v }));
    },
    [applyToActiveSession],
  );
  const patchCompactLayout = useCallback(
    (v: boolean) => {
      applyToActiveSession((p) => ({ ...p, compactLayout: v }));
    },
    [applyToActiveSession],
  );
  const patchInspect = useCallback(
    (patch: Partial<{
      inspectSlotId: string | null;
      inspectSlotFocusFile: string | null;
      inspectUnclassifiedFile: string | null;
    }>) => {
      applyToActiveSession((p) => ({ ...p, ...patch }));
    },
    [applyToActiveSession],
  );

  const baseSession = surface === "sorter" ? doneSession : (doneSession ?? vakkenArchive);
  const resultsLayout = baseSession?.resultsLayout ?? "fixed";
  const slots = baseSession?.slots ?? [];
  const unclassified = baseSession?.unclassified ?? [];
  const labelGroups = baseSession?.labelGroups ?? [];
  const groupsUnclassified = baseSession?.groupsUnclassified ?? [];
  const files = baseSession?.files ?? [];
  const fileModelLabels = baseSession?.fileModelLabels;
  const fileClassifyLabels = baseSession?.fileClassifyLabels;
  const exportNames = baseSession?.exportNames ?? {};
  const zipNameStamp = baseSession?.zipNameStamp ?? "";
  const zipUseSuggestedNames = baseSession?.zipUseSuggestedNames;
  const zipSuggestedKind = baseSession?.zipSuggestedKind;
  const vehicleNote = baseSession?.vehicleNote;
  const runSeconds = baseSession?.runSeconds ?? null;
  const compactLayout = baseSession?.compactLayout ?? false;
  const inspectSlotId = baseSession?.inspectSlotId ?? null;
  const inspectSlotFocusFile = baseSession?.inspectSlotFocusFile ?? null;
  const inspectUnclassifiedFile = baseSession?.inspectUnclassifiedFile ?? null;

  const displaySlots = useMemo((): Slot[] => {
    if (resultsLayout !== "groups") return slots;
    const manualOnly = slots.filter((s) => isManualSlotId(s.id));
    const allKeys = labelGroups.map((g) => g.label);
    const fromGroups = labelGroups.map((g) => ({
      id: groupRowSlotId(g.label),
      label: labelGroupGridTitle(g.label, allKeys),
      color: g.color,
      files: g.files,
      slotHint: null as string | null,
    }));
    return [...fromGroups, ...manualOnly];
  }, [resultsLayout, slots, labelGroups]);

  const activeUnclassified = resultsLayout === "groups" ? groupsUnclassified : unclassified;

  // Granular deps so inspect/compact changes don't invalidate export name map.
  const resolvedZipNamesForUi = useMemo(() => {
    if (files.length === 0) return undefined;
    return resolveSessionZipExportNames({
      resultsLayout,
      slots,
      labelGroups,
      unclassified,
      groupsUnclassified,
      files,
      fileModelLabels,
      fileClassifyLabels,
      exportNames,
      zipNameStamp,
      zipUseSuggestedNames,
      zipSuggestedKind,
      vehicleNote,
    });
  }, [
    resultsLayout, slots, labelGroups, unclassified, groupsUnclassified,
    files, fileModelLabels, fileClassifyLabels, exportNames, zipNameStamp,
    zipUseSuggestedNames, zipSuggestedKind, vehicleNote,
  ]);

  const getZipExportName = useCallback(
    (original: string) => resolvedZipNamesForUi?.[original] ?? original,
    [resolvedZipNamesForUi],
  );

  const commitExportName = useCallback(
    (original: string, rawNext: string): boolean => {
      const trimmed = rawNext.trim();
      if (!trimmed) {
        toast.error("Naam mag niet leeg zijn.");
        return false;
      }
      const next = safePathSegment(trimmed) || "bestand";
      let rejected = false;
      patchExportNames((prev) => {
        const merged = { ...prev };
        if (next === original) {
          delete merged[original];
        } else {
          merged[original] = next;
        }
        const zipSuggested = zipUseSuggestedNames === true;
        const resolvedFor = (name: string): string => {
          if (!zipSuggested) return merged[name] ?? name;
          const t = resolveSessionZipExportNames({
            resultsLayout,
            slots,
            labelGroups,
            unclassified,
            groupsUnclassified,
            files,
            fileModelLabels,
            fileClassifyLabels,
            exportNames: merged,
            zipNameStamp,
            zipUseSuggestedNames: true,
            zipSuggestedKind: zipSuggestedKind ?? "category",
            vehicleNote,
          });
          return t?.[name] ?? name;
        };
        const dOrig = resolvedFor(original);
        for (const s of slots) {
          for (const f of s.files) {
            if (f === original) continue;
            if (resolvedFor(f) === dOrig) {
              rejected = true;
              return prev;
            }
          }
        }
        for (const u of unclassified) {
          if (u.name === original) continue;
          if (resolvedFor(u.name) === dOrig) {
            rejected = true;
            return prev;
          }
        }
        for (const g of labelGroups) {
          for (const f of g.files) {
            if (f === original) continue;
            if (resolvedFor(f) === dOrig) {
              rejected = true;
              return prev;
            }
          }
        }
        for (const u of groupsUnclassified) {
          if (u.name === original) continue;
          if (resolvedFor(u.name) === dOrig) {
            rejected = true;
            return prev;
          }
        }
        return merged;
      });
      if (rejected) {
        toast.error("Die naam is al in gebruik voor een andere foto.");
        return false;
      }
      return true;
    },
    [
      slots, unclassified, labelGroups, groupsUnclassified, patchExportNames,
      zipUseSuggestedNames, zipSuggestedKind, vehicleNote, fileClassifyLabels,
      resultsLayout, files, fileModelLabels, zipNameStamp,
    ],
  );

  const applyAiZipNames = useCallback(() => {
    const unc = unclassifiedRowsForZipExport(unclassified, groupsUnclassified);
    const layout = resultsLayout === "groups" ? "groups" : "fixed";
    const next = buildCategoryUniqueZipNames(layout, slots, labelGroups, unc, {
      fileNamePrefix: zipNameStamp,
      allSourceFileNames: files.map((f) => f.name),
      modelLabelByFileName: fileModelLabels,
      sessionVehicleNote: vehicleNote,
      apiClassifyLabelByFileName: fileClassifyLabels,
    });
    if (Object.keys(next).length === 0) {
      toast.error("Geen foto’s om te hernoemen.");
      return;
    }
    applyToActiveSession((p) => ({
      ...p,
      exportNames: {},
      zipUseSuggestedNames: true,
      zipSuggestedKind: "category",
    }));
    toast.success("Voorvoegsel en modelnamen voor de export toegepast.");
  }, [
    resultsLayout,
    slots,
    labelGroups,
    unclassified,
    groupsUnclassified,
    zipNameStamp,
    files,
    fileModelLabels,
    applyToActiveSession, vehicleNote, fileClassifyLabels,
  ]);

  const applyPrefixOnlyZipNames = useCallback(() => {
    if (!zipNameStamp.trim()) {
      toast.error("Vul een voorvoegsel in (bijv. Voorraad_2026).");
      return;
    }
    const unc = unclassifiedRowsForZipExport(unclassified, groupsUnclassified);
    const layout = resultsLayout === "groups" ? "groups" : "fixed";
    const next = buildPrefixOnlyZipNames(layout, slots, labelGroups, unc, {
      fileNamePrefix: zipNameStamp,
      allSourceFileNames: files.map((f) => f.name),
      modelLabelByFileName: fileModelLabels,
      sessionVehicleNote: vehicleNote,
    });
    if (Object.keys(next).length === 0) {
      toast.error("Geen foto’s om te hernoemen.");
      return;
    }
    applyToActiveSession((p) => ({
      ...p,
      exportNames: {},
      zipUseSuggestedNames: true,
      zipSuggestedKind: "prefix",
    }));
    toast.success("Alleen voorvoegsel toegepast (namen bewerken).");
  }, [
    resultsLayout,
    slots,
    labelGroups,
    unclassified,
    groupsUnclassified,
    zipNameStamp,
    files,
    fileModelLabels,
    applyToActiveSession, vehicleNote,
  ]);

  const resetZipExportNames = useCallback(() => {
    applyToActiveSession((p) => ({
      ...p,
      exportNames: {},
      zipUseSuggestedNames: false,
      zipSuggestedKind: undefined,
    }));
    toast.info("Naamwijzigingen gewist — export gebruikt weer de oorspronkelijke bestandsnamen.");
  }, [applyToActiveSession]);

  const onSlotCardClick = useCallback(
    (slotId: string) => {
      applyToActiveSession((p) => {
        if (p.inspectSlotId === slotId) {
          return { ...p, inspectSlotId: null, inspectSlotFocusFile: null, inspectUnclassifiedFile: null };
        }
        let firstFile: string | null = null;
        if (p.resultsLayout === "groups") {
          const group = p.labelGroups.find((g) => groupRowSlotId(g.label) === slotId);
          if (group) firstFile = group.files[0] ?? null;
          else firstFile = p.slots.find((s) => s.id === slotId)?.files[0] ?? null;
        } else {
          firstFile = p.slots.find((s) => s.id === slotId)?.files[0] ?? null;
        }
        return { ...p, inspectUnclassifiedFile: null, inspectSlotId: slotId, inspectSlotFocusFile: firstFile };
      });
    },
    [applyToActiveSession],
  );

  const onSlotFileClick = useCallback(
    (slotId: string, fileName: string) => {
      patchInspect({
        inspectUnclassifiedFile: null,
        inspectSlotId: slotId,
        inspectSlotFocusFile: fileName,
      });
    },
    [patchInspect],
  );

  const onUnclassifiedInspectClick = useCallback(
    (name: string) => {
      applyToActiveSession((p) => {
        const next = p.inspectUnclassifiedFile === name ? null : name;
        return {
          ...p,
          inspectSlotId: null,
          inspectSlotFocusFile: null,
          inspectUnclassifiedFile: next,
        };
      });
    },
    [applyToActiveSession],
  );

  const setInspectSlotFocusFile = useCallback(
    (v: string | null) => patchInspect({ inspectSlotFocusFile: v }),
    [patchInspect],
  );

  const clearInspect = useCallback(() => {
    patchInspect({
      inspectSlotId: null,
      inspectSlotFocusFile: null,
      inspectUnclassifiedFile: null,
    });
  }, [patchInspect]);
  const filePlacedAnywhere = useCallback(
    (fileName: string) => {
      if (slots.some((s) => s.files.includes(fileName))) return true;
      if (labelGroups.some((g) => g.files.includes(fileName))) return true;
      return false;
    },
    [slots, labelGroups],
  );

  const handleDrop = (slotId: string) => {
    setDragOver(null);
    if (!draggedItem) return;

    if (resultsLayout === "groups") {
      if (isManualSlotId(slotId)) {
        const targetExists = slots.some((s) => s.id === slotId);
        if (!targetExists) {
          setDraggedItem(null);
          return;
        }

        if (draggedItem.source === "unclassified") {
          const { fileName } = draggedItem;
          if (!groupsUnclassified.some((u) => u.name === fileName)) {
            setDraggedItem(null);
            return;
          }
          if (filePlacedAnywhere(fileName)) {
            toast.info("Deze bestandsnaam staat al ergens in het raster.");
            setDraggedItem(null);
            return;
          }
          patchGroupsUnclassified((prev) => prev.filter((u) => u.name !== fileName));
          patchSlots((prev) =>
            prev.map((s) => {
              if (isManualSlotId(s.id)) {
                return s.id === slotId && !s.files.includes(fileName)
                  ? { ...s, files: [...s.files, fileName] }
                  : s;
              }
              return { ...s, files: s.files.filter((f) => f !== fileName) };
            }),
          );
          const tl = slots.find((s) => s.id === slotId)?.label ?? "handmatig vak";
          toast.success(`${fileName} → ${tl}`);
          setDraggedItem(null);
          return;
        }

        const { slotId: fromId, fileName: fn } = draggedItem;

        if (fromId === slotId) {
          setDraggedItem(null);
          return;
        }

        if (fromId.startsWith("g:")) {
          const fromLabel = fromId.slice(2);
          const src = labelGroups.find((g) => g.label === fromLabel);
          if (!src?.files.includes(fn)) {
            setDraggedItem(null);
            return;
          }
          if (slots.find((s) => s.id === slotId)?.files.includes(fn)) {
            toast.info("Dit bestand staat al in het doelvak.");
            setDraggedItem(null);
            return;
          }
          patchLabelGroups((prev) =>
            prev.map((g) => (g.label === fromLabel ? { ...g, files: g.files.filter((f) => f !== fn) } : g)),
          );
          patchSlots((prev) =>
            prev.map((s) => {
              if (isManualSlotId(s.id)) {
                return s.id === slotId && !s.files.includes(fn) ? { ...s, files: [...s.files, fn] } : s;
              }
              return { ...s, files: s.files.filter((f) => f !== fn) };
            }),
          );
          toast.success("Verplaatst.");
          setDraggedItem(null);
          return;
        }

        if (isManualSlotId(fromId)) {
          const sourceSlot = slots.find((s) => s.id === fromId);
          if (!sourceSlot?.files.includes(fn)) {
            setDraggedItem(null);
            return;
          }
          if (slots.find((s) => s.id === slotId)?.files.includes(fn)) {
            toast.info("Dit bestand staat al in het doelvak.");
            setDraggedItem(null);
            return;
          }
          patchSlots((prev) =>
            prev.map((s) => {
              if (s.id === fromId) return { ...s, files: s.files.filter((f) => f !== fn) };
              if (s.id === slotId && !s.files.includes(fn)) return { ...s, files: [...s.files, fn] };
              return s;
            }),
          );
          toast.success("Verplaatst.");
          setDraggedItem(null);
          return;
        }

        setDraggedItem(null);
        return;
      }

      if (!slotId.startsWith("g:")) {
        setDraggedItem(null);
        return;
      }
      const targetLabel = slotId.slice(2);
      const targetGroup = labelGroups.find((g) => g.label === targetLabel);
      if (!targetGroup) {
        setDraggedItem(null);
        return;
      }

      const { fileName } = draggedItem;

      if (draggedItem.source === "unclassified") {
        if (!groupsUnclassified.some((u) => u.name === fileName)) {
          setDraggedItem(null);
          return;
        }
        if (filePlacedAnywhere(fileName)) {
          toast.info("Deze bestandsnaam staat al ergens in het raster.");
          setDraggedItem(null);
          return;
        }
        patchGroupsUnclassified((prev) => prev.filter((u) => u.name !== fileName));
        patchSlots((prev) =>
          prev.map((s) =>
            isManualSlotId(s.id) ? s : { ...s, files: s.files.filter((f) => f !== fileName) },
          ),
        );
        patchLabelGroups((prev) =>
          prev.map((g) => (g.label === targetLabel ? { ...g, files: [...g.files, fileName] } : g)),
        );
        toast.success(`${fileName} → ${labelGroupGridTitle(targetLabel, labelGroups.map((g) => g.label))}`);
      } else {
        const { slotId: fromId, fileName: fn } = draggedItem;
        if (fromId === slotId) {
          setDraggedItem(null);
          return;
        }

        if (isManualSlotId(fromId)) {
          const sourceSlot = slots.find((s) => s.id === fromId);
          if (!sourceSlot?.files.includes(fn)) {
            setDraggedItem(null);
            return;
          }
          if (targetGroup.files.includes(fn)) {
            toast.info("Dit bestand staat al in het doel.");
            setDraggedItem(null);
            return;
          }
          patchSlots((prev) =>
            prev.map((s) => {
              if (isManualSlotId(s.id)) {
                return s.id === fromId ? { ...s, files: s.files.filter((f) => f !== fn) } : s;
              }
              return { ...s, files: s.files.filter((f) => f !== fn) };
            }),
          );
          patchLabelGroups((prev) =>
            prev.map((g) => (g.label === targetLabel ? { ...g, files: [...g.files, fn] } : g)),
          );
          toast.success("Verplaatst.");
          setDraggedItem(null);
          return;
        }

        const fromLabel = fromId.startsWith("g:") ? fromId.slice(2) : null;
        if (!fromLabel) {
          setDraggedItem(null);
          return;
        }
        const src = labelGroups.find((g) => g.label === fromLabel);
        if (!src?.files.includes(fn)) {
          setDraggedItem(null);
          return;
        }
        if (targetGroup.files.includes(fn)) {
          toast.info("Dit bestand staat al in het doel.");
          setDraggedItem(null);
          return;
        }
        patchLabelGroups((prev) =>
          prev.map((g) => {
            if (g.label === fromLabel) return { ...g, files: g.files.filter((f) => f !== fn) };
            if (g.label === targetLabel) {
              if (g.files.includes(fn)) return g;
              return { ...g, files: [...g.files, fn] };
            }
            return g;
          }),
        );
        patchSlots((prev) =>
          prev.map((s) =>
            isManualSlotId(s.id) ? s : { ...s, files: s.files.filter((f) => f !== fn) },
          ),
        );
        toast.success("Verplaatst.");
      }
      setDraggedItem(null);
      return;
    }

    const targetSlot = slots.find((s) => s.id === slotId);
    if (!targetSlot) return;

    if (draggedItem.source === "unclassified") {
      const { fileName } = draggedItem;
      if (!unclassified.some((u) => u.name === fileName)) return;
      if (slots.some((s) => s.files.includes(fileName))) {
        toast.info("Deze bestandsnaam staat al in een vak — niet opnieuw toegevoegd.");
        setDraggedItem(null);
        return;
      }
      patchSlots((prev) =>
        prev.map((s) => {
          if (s.id !== slotId) return s;
          if (s.files.includes(fileName)) return s;
          return { ...s, files: [...s.files, fileName] };
        }),
      );
      patchUnclassified((prev) => prev.filter((u) => u.name !== fileName));
      toast.success(`${fileName} geplaatst in: ${targetSlot.label}`);
    } else {
      const { slotId: fromId, fileName } = draggedItem;
      if (fromId === slotId) {
        setDraggedItem(null);
        return;
      }
      const sourceSlot = slots.find((s) => s.id === fromId);
      if (!sourceSlot?.files.includes(fileName)) return;
      if (slots.find((s) => s.id === slotId)?.files.includes(fileName)) {
        toast.info("Dit bestand staat al in het doelvak.");
        setDraggedItem(null);
        return;
      }
      patchSlots((prev) =>
        prev.map((s) => {
          if (s.id === fromId) return { ...s, files: s.files.filter((f) => f !== fileName) };
          if (s.id === slotId) {
            if (s.files.includes(fileName)) return s;
            return { ...s, files: [...s.files, fileName] };
          }
          return s;
        }),
      );
      toast.success("Verplaatst.");
    }
    setDraggedItem(null);
  };

  const handleDropToUnclassified = () => {
    setDragOver(null);
    if (!draggedItem || draggedItem.source !== "slot") return;
    const { slotId: fromSlotId, fileName } = draggedItem;

    if (resultsLayout === "groups") {
      if (fromSlotId.startsWith("g:")) {
        const fromLabel = fromSlotId.slice(2);
        const src = labelGroups.find((g) => g.label === fromLabel);
        if (!src?.files.includes(fileName)) return;
        const color = src.color;
        patchLabelGroups((prev) =>
          prev.map((g) => (g.label === fromLabel ? { ...g, files: g.files.filter((f) => f !== fileName) } : g)),
        );
        patchGroupsUnclassified((prev) => [
          ...prev,
          { name: fileName, reason: "Teruggezet uit een gecategoriseerde kolom (nog niet ingedeeld).", color },
        ]);
        toast.success("Terug naar ‘nog niet ingedeeld’");
        setDraggedItem(null);
        return;
      }
      if (isManualSlotId(fromSlotId)) {
        const sourceSlot = slots.find((s) => s.id === fromSlotId);
        if (!sourceSlot?.files.includes(fileName)) return;
        const color = sourceSlot.color;
        patchSlots((prev) =>
          prev.map((s) =>
            s.id === fromSlotId ? { ...s, files: s.files.filter((f) => f !== fileName) } : s,
          ),
        );
        patchGroupsUnclassified((prev) => [
          ...prev,
          {
            name: fileName,
            reason: "Teruggezet uit een handmatig vak (nog niet ingedeeld).",
            color,
          },
        ]);
        toast.success("Terug naar ‘nog niet ingedeeld’");
        setDraggedItem(null);
      }
      return;
    }

    const sourceSlot = slots.find((s) => s.id === fromSlotId);
    if (!sourceSlot?.files.includes(fileName)) return;
    const color = sourceSlot.color;
    patchSlots((prev) =>
      prev.map((s) => (s.id === fromSlotId ? { ...s, files: s.files.filter((f) => f !== fileName) } : s)),
    );
    patchUnclassified((prev) => [
      ...prev,
      { name: fileName, reason: "Teruggezet uit een vak (nog niet ingedeeld).", color },
    ]);
    toast.success("Terug naar ‘nog niet ingedeeld’");
    setDraggedItem(null);
  };

  const addManualSlot = useCallback((label: string) => {
    const trimmed = label.trim() || "Handmatig vak";
    const id = `${MANUAL_SLOT_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const hue = Math.floor(Math.random() * 360);
    patchSlots((prev) => [...prev, { id, label: trimmed, color: `hsl(${hue} 52% 87%)`, files: [] }]);
    toast.success("Handmatig vak toegevoegd");
  }, []);

  const removeManualSlot = useCallback(
    (id: string) => {
      if (!isManualSlotId(id)) return;
      applyToActiveSession((p) => {
        const slot = p.slots.find((s) => s.id === id);
        const orphans = slot?.files ?? [];
        const color = slot?.color ?? "hsl(45 70% 88%)";
        const nextSlots = p.slots.filter((s) => s.id !== id);
        if (orphans.length === 0) {
          return { ...p, slots: nextSlots };
        }
        const rows: Unclassified[] = orphans.map((name) => ({
          name,
          reason: "Handmatig vak verwijderd — opnieuw indelen.",
          color,
        }));
        if (p.resultsLayout === "groups") {
          const gu = mergeInventoryUnclassifiedDedupe(p.groupsUnclassified, rows);
          return { ...p, slots: nextSlots, groupsUnclassified: gu, unclassified: mergeInventoryUnclassifiedDedupe(p.unclassified, rows) };
        }
        const u = mergeInventoryUnclassifiedDedupe(p.unclassified, rows);
        return { ...p, slots: nextSlots, unclassified: u, groupsUnclassified: mergeInventoryUnclassifiedDedupe(p.groupsUnclassified, rows) };
      });
      toast.info("Handmatig vak verwijderd");
    },
    [applyToActiveSession],
  );

  useEffect(() => {
    if (!inspectSlotId) return;
    const s = displaySlots.find((x) => x.id === inspectSlotId);
    if (!s) {
      patchInspect({ inspectSlotId: null, inspectSlotFocusFile: null });
      return;
    }
    if (s.files.length === 0) {
      patchInspect({ inspectSlotFocusFile: null });
      return;
    }
    applyToActiveSession((p) => {
      const prevF = p.inspectSlotFocusFile;
      const nextF = prevF && s.files.includes(prevF) ? prevF : s.files[0];
      if (nextF === prevF) return p;
      return { ...p, inspectSlotFocusFile: nextF };
    });
  }, [displaySlots, inspectSlotId, patchInspect, applyToActiveSession]);

  // Preview URLs keyed by file name.  Only depends on `files` so that slot/group
  // mutations (drag-drop, inspect, layout switch) do NOT recreate every object URL.
  const previewByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of files) {
      map.set(f.name, URL.createObjectURL(f));
    }
    return map;
  }, [files]);

  useEffect(() => {
    const urls = [...previewByName.values()];
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewByName]);

  const handleDownloadOutput = useCallback(
    async (openFeedback: () => void) => {
      if (!baseSession) return;
      try {
        const exportNamesForZip = resolveSessionZipExportNames(baseSession);
        if (baseSession.resultsLayout === "groups") {
          await downloadSortedZip({
            mode: "groups",
            slots: [],
            manualSlots: baseSession.slots.filter((s) => isManualSlotId(s.id)),
            groupOrphanSlots: baseSession.slots,
            groups: baseSession.labelGroups,
            unclassified: baseSession.groupsUnclassified,
            files: baseSession.files,
            apiClassifyLabelByFileName: baseSession.fileClassifyLabels,
            exportNames: exportNamesForZip,
          });
        } else {
          await downloadSortedZip({
            mode: "slots",
            slots: baseSession.slots,
            groups: null,
            unclassified: baseSession.unclassified,
            files: baseSession.files,
            apiClassifyLabelByFileName: baseSession.fileClassifyLabels,
            exportNames: exportNamesForZip,
          });
        }
        toast.success("ZIP gedownload.");
        setTimeout(() => openFeedback(), 500);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Download mislukt");
      }
    },
    [baseSession],
  );

  if (!baseSession?.files.length) return null;

  return {
    displaySlots,
    activeUnclassified,
    files,
    resultsLayout,
    setResultsLayout: patchResultsLayout,
    inspectSlotId,
    inspectSlotFocusFile,
    setInspectSlotFocusFile,
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
    clearDrag,
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
