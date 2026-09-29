import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DestinationInput } from "@/components/DestinationInput";
import { generateTrip } from "@/lib/trips.functions";
import { CURRENCIES, INTERESTS, type Pace, type TripInput } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan a trip — Wayfare" },
      { name: "description", content: "Tell Wayfare where you're going and get a personalized day-by-day itinerary." },
      { property: "og:title", content: "Plan a trip — Wayfare" },
      { property: "og:description", content: "Tell Wayfare where you're going and get a personalized day-by-day itinerary." },
    ],
  }),
  component: PlanPage,
});

const STEPS = ["Finding your destination", "Gathering top-rated places", "Checking the weather", "Building balanced days", "Crunching the budget", "Writing your packing list"];

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-5 text-center text-sm font-semibold">{value}</span>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`More ${label}`} disabled={value >= 12} onClick={() => onChange(value + 1)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function PlanPage() {
  const generate = useServerFn(generateTrip);
  const navigate = useNavigate();
  const [form, setForm] = useState<TripInput>({
    destination: "",
    startDate: today(14),
    endDate: today(17),
    adults: 2,
    children: 0,
    budget: 2000,
    currency: "USD",
    interests: ["Culture", "Food"],
    pace: "balanced",
    requirements: "",
  });
  const [errors, setErrors] = useState<Partial<Record<"destination"|"dates"|"budget"|"interests", string>>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [busy]);

  const set = <K extends keyof TripInput>(k: K, v: TripInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<"destination"|"dates"|"budget"|"interests", string>> = {};
    if (form.destination.trim().length < 2) e.destination = "Where are you headed?";
    if (!form.startDate || form.startDate < today()) e.dates = "Start date can't be in the past.";
    else if (form.endDate < form.startDate) e.dates = "End date must be on or after the start date.";
    else if ((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86400000 > 13) e.dates = "Trips can be up to 14 days.";
    if (!(form.budget > 0)) e.budget = "Enter a budget above zero.";
    if (!form.interests.length) e.interests = "Pick at least one interest.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const { id } = await generate({ data: { ...form, requirements: form.requirements?.trim() || undefined } });
      navigate({ to: "/trips/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't build your trip");
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Planning {form.destination}</p>
        <h1 className="mt-2 text-3xl font-semibold">{STEPS[step]}…</h1>
        <p className="mt-2 text-sm text-muted-foreground">This usually takes 20–60 seconds.</p>
        <ol className="mt-6 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2 text-sm", i <= step ? "text-foreground" : "text-muted-foreground/60")}>
              <span className={cn("h-2 w-2 rounded-full", i < step ? "bg-primary" : i === step ? "animate-pulse bg-primary" : "bg-border")} />
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-10 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-14 w-full" />
              <Skeleton className="mt-2 h-14 w-full" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold md:text-4xl">Where to next?</h1>
      <p className="mt-2 text-muted-foreground">We'll build a realistic plan from real places near you.</p>
      <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="destination">Destination</Label>
          <DestinationInput value={form.destination} onChange={(v) => set("destination", v)} invalid={!!errors.destination} />
          {errors.destination && <p className="text-sm text-destructive">{errors.destination}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="date" min={today()} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End</Label>
            <Input id="end" type="date" min={form.startDate} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          {errors.dates && <p className="col-span-2 text-sm text-destructive">{errors.dates}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Counter label="Adults" value={form.adults} min={1} onChange={(v) => set("adults", v)} />
          <Counter label="Children" value={form.children} min={0} onChange={(v) => set("children", v)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="budget">Total budget</Label>
          <div className="flex gap-2">
            <Input id="budget" type="number" min={1} inputMode="numeric" value={form.budget || ""} onChange={(e) => set("budget", Number(e.target.value))} />
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger className="w-28" aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Covers hotel, food, activities and local transport (not flights).</p>
          {errors.budget && <p className="text-sm text-destructive">{errors.budget}</p>}
        </div>

        <div className="space-y-2">
          <Label>Interests</Label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = form.interests.includes(i);
              return (
                <button
                  type="button"
                  key={i}
                  aria-pressed={on}
                  onClick={() => set("interests", on ? form.interests.filter((x) => x !== i) : [...form.interests, i])}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                  )}
                >
                  {i}
                </button>
              );
            })}
          </div>
          {errors.interests && <p className="text-sm text-destructive">{errors.interests}</p>}
        </div>

        <div className="space-y-2">
          <Label>Pace</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={form.pace === p}
                onClick={() => set("pace", p)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-sm capitalize transition-colors",
                  form.pace === p ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card",
                )}
              >
                {p}
                <span className="block text-xs font-normal text-muted-foreground">{p === "relaxed" ? "3 stops/day" : p === "balanced" ? "3–4 stops" : "4–5 stops"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="req">Special requirements</Label>
          <Textarea
            id="req"
            maxLength={500}
            placeholder="Vegetarian, wheelchair access, travelling with a toddler…"
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Build my itinerary
        </Button>
      </form>
    </main>
  );
}
