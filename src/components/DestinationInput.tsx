import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { autocompleteDestination } from "@/lib/trips.functions";

export function DestinationInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const fetchSuggestions = useServerFn(autocompleteDestination);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ placeId: string; text: string }[]>([]);
  const token = useRef<string | null>(null);
  const reqId = useRef(0);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (value.trim().length < 2) {
      setItems([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      token.current ??= crypto.randomUUID();
      try {
        const r = await fetchSuggestions({ data: { input: value, sessionToken: token.current } });
        if (id === reqId.current) {
          setItems(r);
          setOpen(true);
        }
      } catch {
        /* keep typing usable */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, fetchSuggestions]);

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="destination"
        placeholder="Kyoto, Japan"
        className="pl-9"
        autoComplete="off"
        aria-invalid={invalid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg" role="listbox">
          {items.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  skip.current = true;
                  onChange(s.text);
                  setOpen(false);
                  token.current = null;
                }}
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
