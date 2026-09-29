import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarPlus, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ItineraryView } from "@/components/ItineraryView";
import { copySharedTrip, getSharedTrip } from "@/lib/trips.functions";
import { downloadIcs } from "@/lib/ics";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/t/$token")({
  loader: async ({ params }) => {
    if (params.token.length < 20) throw notFound();
    const trip = await getSharedTrip({ data: { token: params.token } });
    if (!trip) throw notFound();
    return { trip };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.trip.title} — shared trip on Wayfare` : "Shared trip — Wayfare";
    const desc = loaderData?.trip.itinerary.summary || "A day-by-day travel itinerary shared from Wayfare.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">This link isn't active</h1>
      <p className="mt-2 text-muted-foreground">The owner may have stopped sharing it.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">Go home</Link>
    </main>
  ),
  errorComponent: () => <main className="mx-auto max-w-md px-4 py-20 text-center">Couldn't load this trip.</main>,
  component: SharedTrip,
});

function SharedTrip() {
  const { trip } = Route.useLoaderData();
  const { token } = Route.useParams();
  const { user } = useAuth();
  const copy = useServerFn(copySharedTrip);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const onCopy = async () => {
    if (!user) return navigate({ to: "/auth", search: { next: `/t/${token}` } });
    setBusy(true);
    try {
      const r = await copy({ data: { token } });
      toast.success("Copied to your trips");
      navigate({ to: "/trips/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Shared itinerary · read-only</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{trip.title}</h1>
          <p className="text-sm text-muted-foreground">
            {trip.destination} · {trip.start_date} → {trip.end_date}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button onClick={onCopy} disabled={busy}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy to my trips
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadIcs(trip.title, trip.itinerary)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" /> Calendar
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <ItineraryView itinerary={trip.itinerary} />
      </div>
    </main>
  );
}
