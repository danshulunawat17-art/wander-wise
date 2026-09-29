import { useState, type ReactNode } from "react";
import { AlertTriangle, CloudSun, Footprints, Star, Utensils, Landmark, BedDouble, CheckSquare } from "lucide-react";
import { TripMap } from "@/components/TripMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DAY_COLORS, PACKING_CATEGORIES, type Itinerary, type Place } from "@/lib/trip-types";
import { cn } from "@/lib/utils";

export function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function Rating({ p }: { p: Place }) {
  if (!p.rating) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Star className="h-3 w-3 fill-current text-primary" /> {p.rating.toFixed(1)}
      {p.ratingCount ? <span>({p.ratingCount.toLocaleString()})</span> : null}
    </span>
  );
}

export function ItineraryView({ itinerary: it, highlight, toolbar }: { itinerary: Itinerary; highlight?: number[]; toolbar?: ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const hotel = it.hotelId ? it.places[it.hotelId] : undefined;
  const b = it.budget;
  const pct = Math.min(100, (b.total / Math.max(1, b.limit)) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="min-w-0 space-y-6">
        {it.summary && <p className="text-lg leading-relaxed text-muted-foreground">{it.summary}</p>}
        {toolbar}
        <Tabs defaultValue="days">
          <TabsList className="no-print">
            <TabsTrigger value="days">Itinerary</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="packing">Packing</TabsTrigger>
          </TabsList>

          <TabsContent value="days" className="mt-4 space-y-5">
            {hotel && (
              <div className="print-break flex items-start gap-3 rounded-xl border bg-card p-4">
                <BedDouble className="mt-0.5 h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Stay</p>
                  <a href={hotel.mapsUri} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                    {hotel.name}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating p={hotel} />
                    <span className="truncate text-xs text-muted-foreground">{hotel.address}</span>
                  </div>
                </div>
              </div>
            )}
            {it.days.map((d, di) => (
              <section
                key={d.date}
                className={cn(
                  "print-break rounded-xl border bg-card transition-shadow",
                  highlight?.includes(di) && "ring-2 ring-primary/60",
                  active === di && "shadow-md",
                )}
                onMouseEnter={() => setActive(di)}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-primary-foreground" style={{ background: DAY_COLORS[di % DAY_COLORS.length] }}>
                      {di + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight">{d.title ?? `Day ${di + 1}`}</h3>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(d.date)} · {d.pace} · {money(d.dayCost, it.currency)}
                      </p>
                    </div>
                  </div>
                  {d.weather && (
                    <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                      <CloudSun className="h-3.5 w-3.5" />
                      {d.weather.high}° / {d.weather.low}° · {d.weather.condition}
                      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {d.weather.source === "forecast" ? "Forecast" : "Climate avg"}
                      </span>
                    </div>
                  )}
                </header>
                <ol className="divide-y">
                  {d.items.map((i) => {
                    const p = it.places[i.placeId];
                    if (!p) return null;
                    return (
                      <li key={i.id} className="px-4 py-3">
                        {i.transitMin ? (
                          <p className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Footprints className="h-3 w-3" /> ~{i.transitMin} min transit
                          </p>
                        ) : null}
                        <div className="flex gap-3">
                          <div className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{i.time}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {i.kind === "restaurant" ? <Utensils className="h-4 w-4 text-primary" /> : <Landmark className="h-4 w-4 text-accent-foreground" />}
                              <a href={p.mapsUri} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                                {p.name}
                              </a>
                              {i.meal && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{i.meal}</span>}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <Rating p={p} />
                              <span>{i.durationMin} min</span>
                              <span>{i.estCost ? `≈ ${money(i.estCost, it.currency)}` : "Free"}</span>
                            </div>
                            {i.notes && <p className="mt-1 text-sm">{i.notes}</p>}
                            {i.warning && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" /> {i.warning}
                              </p>
                            )}
                            {p.hours && (
                              <details className="no-print mt-1 text-xs text-muted-foreground">
                                <summary className="cursor-pointer">Opening hours</summary>
                                <ul className="mt-1 space-y-0.5">
                                  {p.hours.map((h) => (
                                    <li key={h}>{h}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </TabsContent>

          <TabsContent value="budget" className="mt-4">
            <div className="print-break rounded-xl border bg-card p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated total</p>
                  <p className="font-display text-3xl font-semibold">{money(b.total, it.currency)}</p>
                </div>
                <p className="text-sm text-muted-foreground">of {money(b.limit, it.currency)}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", b.over ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
              {b.warnings.map((w) => (
                <p key={w} className={cn("mt-3 flex items-start gap-2 text-sm", b.over ? "text-destructive" : "text-muted-foreground")}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                </p>
              ))}
              <dl className="mt-5 grid grid-cols-2 gap-3">
                {Object.entries(b.byCategory).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted p-3">
                    <dt className="text-xs capitalize text-muted-foreground">{k}</dt>
                    <dd className="text-lg font-semibold">{money(v, it.currency)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Estimates use Google price levels and typical local costs. Flights aren't included.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="packing" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {PACKING_CATEGORIES.map((c) =>
                it.packing[c]?.length ? (
                  <div key={c} className="print-break rounded-xl border bg-card p-4">
                    <h4 className="flex items-center gap-2 text-base font-semibold capitalize">
                      <CheckSquare className="h-4 w-4 text-primary" /> {c}
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {it.packing[c].map((x) => (
                        <li key={x}>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox /> {x}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="no-print lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button onClick={() => setActive(null)} className={cn("rounded-full border px-2.5 py-1 text-xs", active === null && "bg-foreground text-background")}>
            All days
          </button>
          {it.days.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn("rounded-full border px-2.5 py-1 text-xs", active === i && "text-primary-foreground")}
              style={active === i ? { background: DAY_COLORS[i % DAY_COLORS.length] } : undefined}
            >
              Day {i + 1}
            </button>
          ))}
        </div>
        <div className="h-72 lg:h-[calc(100%-2.5rem)]">
          <TripMap itinerary={it} activeDay={active} />
        </div>
      </aside>
    </div>
  );
}
