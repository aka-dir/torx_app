import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Images, LayoutGrid, Layers, MessageSquare, Settings, BarChart3, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/sorter", label: "Foto’s sorteren", icon: Images },
  { path: "/slots", label: "Bewerkt", icon: LayoutGrid },
  { path: "/golden-sets", label: "Referentiesets", icon: Layers },
  { path: "/feedback", label: "Terugkoppeling", icon: MessageSquare },
  { path: "/settings", label: "Instellingen", icon: Settings },
  { path: "/dev-dashboard", label: "Ontwikkelaarsdashboard", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border">
          <Link to="/sorter" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg torx-gradient flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-foreground text-lg">TorxFlow</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Uitloggen
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">AutoHuis Van Dijk</span>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Demomodus
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              JD
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
