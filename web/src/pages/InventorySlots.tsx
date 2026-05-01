import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useSorterSession } from "@/context/SorterSessionContext";
import { SorterWorkspaceView } from "@/components/inventory/SorterWorkspaceView";
import { emptySlotsNl, fixedSlotOrdinal } from "@/lib/slotTemplates";
import { cn } from "@/lib/utils";

/**
 * Zonder actieve sessie: leeg referentieraster.
 * Met sessie: dezelfde interactieve resultaat-UI als na het sorteren op Foto’s sorteren.
 */
export default function InventorySlots() {
  const { doneSession, vakkenArchive, setDoneSession, setVakkenArchive } = useSorterSession();
  const slots = emptySlotsNl();
  const hasSession = Boolean((doneSession ?? vakkenArchive)?.files.length);

  const onClearVakken = () => {
    setDoneSession(null);
    setVakkenArchive(null);
    toast.info("Resultaat op Bewerkt verwijderd.");
  };

  if (hasSession) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="max-w-6xl mx-auto w-full pb-6 sm:pb-7 border-b border-border/70">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Bewerkt</h1>
            <p className="mt-3 sm:mt-4 max-w-prose text-sm text-muted-foreground leading-relaxed">
              Zelfde scherm als na het sorteren op <strong className="text-foreground/90">Foto’s sorteren</strong> — wijzigingen
              blijven behouden als je teruggaat naar die pagina.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" asChild>
              <Link to="/sorter">
                Naar foto’s sorteren <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </header>
          <SorterWorkspaceView surface="vakken" onClearVakken={onClearVakken} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto animate-fade-in space-y-8">
        <header className="max-w-6xl mx-auto w-full pb-6 sm:pb-7 border-b border-border/70">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Bewerkt</h1>
          <p className="mt-3 sm:mt-4 max-w-prose text-sm text-muted-foreground leading-relaxed">
            Na een sorteer-run verschijnt hier hetzelfde resultaat-scherm. Start eerst op Foto’s sorteren.
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" asChild>
            <Link to="/sorter">
              Naar foto’s sorteren <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1 max-w-xl">
            <div className="flex flex-col gap-1 max-w-md">
              <Label className="text-xs text-muted-foreground">Weergave na sorteren</Label>
              <div className="h-9 w-full sm:w-[min(100%,22rem)] rounded-md border border-input bg-background px-3 flex items-center text-sm text-muted-foreground">
                Vast raster (twaalf categorieën)
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_min(100%,380px)] gap-8 lg:gap-10">
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {slots.map((s) => {
                const n = fixedSlotOrdinal(s.id);
                return (
                  <div key={s.id} className={cn("border rounded-xl transition-colors border-border p-4 sm:p-5")}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        {n != null ? (
                          <p className="text-[10px] font-mono text-muted-foreground tabular-nums mb-0.5">
                            {n} / 12
                          </p>
                        ) : null}
                        <p className="font-semibold text-foreground text-sm leading-snug truncate" title={s.label}>
                          {s.label}
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2",
                        "min-h-[7rem] sm:min-h-[8rem] bg-muted/15",
                      )}
                    >
                      <div
                        className="rounded-md w-14 h-14 overflow-hidden border border-border flex items-center justify-center shrink-0"
                        style={{ background: s.color }}
                      >
                        <ImageIcon className="w-6 h-6 text-foreground/25" />
                      </div>
                      <span className="text-[11px] sm:text-xs text-muted-foreground text-center px-2">
                        Leeg — sleep een foto
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border rounded-xl p-5 sm:p-6 h-fit lg:sticky lg:top-4 transition-colors border-border">
            <h3 className="font-semibold text-foreground text-sm mb-1">Nog niet ingedeeld</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Sleep naar een vak of zet terug vanuit een vak. Lange lijsten scrollen hier.
            </p>
            <div className="space-y-3 max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain pr-1">
              <p className="text-xs text-muted-foreground italic py-4 text-center">Alles ingedeeld</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
