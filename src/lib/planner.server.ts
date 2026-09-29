import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type {
  Budget,
  Day,
  Item,
  Itinerary,
  Pace,
  PackingCategory,
  Place,
  PlaceKind,
  TripInput,
  Weather,
} from "./trip-types";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function mapsHeaders(extra: Record<string, string> = {}) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Google Maps connection is not configured.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": maps,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function mapsFetch(path: string, init: RequestInit & { fieldMask?: string } = {}) {
  const headers = mapsHeaders(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {});
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Maps request failed [${res.status}] ${path}: ${body}`);
    if (res.status === 403) throw new Error("Google Maps denied the request. Check the Maps key permissions.");
    throw new Error(`Place lookup failed (${res.status}).`);
  }
  return res.json();
}

// ---------- Places ----------

export async function autocomplete(input: string, sessionToken: string) {
  const data = await mapsFetch("/places/v1/places:autocomplete", {
    method: "POST",
    fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: ["locality", "administrative_area_level_1", "country", "sublocality"],
    }),
  });
  return ((data.suggestions ?? []) as any[])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({ placeId: p.placeId as string, text: p.text?.text as string }))
    .slice(0, 6);
}

export async function geocode(destination: string) {
  const data = await mapsFetch(`/maps/api/geocode/json?address=${encodeURIComponent(destination)}`);
  const r = data.results?.[0];
  if (!r) throw new Error(`Couldn't find "${destination}". Try a city name.`);
  return { lat: r.geometry.location.lat as number, lng: r.geometry.location.lng as number, name: r.formatted_address as string };
}

const PLACE_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "priceRange",
  "regularOpeningHours.weekdayDescriptions",
  "regularOpeningHours.periods",
  "types",
  "primaryType",
  "googleMapsUri",
  "businessStatus",
]
  .map((f) => `places.${f}`)
  .join(",");

function toPlace(p: any, kind: PlaceKind): Place | null {
  if (!p?.id || !p.location) return null;
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return null;
  const pr = p.priceRange;
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed",
    address: p.formattedAddress,
    lat: p.location.latitude,
    lng: p.location.longitude,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    priceRange: pr
      ? {
          min: pr.startPrice?.units ? Number(pr.startPrice.units) : undefined,
          max: pr.endPrice?.units ? Number(pr.endPrice.units) : undefined,
          currency: pr.startPrice?.currencyCode ?? pr.endPrice?.currencyCode,
        }
      : undefined,
    hours: p.regularOpeningHours?.weekdayDescriptions,
    periods: p.regularOpeningHours?.periods,
    types: p.types ?? [],
    primaryType: p.primaryType,
    mapsUri: p.googleMapsUri,
    kind,
  };
}

export async function searchPlaces(query: string, center: { lat: number; lng: number }, kind: PlaceKind, max = 12) {
  const data = await mapsFetch("/places/v1/places:searchText", {
    method: "POST",
    fieldMask: PLACE_MASK,
    body: JSON.stringify({
      textQuery: query,
      pageSize: max,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 15000 } },
    }),
  });
  return ((data.places ?? []) as any[])
    .map((p) => toPlace(p, kind))
    .filter((p): p is Place => !!p && (p.ratingCount ?? 0) >= 20);
}

// ---------- Weather ----------

