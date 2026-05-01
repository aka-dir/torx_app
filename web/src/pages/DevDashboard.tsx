import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

const kpis = [
  { label: "Actieve garages", value: "38" },
  { label: "Totaal runs", value: "1.247" },
  { label: "Gem. duur run", value: "3,8s" },
  { label: "Gem. handmatige correcties", value: "2,1" },
  { label: "Terugkoppelingen", value: "64" },
];

const weeklyData = [
  { day: "ma", runs: 42 },
  { day: "di", runs: 58 },
  { day: "wo", runs: 65 },
  { day: "do", runs: 49 },
  { day: "vr", runs: 71 },
  { day: "za", runs: 23 },
  { day: "zo", runs: 12 },
];

const monthlyTrend = [
  { month: "jan", accuracy: 78 },
  { month: "feb", accuracy: 81 },
  { month: "mrt", accuracy: 85 },
  { month: "apr", accuracy: 88 },
];

const garages = [
  { name: "AutoHuis Van Dijk", runs: 34, avgTime: "3,2s", corrections: 1.8, goldenSet: "Standaard personenauto", lastActive: "2 uur geleden" },
  { name: "Oranje Select Cars", runs: 28, avgTime: "4,1s", corrections: 2.5, goldenSet: "Premium advertentie", lastActive: "5 uur geleden" },
  { name: "EV Mobility Center", runs: 19, avgTime: "3,9s", corrections: 1.2, goldenSet: "EV-layout", lastActive: "1 dag geleden" },
  { name: "Noord Holland Automotive", runs: 15, avgTime: "4,5s", corrections: 3.1, goldenSet: "Standaard personenauto", lastActive: "3 dagen geleden" },
  { name: "De Beste Auto's", runs: 12, avgTime: "3,6s", corrections: 2.0, goldenSet: "Oldtimer-layout", lastActive: "1 dag geleden" },
];

const recentFeedback = [
  { garage: "Oranje Select Cars", text: "Dashboardfoto’s worden soms met middenconsole verward.", date: "14 apr." },
  { garage: "AutoHuis Van Dijk", text: "Goede resultaten met de nieuwe EV-layout.", date: "13 apr." },
  { garage: "EV Mobility Center", text: "Batch-download van verbeterde beelden zou handig zijn.", date: "11 apr." },
];

export default function DevDashboard() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ontwikkelaarsdashboard</h1>
          <p className="text-muted-foreground mt-1">Intern overzicht: gebruik en productstatistieken.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Runs deze week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="runs" fill="hsl(24 95% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Trend sorteernauwkeurigheid</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="hsl(24 95% 53%)" strokeWidth={2} dot={{ fill: "hsl(24 95% 53%)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Garage Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Garages overzicht</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Garage", "Runs (week)", "Gem. duur", "Gem. correcties", "Referentieset", "Laatst actief"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {garages.map((g) => (
                  <tr key={g.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{g.name}</td>
                    <td className="px-5 py-3 text-foreground">{g.runs}</td>
                    <td className="px-5 py-3 text-muted-foreground">{g.avgTime}</td>
                    <td className="px-5 py-3 text-muted-foreground">{g.corrections}</td>
                    <td className="px-5 py-3"><Badge variant="outline" className="text-xs">{g.goldenSet}</Badge></td>
                    <td className="px-5 py-3 text-muted-foreground">{g.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Recente terugkoppelingen</h3>
          <div className="space-y-3">
            {recentFeedback.map((fb, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-medium text-muted-foreground">
                  {fb.garage.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{fb.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fb.garage} · {fb.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
