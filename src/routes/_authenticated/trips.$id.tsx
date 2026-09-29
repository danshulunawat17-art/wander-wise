import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarPlus, History, Link2, Printer, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ItineraryView } from "@/components/ItineraryView";
import { supabase } from "@/integrations/supabase/client";
import { modifyTrip, restoreVersion, shareTrip } from "@/lib/trips.functions";
import { downloadIcs } from "@/lib/ics";
import type { TripRow } from "@/lib/trip-types";

export const Route = createFileRoute("/_authenticated/trips/$id")({
  head: () => ({
    meta: [
      { title: "Your itinerary — Wayfare" },
      { name: "description", content: "Day-by-day plan with map, weather, budget and packing list." },
      { property: "og:title", content: "Your itinerary — Wayfare" },
      { property: "og:description", content: "Day-by-day plan with map, weather, budget and packing list." },
    ],
  }),
  component: TripPage,
});

const SUGGESTIONS = ["Make day 2 more relaxed", "Swap lunch for vegetarian ramen", "Add more outdoor activities", "Make it cheaper"];

function TripPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const modify = useServerFn(modifyTrip);
  const restore = useServerFn(restoreVersion);
  const share = useServerFn(shareTrip);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<number[]>([]);

  const trip = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as TripRow;
    },
  });
  const versions = useQuery({
    queryKey: ["versions", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("trip_versions").select("id,prompt,created_by,created_at").eq("trip_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["trip", id] });
    qc.invalidateQueries({ queryKey: ["versions", id] });
  };

  const runEdit = async (text: string) => {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await modify({ data: { tripId: id, instruction: text.trim() } });
      setPrompt("");
      setHighlight(r.changedDays);
      toast.success(r.explanation);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't update the trip");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    const prev = versions.data?.[1];
    if (!prev) return;
    await restore({ data: { tripId: id, versionId: prev.id } });
    setHighlight([]);
    toast.success("Reverted to the previous version");
    refresh();
  };

  const toggleShare = async () => {
    const t = trip.data!;
    if (t.share_token) {
      const url = `${window.location.origin}/t/${t.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
      return;
    }
    const r = await share({ data: { tripId: id, enable: true } });
    await navigator.clipboard.writeText(`${window.location.origin}/t/${r.token}`);
    toast.success("Read-only link created and copied");
    refresh();
  };

  const stopShare = async () => {
    await share({ data: { tripId: id, enable: false } });
    toast.success("Sharing turned off");
    refresh();
  };

  if (trip.isLoading)
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-6 w-full max-w-xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </main>
    );
  if (trip.error || !trip.data)
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p>Trip not found.</p>
        <Link to="/trips" className="text-primary underline">Back to my trips</Link>
      </main>
    );

  const t = trip.data;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t.destination}</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.start_date} → {t.end_date} · {t.input.adults} adult{t.input.adults > 1 ? "s" : ""}
            {t.input.children ? ` · ${t.input.children} child${t.input.children > 1 ? "ren" : ""}` : ""}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleShare}>
            <Link2 className="mr-1.5 h-4 w-4" /> {t.share_token ? "Copy link" : "Share"}
          </Button>
          {t.share_token && (
            <Button variant="ghost" size="sm" onClick={stopShare}>
              Stop sharing
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadIcs(t.title, t.itinerary)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" /> Calendar
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="mr-1.5 h-4 w-4" /> History
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Version history</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 space-y-2 px-4">
                {versions.data?.map((v, i) => (
                  <li key={v.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{v.prompt ?? "Edit"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()} · {v.created_by === "ai" ? "AI" : "You"}
                    </p>
                    {i > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2"
                        onClick={async () => {
                          await restore({ data: { tripId: id, versionId: v.id } });
                          toast.success("Version restored");
                          refresh();
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-6">
        <ItineraryView
          itinerary={t.itinerary}
          highlight={highlight}
          toolbar={
            <div className="no-print rounded-xl border bg-ink p-3 text-ink-foreground">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runEdit(prompt);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    value={prompt}
                    maxLength={400}
                    disabled={busy}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Modify with AI — e.g. make day 2 more relaxed"
                    className="border-transparent bg-background pl-9 text-foreground"
                  />
                </div>
                <Button type="submit" disabled={busy || prompt.trim().length < 3}>
                  {busy ? "Updating…" : "Apply"}
                </Button>
                <Button type="button" variant="secondary" size="icon" aria-label="Undo last change" disabled={busy || (versions.data?.length ?? 0) < 2} onClick={undo}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} disabled={busy} onClick={() => runEdit(s)} className="rounded-full border border-ink-foreground/20 px-2.5 py-1 text-xs opacity-80 hover:opacity-100">
                    {s}
                  </button>
                ))}
              </div>
              {busy && <div className="mt-2 h-1 overflow-hidden rounded bg-ink-foreground/10"><div className="h-full w-1/3 animate-pulse rounded bg-primary" /></div>}
            </div>
          }
        />
      </div>
    </main>
  );
}