export async function getWeather(center: { lat: number; lng: number }, dates: string[]): Promise<Record<string, Weather>> {
  const out: Record<string, Weather> = {};
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysOut = (Date.parse(dates[0]) - today.getTime()) / 86400000;

  if (daysOut <= 9) {
    try {
      const data = await mapsFetch(
        `/weather/v1/forecast/days:lookup?location.latitude=${center.lat}&location.longitude=${center.lng}&days=10`,
      );
      for (const d of data.forecastDays ?? []) {
        const dd = d.displayDate;
        const key = `${dd.year}-${String(dd.month).padStart(2, "0")}-${String(dd.day).padStart(2, "0")}`;
        out[key] = {
          high: Math.round(d.maxTemperature?.degrees ?? 0),
          low: Math.round(d.minTemperature?.degrees ?? 0),
          condition: d.daytimeForecast?.weatherCondition?.description?.text ?? "—",
          precipChance: d.daytimeForecast?.precipitation?.probability?.percent,
          source: "forecast",
        };
      }
    } catch (e) {
      console.error("forecast failed", e);
    }
  }

  const missing = dates.filter((d) => !out[d]);
  if (missing.length) {
    // Climate average: same calendar dates over the previous 3 years.
    const years = [1, 2, 3];
    const results = await Promise.all(
      years.map(async (y) => {
        const s = shiftYear(missing[0], -y);
        const e = shiftYear(missing[missing.length - 1], -y);
        try {
          const r = await fetch(
            `https://archive-api.open-meteo.com/v1/archive?latitude=${center.lat}&longitude=${center.lng}&start_date=${s}&end_date=${e}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
          );
          if (!r.ok) return null;
          return (await r.json()).daily as { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
        } catch {
          return null;
        }
      }),
    );
    for (const date of missing) {
      const md = date.slice(5);
      const hi: number[] = [], lo: number[] = [], rain: number[] = [];
      for (const r of results) {
        if (!r) continue;
        const i = r.time.findIndex((t) => t.slice(5) === md);
        if (i >= 0 && r.temperature_2m_max[i] != null) {
          hi.push(r.temperature_2m_max[i]);
          lo.push(r.temperature_2m_min[i]);
          rain.push(r.precipitation_sum[i] ?? 0);
        }
      }
      if (!hi.length) continue;
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const wetDays = rain.filter((r) => r > 1).length;
      const h = avg(hi);
      out[date] = {
        high: Math.round(h),
        low: Math.round(avg(lo)),
        condition: wetDays >= 2 ? "Often rainy" : h > 28 ? "Typically hot" : h < 8 ? "Typically cold" : "Typically mild",
        precipChance: Math.round((wetDays / hi.length) * 100),
        source: "climate",
      };
    }
  }
  return out;
}

function shiftYear(date: string, delta: number) {
  const y = Number(date.slice(0, 4)) + delta;
  let rest = date.slice(4);
  if (rest === "-02-29") rest = "-02-28";
  return `${y}${rest}`;
}

// ---------- FX ----------

export async function usdRate(currency: string) {
  if (currency === "USD") return 1;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    return (j.rates?.[currency] as number) ?? 1;
  } catch {
    return 1;
  }
}

// ---------- AI ----------

export async function askAI(system: string, prompt: string): Promise<any> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    prompt,
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text: string;
  try {
    text = await result.text;
  } catch (e: any) {
    const status = e?.statusCode ?? e?.status;
    if (status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
    if (status === 402) throw new Error("AI credits are used up for this workspace. Add credits to continue.");
    throw new Error(e?.message ?? "The AI request failed.");
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI returned an unexpected answer. Please try again.");
  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error("The AI returned an unreadable plan. Please try again.");
  }
}

// ---------- Geometry / clustering ----------

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function transitMinutes(a: Place, b: Place) {
  const d = km(a, b) * 1.3;
  return Math.max(5, Math.round(d < 1.5 ? (d / 5) * 60 : (d / 20) * 60 + 8));
}

export function clusterPlaces(places: Place[], k: number) {
  if (!places.length) return;
  k = Math.max(1, Math.min(k, places.length));
  const sorted = [...places].sort((a, b) => a.lng - b.lng);
  let cents = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)]).map((p) => ({ lat: p.lat, lng: p.lng }));
  for (let it = 0; it < 12; it++) {
    for (const p of places) {
      let best = 0, bd = Infinity;
      cents.forEach((c, i) => {
        const d = km(p, c);
        if (d < bd) (bd = d), (best = i);
      });
      p.cluster = best;
    }
    cents = cents.map((c, i) => {
      const m = places.filter((p) => p.cluster === i);
      if (!m.length) return c;
      return { lat: m.reduce((s, p) => s + p.lat, 0) / m.length, lng: m.reduce((s, p) => s + p.lng, 0) / m.length };
    });
  }
}

// ---------- Costs (deterministic) ----------

const RESTAURANT_USD: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 12,
  PRICE_LEVEL_MODERATE: 25,
  PRICE_LEVEL_EXPENSIVE: 50,
  PRICE_LEVEL_VERY_EXPENSIVE: 90,
};
const HOTEL_USD: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 70,
  PRICE_LEVEL_MODERATE: 130,
  PRICE_LEVEL_EXPENSIVE: 250,
  PRICE_LEVEL_VERY_EXPENSIVE: 450,
};
const FREE_TYPES = ["park", "beach", "hiking_area", "church", "plaza", "national_park", "garden", "place_of_worship", "hindu_temple", "mosque", "synagogue"];

function priceFromRange(p: Place, rate: number, currency: string) {
  const r = p.priceRange;
  if (!r || (r.min == null && r.max == null)) return null;
  const mid = r.min != null && r.max != null ? (r.min + r.max) / 2 : (r.min ?? r.max)!;
  // priceRange is already in local currency; if it matches trip currency use it directly.
  if (r.currency === currency) return mid;
  return null;
}

export function mealCostPerPerson(p: Place, rate: number, currency: string) {
  return priceFromRange(p, rate, currency) ?? (RESTAURANT_USD[p.priceLevel ?? ""] ?? 22) * rate;
}

export function attractionCostPerPerson(p: Place, rate: number) {
  if (p.priceLevel === "PRICE_LEVEL_FREE") return 0;
  if (p.types.some((t) => FREE_TYPES.includes(t))) return 0;
  if (p.types.includes("museum") || p.types.includes("art_gallery")) return 15 * rate;
  if (p.types.includes("amusement_park") || p.types.includes("zoo") || p.types.includes("aquarium")) return 35 * rate;
  return 10 * rate;
}

export function hotelNight(p: Place | undefined, rate: number, input: TripInput) {
  const rooms = Math.max(1, Math.ceil(input.adults / 2));
  return (HOTEL_USD[p?.priceLevel ?? ""] ?? 120) * rate * rooms;
}

function round(n: number) {
  return Math.round(n);
}

// ---------- Scheduling ----------

const START: Record<Pace, number> = { relaxed: 10 * 60, balanced: 9 * 60, packed: 8 * 60 + 30 };
const DUR_FACTOR: Record<Pace, number> = { relaxed: 1.25, balanced: 1, packed: 0.85 };

function baseDuration(p: Place) {
  if (p.types.includes("museum") || p.types.includes("art_gallery")) return 120;
  if (p.types.includes("amusement_park") || p.types.includes("zoo") || p.types.includes("national_park")) return 180;
  if (p.types.includes("park") || p.types.includes("beach")) return 90;
  return 75;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

function openAt(p: Place, date: string, startMin: number, endMin: number): boolean | null {
  if (!p.periods?.length) return null;
  const dow = new Date(date + "T12:00:00Z").getUTCDay();
  if (p.periods.length === 1 && !p.periods[0].close) return true; // 24/7
  for (const per of p.periods) {
    if (per.open.day !== dow) continue;
    const o = per.open.hour * 60 + per.open.minute;
    let c = per.close ? per.close.hour * 60 + per.close.minute : 24 * 60;
    if (per.close && per.close.day !== per.open.day) c += 24 * 60;
    if (startMin >= o && endMin <= c) return true;
  }
  return false;
}

let idCounter = 0;
const newId = () => `i${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export interface DayPlan {
  attractions: string[];
  lunch?: string | null;
  dinner?: string | null;
  notes?: Record<string, string>;
  title?: string;
  pace?: Pace;
}

function nearestRestaurant(from: Place, restaurants: Place[], used: Set<string>) {
  let best: Place | undefined, bd = Infinity;
  for (const r of restaurants) {
    if (used.has(r.id)) continue;
    const score = km(from, r) - (r.rating ?? 4) * 0.4;
    if (score < bd) (bd = score), (best = r);
  }
  return best;
}

export function buildDay(
  date: string,
  plan: DayPlan,
  places: Record<string, Place>,
  input: TripInput,
  rate: number,
  usedRestaurants: Set<string>,
  hotel?: Place,
  weather?: Weather,
): Day {
  const pace = plan.pace ?? input.pace;
  const party = input.adults + input.children * 0.7;
  const restaurants = Object.values(places).filter((p) => p.kind === "restaurant");
  const maxStops = pace === "relaxed" ? 3 : pace === "balanced" ? 4 : 5;

  // Order attractions by nearest neighbour from the hotel to minimise transit.
  let remaining = plan.attractions.map((id) => places[id]).filter((p): p is Place => !!p && p.kind === "attraction").slice(0, maxStops);
  const ordered: Place[] = [];
  let cursor: { lat: number; lng: number } = hotel ?? remaining[0] ?? { lat: 0, lng: 0 };
  while (remaining.length) {
    remaining.sort((a, b) => km(cursor, a) - km(cursor, b));
    const next = remaining.shift()!;
    ordered.push(next);
    cursor = next;
  }

  const items: Item[] = [];
  let t = START[pace];
  let prev: Place | undefined = hotel;
  let hadLunch = false;
  const f = DUR_FACTOR[pace];

  const pushMeal = (meal: "lunch" | "dinner", explicit?: string | null) => {
    const from = prev ?? ordered[0] ?? hotel;
    let r = explicit ? places[explicit] : undefined;
    if (!r && from) r = nearestRestaurant(from, restaurants, usedRestaurants);
    if (!r) return;
    usedRestaurants.add(r.id);
    const transit = prev ? transitMinutes(prev, r) : 0;
    t += transit;
    if (meal === "dinner") t = Math.max(t, 19 * 60);
    const dur = meal === "lunch" ? 60 : 90;
    const open = openAt(r, date, t, t + dur);
    items.push({
      id: newId(),
      time: hhmm(t),
      durationMin: dur,
      placeId: r.id,
      kind: "restaurant",
      meal,
      estCost: round(mealCostPerPerson(r, rate, input.currency) * party),
      notes: plan.notes?.[r.id],
      transitMin: prev ? transit : undefined,
      warning: open === false ? "May be closed at this time — check hours" : undefined,
    });
    t += dur;
    prev = r;
  };

  for (const p of ordered) {
    if (!hadLunch && t >= 12 * 60) {
      pushMeal("lunch", plan.lunch);
      hadLunch = true;
    }
    const transit = prev ? transitMinutes(prev, p) : 0;
    t += transit;
    const dur = Math.round((baseDuration(p) * f) / 15) * 15;
    const open = openAt(p, date, t, t + dur);
    items.push({
      id: newId(),
      time: hhmm(t),
      durationMin: dur,
      placeId: p.id,
      kind: "attraction",
      estCost: round(attractionCostPerPerson(p, rate) * party),
      notes: plan.notes?.[p.id],
      transitMin: prev ? transit : undefined,
      warning: open === false ? "May be closed at this time — check hours" : undefined,
    });
    t += dur + (pace === "relaxed" ? 30 : 10);
    prev = p;
  }
  if (!hadLunch) pushMeal("lunch", plan.lunch);
  pushMeal("dinner", plan.dinner);

  const dayCost = items.reduce((s, i) => s + i.estCost, 0);
  return { date, title: plan.title, pace, weather, items, dayCost };
}

export function computeBudget(it: Pick<Itinerary, "days" | "places" | "hotelId">, input: TripInput, rate: number): Budget {
  const nights = Math.max(1, it.days.length - 1);
  const hotel = it.hotelId ? it.places[it.hotelId] : undefined;
  const lodging = round(hotelNight(hotel, rate, input) * nights);
  let food = 0, activities = 0;
  for (const d of it.days)
    for (const i of d.items) {
      if (i.kind === "restaurant") food += i.estCost;
      else activities += i.estCost;
    }
  // Breakfast + snacks not scheduled explicitly.
  food += round(10 * rate * (input.adults + input.children) * it.days.length);
  const transport = round(12 * rate * (input.adults + input.children) * it.days.length);
  const total = lodging + food + activities + transport;
  const over = total > input.budget;
  const warnings: string[] = [];
  if (over) {
    warnings.push(`Estimated total is ${round(total - input.budget).toLocaleString()} ${input.currency} over your budget.`);
    if (lodging > total * 0.5) warnings.push("Lodging is over half the cost — a cheaper hotel would help most.");
    if (food > total * 0.35) warnings.push("Dining is a large share — try more casual restaurants.");
  } else if (total > input.budget * 0.9) {
    warnings.push("You're within 10% of your budget — leave some room for extras.");
  }
  return {
    limit: input.budget,
    total,
    byCategory: { lodging, food, activities, transport },
    over,
    overBy: over ? total - input.budget : 0,
    warnings,
  };
}

export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d <= e && out.length < 21) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const EMPTY_PACKING: Record<PackingCategory, string[]> = {
  clothing: [],
  documents: [],
  electronics: [],
  health: [],
  misc: [],
};

export function compactPlace(p: Place) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    type: p.primaryType,
    rating: p.rating,
    price: p.priceLevel?.replace("PRICE_LEVEL_", "").toLowerCase(),
    cluster: p.cluster,
  };
}
