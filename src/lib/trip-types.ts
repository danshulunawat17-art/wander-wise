export const INTERESTS = [
  "Culture",
  "History",
  "Food",
  "Nature",
  "Art",
  "Nightlife",
  "Shopping",
  "Adventure",
  "Beaches",
  "Architecture",
  "Family",
  "Wellness",
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"] as const;

export type Pace = "relaxed" | "balanced" | "packed";

export interface TripInput {
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  adults: number;
  children: number;
  budget: number;
  currency: string;
  interests: string[];
  pace: Pace;
  requirements?: string;
}

export type PlaceKind = "attraction" | "restaurant" | "hotel";

export interface Period {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export interface Place {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  priceRange?: { min?: number; max?: number; currency?: string };
  hours?: string[];
  periods?: Period[];
  types: string[];
  primaryType?: string;
  mapsUri?: string;
  kind: PlaceKind;
  cluster?: number;
}

export interface Item {
  id: string;
  time: string; // HH:MM
  durationMin: number;
  placeId: string;
  kind: "attraction" | "restaurant";
  meal?: "lunch" | "dinner";
  estCost: number; // in trip currency, whole party
  notes?: string;
  warning?: string;
  transitMin?: number;
}

export interface Weather {
  high: number;
  low: number;
  condition: string;
  precipChance?: number;
  source: "forecast" | "climate";
}

export interface Day {
  date: string;
  title?: string;
  pace?: Pace;
  weather?: Weather;
  items: Item[];
  dayCost: number;
}

export const PACKING_CATEGORIES = ["clothing", "documents", "electronics", "health", "misc"] as const;
export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export interface Budget {
  limit: number;
  total: number;
  byCategory: { lodging: number; food: number; activities: number; transport: number };
  over: boolean;
  overBy: number;
  warnings: string[];
}

export interface Itinerary {
  currency: string;
  fxRate: number; // 1 USD in trip currency
  center: { lat: number; lng: number };
  summary: string;
  hotelId?: string;
  days: Day[];
  places: Record<string, Place>;
  budget: Budget;
  packing: Record<PackingCategory, string[]>;
}

export interface TripRow {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  input: TripInput;
  itinerary: Itinerary;
  share_token: string | null;
}

export const DAY_COLORS = ["#c2410c", "#0f766e", "#1d4ed8", "#a21caf", "#b45309", "#15803d", "#be123c", "#4338ca"];
