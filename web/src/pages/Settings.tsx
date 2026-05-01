import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Save } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Instellingen</h1>

        <Section title="Accountgegevens">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bedrijfsnaam" defaultValue="AutoHuis Van Dijk" />
            <Field label="Contact e-mail" defaultValue="jan@autohuisvandijk.nl" />
            <Field label="Telefoon" defaultValue="+31 20 555 0123" />
            <Field label="Locatie" defaultValue="Amsterdam, NL" />
          </div>
        </Section>

        <Section title="Standaarden voor sorteren">
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Standaard referentieset</Label>
              <Select defaultValue="standard">
                <SelectTrigger className="mt-1 max-w-xs">
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
            <div className="flex items-center gap-3">
              <Switch id="defEnhance" />
              <Label htmlFor="defEnhance">Afbeeldingen standaard verbeteren</Label>
            </div>
          </div>
        </Section>

        <Section title="Merkprofiel" badge="Concept">
          <p className="text-sm text-muted-foreground mb-4">
            Definieer een merkstijl voor verbeterde beelden — zoals logo-overlays, watermerkpositie en
            exportvoorinstellingen. Geplande functie voor een latere release.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Profielnaam" defaultValue="AutoHuis Standaard" />
            <div>
              <Label className="text-sm">Stijlvoorinstelling export</Label>
              <Select defaultValue="clean">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clean">Strak wit</SelectItem>
                  <SelectItem value="showroom">Showroom</SelectItem>
                  <SelectItem value="outdoor">Exterieur, natuurlijk licht</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Logo uploaden</Label>
              <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Logo kiezen</span>
              </div>
            </div>
            <div>
              <Label className="text-sm">Positie watermerk</Label>
              <Select defaultValue="br">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="br">Rechtsonder</SelectItem>
                  <SelectItem value="bl">Linksonder</SelectItem>
                  <SelectItem value="center">Midden</SelectItem>
                  <SelectItem value="none">Geen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => toast.success("Instellingen opgeslagen")}>
            <Save className="w-4 h-4" /> Instellingen opslaan
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {badge && (
          <Badge variant="outline" className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Input defaultValue={defaultValue} className="mt-1" />
    </div>
  );
}
