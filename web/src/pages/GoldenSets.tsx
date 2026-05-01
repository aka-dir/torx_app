import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Copy, Pencil, Trash2, GripVertical, Pin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { emptySlotsNl } from "@/lib/slotTemplates";
import {
  GoldenSet,
  createGoldenSet,
  deleteGoldenSet,
  duplicateGoldenSet,
  listGoldenSets,
  updateGoldenSet,
} from "@/lib/api";

// Default slot order for a new set — based on the 12 fixed NL buckets.
function defaultCategories(): string[] {
  return emptySlotsNl().map((s) => s.label);
}

export default function GoldenSets() {
  const [sets, setSets] = useState<GoldenSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GoldenSet | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setSets(await listGoldenSets());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon referentiesets niet laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const openNew = () => {
    setEditing(null);
    setDraftName("Nieuwe referentieset");
    setDraftCategories(defaultCategories());
    setEditorOpen(true);
  };

  const openEdit = (s: GoldenSet) => {
    setEditing(s);
    setDraftName(s.name);
    setDraftCategories(s.categories.length ? s.categories : defaultCategories());
    setEditorOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: draftName.trim() || "Naamloos",
        categories: draftCategories.filter((c) => c.trim().length),
        max_per_category: 1,
        stuck_images: [],
      };
      if (editing) {
        await updateGoldenSet(editing.id, body);
        toast.success("Referentieset opgeslagen");
      } else {
        await createGoldenSet(body);
        toast.success("Referentieset aangemaakt");
      }
      setEditorOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: GoldenSet) => {
    if (!confirm(`Referentieset "${s.name}" verwijderen?`)) return;
    try {
      await deleteGoldenSet(s.id);
      toast("Referentieset verwijderd");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verwijderen mislukt");
    }
  };

  const duplicate = async (s: GoldenSet) => {
    try {
      await duplicateGoldenSet(s.id);
      toast.success("Referentieset gedupliceerd");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dupliceren mislukt");
    }
  };

  const moveItem = (from: number, to: number) => {
    setDraftCategories((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const addRow = () => setDraftCategories((prev) => [...prev, "Nieuw vak"]);
  const updateRow = (i: number, v: string) =>
    setDraftCategories((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  const removeRow = (i: number) =>
    setDraftCategories((prev) => prev.filter((_, idx) => idx !== i));

  const slotCountLabel = useMemo(() => (s: GoldenSet) => `${s.categories?.length ?? 0} vakken`, []);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Referentiesets</h1>
            <p className="text-muted-foreground mt-1">
              Een referentieset bepaalt de ideale volgorde van fotovakken voor een type advertentie. Elk vak is één
              beeld.
            </p>
          </div>
          <Button className="gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" /> Nieuwe set
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Laden…
          </div>
        ) : sets.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground">
            Nog geen referentiesets. Maak je eerste set aan via <strong>Nieuwe set</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sets.map((s) => (
              <div
                key={s.id}
                className="border border-border rounded-xl p-5 bg-card hover:torx-shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{s.name}</h3>
                    <p className="text-sm text-muted-foreground">{slotCountLabel(s)}</p>
                  </div>
                  <Badge variant="secondary">{s.categories?.length ?? 0} vakken</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(s)}>
                    <Pencil className="w-3 h-3" /> Bewerken
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => duplicate(s)}>
                    <Copy className="w-3 h-3" /> Dupliceren
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => remove(s)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Referentieset bewerken" : "Nieuwe referentieset"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Naam</Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1"
                  placeholder="Bijv. Standaard personenauto"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Volgorde vakken</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Elk vak = één foto. Gebruik de pijlen om te herschikken.
                </p>
                <div className="space-y-1.5">
                  {draftCategories.map((label, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 bg-card"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs w-6 text-muted-foreground">{i + 1}.</span>
                      <Input
                        value={label}
                        onChange={(e) => updateRow(i, e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => moveItem(i, i - 1)} disabled={i === 0}>
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem(i, i + 1)}
                        disabled={i === draftCategories.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" size="sm" className="gap-1" onClick={addRow}>
                <Plus className="w-3 h-3" /> Vak toevoegen
              </Button>

              <div>
                <Label className="text-sm mb-2 block">Voorbeeld volgorde</Label>
                <div className="flex gap-1 overflow-x-auto py-1">
                  {draftCategories.map((_, i) => (
                    <div
                      key={i}
                      className="w-14 h-10 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground bg-muted"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
                Annuleren
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Opslaan"}
              </Button>
              <span className="sr-only">
                <Pin />
              </span>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
