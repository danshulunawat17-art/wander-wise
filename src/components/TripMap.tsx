/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { DAY_COLORS, type Itinerary } from "@/lib/trip-types";

let loader: Promise<void> | null = null;
function loadMaps() {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    (window as any)["__wayfareMapsReady"] = () => resolve();
    const s = document.createElement("script");
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__wayfareMapsReady&channel=${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Map failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

export function TripMap({ itinerary, activeDay }: { itinerary: Itinerary; activeDay: number | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef<(google.maps.Marker | google.maps.Polyline)[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadMaps()
      .then(() => {
        if (!el.current || map.current) return;
        map.current = new google.maps.Map(el.current, {
          center: itinerary.center,
          zoom: 12,
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        setReady(true);
      })
      .catch(() => setFailed(true));
  }, [itinerary.center]);

  useEffect(() => {
    if (!ready || !map.current) return;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const bounds = new google.maps.LatLngBounds();
    const info = new google.maps.InfoWindow();
    itinerary.days.forEach((d, di) => {
      if (activeDay !== null && activeDay !== di) return;
      const color = DAY_COLORS[di % DAY_COLORS.length];
      const path: google.maps.LatLngLiteral[] = [];
      d.items.forEach((it, ii) => {
        const p = itinerary.places[it.placeId];
        if (!p) return;
        const pos = { lat: p.lat, lng: p.lng };
        path.push(pos);
        bounds.extend(pos);
        const m = new google.maps.Marker({
          position: pos,
          map: map.current!,
          label: { text: String(ii + 1), color: "#fff", fontSize: "11px", fontWeight: "700" },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
          title: p.name,
        });
        m.addListener("click", () => {
          const div = document.createElement("div");
          div.style.fontSize = "13px";
          div.textContent = `Day ${di + 1} · ${it.time} — ${p.name}`;
          info.setContent(div);
          info.open({ map: map.current!, anchor: m });
        });
        overlays.current.push(m);
      });
      const line = new google.maps.Polyline({ path, map: map.current!, strokeColor: color, strokeOpacity: 0.85, strokeWeight: 3 });
      overlays.current.push(line);
    });
    const hotel = itinerary.hotelId ? itinerary.places[itinerary.hotelId] : undefined;
    if (hotel) {
      const m = new google.maps.Marker({
        position: { lat: hotel.lat, lng: hotel.lng },
        map: map.current,
        label: { text: "H", color: "#fff", fontSize: "11px", fontWeight: "700" },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#1e293b", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        title: hotel.name,
      });
      overlays.current.push(m);
      bounds.extend({ lat: hotel.lat, lng: hotel.lng });
    }
    if (!bounds.isEmpty()) map.current.fitBounds(bounds, 40);
  }, [ready, itinerary, activeDay]);

  if (failed) return <div className="flex h-full items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">Map unavailable</div>;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border">
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
