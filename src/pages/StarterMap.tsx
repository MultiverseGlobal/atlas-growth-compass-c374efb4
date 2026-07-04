import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plug } from "lucide-react";
import { Logo } from "@/components/atlas/Logo";
import { Button } from "@/components/ui/button";
import { Trail } from "@/components/atlas/Trail";
import { loadStarterMap, type StarterMap } from "@/lib/starterMap";

export default function StarterMapPage() {
  const nav = useNavigate();
  const [map, setMap] = useState<StarterMap | null>(null);

  useEffect(() => {
    const loaded = loadStarterMap();
    if (!loaded) {
      nav("/start", { replace: true });
      return;
    }
    setMap(loaded);
  }, [nav]);

  if (!map) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="container flex h-16 items-center justify-between border-b border-border">
        <Logo />
        <Link to="/start" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Redraw
        </Link>
      </header>

      <main className="container max-w-3xl py-14">
        <div className="eyebrow text-primary">Starter map</div>
        <h1 className="mt-3 font-display text-3xl md:text-4xl leading-tight">
          {map.goalStatement}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Emerging confidence — connect a source to sharpen each waypoint.
        </p>

        <div className="mt-14">
          <Trail waypoints={map.waypoints} />
        </div>

        <div className="mt-16 rounded-[16px] border border-border bg-card p-6 md:p-8">
          <div className="eyebrow text-primary">Sharpen this map</div>
          <h2 className="mt-2 font-display text-2xl leading-snug">
            Connect a source to make it real.
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button className="h-11 px-5">
                <Plug className="mr-2 h-4 w-4" /> Connect a source
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" className="h-11 px-5">Save this map</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
