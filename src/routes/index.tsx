import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Map, Sparkles, Wallet, Luggage, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wayfare — AI Travel Planner with Real Places" },
      {
        name: "description",
        content: "Plan day-by-day trips with real attractions, restaurants and hotels, live weather, a budget breakdown and a packing list.",
      },
      { property: "og:title", content: "Wayfare — AI Travel Planner with Real Places" },
      { property: "og:description", content: "Personalized itineraries from real places, weather and your budget. Edit with AI, share by link." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Map, title: "Real places, real ratings", body: "Every stop comes from Google Maps with verified ratings and opening hours." },
  { icon: CalendarDays, title: "Balanced days", body: "Stops are grouped by neighbourhood with meal breaks and realistic transit times." },
  { icon: Wallet, title: "Honest budgets", body: "Costs are calculated from price levels, with a warning if you go over." },
  { icon: Sparkles, title: "Modify with AI", body: "“Make day 2 more relaxed” — changes only what you ask, with undo." },
  { icon: Luggage, title: "Packing list", body: "Tailored to the forecast, your activities and who's coming." },
  { icon: Share2, title: "Share & export", body: "Read-only links, PDF printouts and calendar files." },
];

function Index() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Smart travel planner</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] md:text-6xl">
            Trips that fit your days, your budget and your taste.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Tell us where, when and what you love. Wayfare builds a day-by-day plan from real places, maps the route and
            keeps the numbers honest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/plan">Plan my trip</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/trips">My trips</Link>
            </Button>
          </div>
        </div>
        <div className="relative">
          <img src={hero} alt="Map, passport and camera laid out for trip planning" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl" />
          <div className="absolute -bottom-5 left-5 rounded-xl border bg-card px-4 py-3 shadow-lg">
            <p className="text-xs text-muted-foreground">Day 2 · Lisbon</p>
            <p className="font-display text-base font-semibold">Alfama & the river</p>
          </div>
        </div>
      </section>
      <section className="border-t bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-background p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
