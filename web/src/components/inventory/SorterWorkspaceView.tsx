import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDoneSessionWorkspace } from "@/hooks/useDoneSessionWorkspace";
import { ResultsView, SelectedInspectPanel } from "@/components/inventory/SorterResultsPanels";

export function SorterWorkspaceView({
  onClearVakken,
  surface = "sorter",
}: {
  onClearVakken?: () => void;
  surface?: "sorter" | "vakken";
}) {
  const w = useDoneSessionWorkspace(surface);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!w) return null;

  return (
    <>
      <SelectedInspectPanel
        slots={w.displaySlots}
        resultsLayout={w.resultsLayout}
        inspectSlotId={w.inspectSlotId}
        inspectSlotFocusFile={w.inspectSlotFocusFile}
        onFocusSlotFile={w.setInspectSlotFocusFile}
        inspectUnclassifiedFile={w.inspectUnclassifiedFile}
        files={w.files}
        onClose={w.clearInspect}
        getZipExportName={w.getZipExportName}
        onCommitExportName={w.commitExportName}
        previewByName={w.previewByName}
        unclassified={w.activeUnclassified}
      />
      <ResultsView
        slots={w.displaySlots}
        unclassified={w.activeUnclassified}
        resultsLayout={w.resultsLayout}
        onResultsLayoutChange={w.setResultsLayout}
        selectedSlotId={w.inspectSlotId}
        selectedUnclassifiedFile={w.inspectUnclassifiedFile}
        onSlotCardClick={w.onSlotCardClick}
        onSlotFileClick={w.onSlotFileClick}
        onUnclassifiedInspectClick={w.onUnclassifiedInspectClick}
        dragOver={w.dragOver}
        setDragOver={w.setDragOver}
        onDrop={w.handleDrop}
        onDropToUnclassified={w.handleDropToUnclassified}
        onDragStart={w.setDraggedItem}
        onDragEnd={w.clearDrag}
        onDownload={() => void w.handleDownloadOutput(() => setFeedbackOpen(true))}
        onFeedback={() => setFeedbackOpen(true)}
        runSeconds={w.runSeconds}
        onAddManualSlot={w.addManualSlot}
        onRemoveManualSlot={w.removeManualSlot}
        previewByName={w.previewByName}
        zipNameStamp={w.zipNameStamp}
        onZipNameStampChange={w.setZipNameStamp}
        onApplyPrefixZipNames={w.applyPrefixOnlyZipNames}
        onApplyAiZipNames={w.applyAiZipNames}
        onResetZipNames={w.resetZipExportNames}
        compactLayout={w.compactLayout}
        onCompactLayoutChange={w.setCompactLayout}
        onClearVakken={onClearVakken}
        getZipExportName={w.getZipExportName}
      />

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hoe ging het sorteren?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["Klopt goed", "Kan beter", "Verkeerd gecategoriseerd", "Dubbelingen"].map((t) => (
                <Badge key={t} variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
                  {t}
                </Badge>
              ))}
            </div>
            <Textarea placeholder="Extra opmerking (optioneel)…" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>
              Overslaan
            </Button>
            <Button
              onClick={() => {
                setFeedbackOpen(false);
                toast.success("Terugkoppeling verstuurd.");
              }}
            >
              Terugkoppeling versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
