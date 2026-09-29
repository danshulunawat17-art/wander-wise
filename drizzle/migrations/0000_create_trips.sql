CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  destination text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  input jsonb NOT NULL,
  itinerary jsonb NOT NULL,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trips select" ON public.trips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trips insert" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own trips update" ON public.trips FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trips delete" ON public.trips FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.trip_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  itinerary jsonb NOT NULL,
  created_by text NOT NULL DEFAULT 'user',
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.trip_versions TO authenticated;
GRANT ALL ON public.trip_versions TO service_role;
ALTER TABLE public.trip_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own versions select" ON public.trip_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own versions insert" ON public.trip_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own versions delete" ON public.trip_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read of a shared trip only via exact token (security definer, no table-wide anon access)
CREATE OR REPLACE FUNCTION public.get_shared_trip(_token text)
RETURNS TABLE (id uuid, title text, destination text, start_date date, end_date date, input jsonb, itinerary jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, destination, start_date, end_date, input, itinerary
  FROM public.trips WHERE share_token = _token AND length(_token) >= 20 LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_trip(text) TO anon, authenticated;