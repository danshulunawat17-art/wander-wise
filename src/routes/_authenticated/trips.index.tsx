import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({
    meta: [
      { title: "My trips — Wayfare" },
      { name: "description", content: "Your saved AI travel itineraries." },
      { property: "og:title", content: "My trips — Wayfare" },
      { property: "og:description", content: "Your saved AI travel itineraries." },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("id,title,destination,start_date,end_date,share_token").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this trip?")) return;
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["trips"] });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">My trips</h1>
        <Button asChild>
          <Link to="/plan">New trip</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-3">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        {data?.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            No trips yet. <Link to="/plan" className="text-primary underline">Plan your first one</Link>.
          </div>
        )}
        {data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <Link to="/trips/$id" params={{ id: t.id }} className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">{t.title}</p>
              <p className="text-sm text-muted-foreground">
                {t.destination} · {t.start_date} → {t.end_date} {t.share_token && "· Shared"}
              </p>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Delete trip" onClick={() => remove(t.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
