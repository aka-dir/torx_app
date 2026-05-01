import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const pastFeedback = [
  {
    date: "12 apr. 2026",
    category: "Suggestie",
    text: "Optie om achtergronden bij exterieur automatisch bij te snijden zou fijn zijn.",
    status: "In behandeling",
  },
  {
    date: "8 apr. 2026",
    category: "Sortering",
    text: "Dashboardfoto’s worden soms als ‘voorstoelen’ geclassificeerd.",
    status: "Bevestigd",
  },
  {
    date: "29 mrt. 2026",
    category: "Interface",
    text: "Kan het sleepvlak bij miniaturen groter? Op kleine schermen lastig te pakken.",
    status: "Gepland",
  },
];

export default function FeedbackPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    toast.success("Terugkoppeling verstuurd — bedankt!");
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Terugkoppeling</h1>
        <p className="text-muted-foreground mt-1 mb-6">
          Deel ideeën, meld problemen of stel verbeteringen voor. Uw terugkoppeling helpt het product te verbeteren.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Categorie</Label>
              <Select defaultValue="suggestion">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Foutmelding</SelectItem>
                  <SelectItem value="suggestion">Suggestie</SelectItem>
                  <SelectItem value="ui">Interface</SelectItem>
                  <SelectItem value="sorting">Sortering</SelectItem>
                  <SelectItem value="other">Overig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Uw bericht</Label>
              <Textarea className="mt-1" rows={4} placeholder="Beschrijf uw idee of probleem…" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground max-w-md">
                Nieuwe ideeën worden beoordeeld voor toekomstige verbeteringen.
              </p>
              <Button onClick={handleSubmit} disabled={submitted} className="gap-2 shrink-0">
                {submitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Verstuurd
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Versturen
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-3">Eerdere inzendingen</h2>
        <div className="space-y-3">
          {pastFeedback.map((fb, i) => (
            <div key={i} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {fb.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{fb.date}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {fb.status}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{fb.text}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
