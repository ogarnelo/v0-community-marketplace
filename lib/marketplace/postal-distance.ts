/** Server-only: never bundle the national postcode dataset in client scripts. */
import "server-only";
import { POSTAL_CENTROIDS } from "@/lib/marketplace/postal-centroids";

export function normalizePostalCode(code?: string | null): string | null {
  const trimmed = code?.trim() || "";
  return /^\d{5}$/.test(trimmed) ? trimmed : null;
}

export function hasKnownPostalCode(code?: string | null): boolean {
  const normalized = normalizePostalCode(code);
  return !!normalized && Object.hasOwn(POSTAL_CENTROIDS, normalized);
}

export function approximateDistanceKm(from?: string | null, to?: string | null): number | undefined {
  const first = normalizePostalCode(from);
  const second = normalizePostalCode(to);
  if (!first || !second) return undefined;
  const a = POSTAL_CENTROIDS[first], b = POSTAL_CENTROIDS[second];
  if (!a || !b) return undefined;
  const [lat1, lon1] = a, [lat2, lon2] = b;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371.0088 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)) * 10) / 10;
}
