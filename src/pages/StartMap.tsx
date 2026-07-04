import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/atlas/Logo";
import { Button } from "@/components/ui/button";
import { generateStarterMap, saveStarterMap } from "@/lib/starterMap";

const examples = [
  "Get my first 10 customers for Calrio",
  "Ship the beta of my scheduling app by end of month",
  "Raise a $500k pre-seed round",
  "Hire a founding engineer",
];

export default function StartMap() {
  const nav = useNavigate();
  const [goal, setGoal] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const canSubmit = goal.trim().length >= 4;

  const submit = (value: string) => {
    const map = generateStarterMap(value);
    saveStarterMap(map);
    nav("/map/starter");
  };

  const pickExample = (ex: string) => {
    setSelected(ex);
    setGoal(ex);
    window.setTimeout(() => submit(ex), 260);
  };

  return (
    <div className="min-h-screen bg-background page-fade">
      <header className="container flex h-16 items-center justify-between border-b border-border">
        <Logo />
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back</a>
      </header>

      <main className="container flex min-h-[calc(100vh-64px)] max-w-3xl flex-col justify-center py-16">
        <div className="eyebrow text-primary">One question</div>
        <h1 className="mt-4 font-display text-4xl md:text-6xl leading-[1.05]">
          What are you trying to do?
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          One sentence. Atlas draws the map — no signup required.
        </p>

        <form
          className="mt-10"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit(goal);
          }}
        >
          <textarea
            autoFocus
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Get my first 10 customers for Calrio"
            rows={2}
            className="w-full resize-none rounded-[14px] border border-border bg-card px-5 py-4 font-display text-xl leading-snug outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  data-selected={selected === ex}
                  onClick={() => pickExample(ex)}
                  className="chip rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button type="submit" size="lg" disabled={!canSubmit} className="h-12 px-6 shrink-0">
              Draw the map <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
