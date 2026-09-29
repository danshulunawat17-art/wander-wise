<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Travel planner architecture
- AI only picks from Google Places candidate IDs; prices, hours, ratings always come from provider data (prevents hallucinated facts).
- Scheduling, transit ordering and budget math are deterministic code in src/lib/planner.server.ts, not the LLM (reproducible numbers).
- "Modify with AI" returns only changed days, re-built by the same scheduler; every change is a trip_versions row (undo/history).
- Shared trips are read via the get_shared_trip security-definer RPC by unguessable token; no anon table access (privacy).
- Weather: Google forecast within ~10 days, else 3-year Open-Meteo archive average labelled "Climate avg" (Google has no climate data).
- Places/autocomplete server functions require sign-in (bounds Google Maps cost).
