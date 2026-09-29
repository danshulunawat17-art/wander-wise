import type { Itinerary } from "./trip-types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function stamp(date: string, time: string, addMin = 0) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m + addMin);
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export function buildIcs(title: string, it: Itinerary) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wayfare//Trip//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(title)}`];
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  for (const d of it.days)
    for (const i of d.items) {
      const p = it.places[i.placeId];
      if (!p) continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${i.id}@wayfare`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(d.date, i.time)}`,
        `DTEND:${stamp(d.date, i.time, i.durationMin)}`,
        `SUMMARY:${esc((i.meal ? `${i.meal[0].toUpperCase()}${i.meal.slice(1)}: ` : "") + p.name)}`,
        `LOCATION:${esc(p.address ?? p.name)}`,
        `DESCRIPTION:${esc([i.notes, p.mapsUri].filter(Boolean).join("\n"))}`,
        "END:VEVENT",
      );
    }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(title: string, it: Itinerary) {
  const blob = new Blob([buildIcs(title, it)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
