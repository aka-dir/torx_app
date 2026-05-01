import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocalDemoAuth, signIn } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const demo = isLocalDemoAuth;
  const [email, setEmail] = useState(demo ? "demo@torxflow.com" : "");
  const [password, setPassword] = useState(demo ? "demo1234" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate("/sorter"), 800);
  };

  const handleLoginIdp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate("/sorter");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl torx-gradient flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">TorxFlow — foto’s sorteren</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sorteer voertuigfoto’s in de cloud — eenvoudig voor verkoopteams
          </p>
        </div>

        <div className="bg-card rounded-xl torx-shadow-lg p-6 border border-border">
          <form onSubmit={demo ? handleLoginDemo : handleLoginIdp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="jij@garage.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required={!demo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required={!demo}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Bezig met inloggen…" : "Inloggen"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            {demo
              ? "Demo-gegevens zijn ingevuld — klik op Inloggen (lokaal, geen echte auth)."
              : "Beheerd door Identity Platform (Google Cloud)."}
          </p>
        </div>
      </div>
    </div>
  );
}
