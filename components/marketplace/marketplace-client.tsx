"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListingCard } from "@/components/listing-card";
import { categories, gradeLevels, conditions } from "@/lib/mock-data";
import { extractIsbnFromText, isIncompleteIsbnLikeInput, normalizeIsbn } from "@/lib/books/isbn";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  MapPin,
  PackageSearch,
  Plus,
  School,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MarketplaceListing } from "@/lib/types/marketplace";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CommunityInviteCard } from "@/components/growth/community-invite-card";
import { toast } from "sonner";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

type MarketplaceClientProps = { initialListings: MarketplaceListing[]; initialSchoolId: string; initialDirectorySchoolCode?: string; initialPostalCode?: string; initialCommunityListingCount?: number | null; initialGeneralHasMore?: boolean };
type SaveSearchStatus = "idle" | "saving" | "saved" | "auth" | "error";
type PublishedDateFilter = "all" | "today" | "7d" | "30d";

const PRICE_LIMIT = 200;
const DISTANCE_MAX = 201;

const POSTAL_PREFIX_COORDS: Record<string, { lat: number; lng: number }> = {
  "01": { lat: 42.85, lng: -2.67 }, "02": { lat: 38.99, lng: -1.86 }, "03": { lat: 38.35, lng: -0.49 }, "04": { lat: 36.84, lng: -2.46 }, "05": { lat: 40.66, lng: -4.70 }, "06": { lat: 38.88, lng: -6.97 }, "07": { lat: 39.57, lng: 2.65 }, "08": { lat: 41.39, lng: 2.17 }, "09": { lat: 42.34, lng: -3.70 }, "10": { lat: 39.47, lng: -6.37 }, "11": { lat: 36.52, lng: -6.28 }, "12": { lat: 39.99, lng: -0.04 }, "13": { lat: 38.99, lng: -3.93 }, "14": { lat: 37.88, lng: -4.78 }, "15": { lat: 43.36, lng: -8.41 }, "16": { lat: 40.07, lng: -2.14 }, "17": { lat: 41.98, lng: 2.82 }, "18": { lat: 37.18, lng: -3.60 }, "19": { lat: 40.63, lng: -3.16 }, "20": { lat: 43.32, lng: -1.98 }, "21": { lat: 37.26, lng: -6.95 }, "22": { lat: 42.14, lng: -0.41 }, "23": { lat: 37.78, lng: -3.79 }, "24": { lat: 42.60, lng: -5.57 }, "25": { lat: 41.62, lng: 0.62 }, "26": { lat: 42.46, lng: -2.45 }, "27": { lat: 43.01, lng: -7.56 }, "28": { lat: 40.42, lng: -3.70 }, "29": { lat: 36.72, lng: -4.42 }, "30": { lat: 37.98, lng: -1.13 }, "31": { lat: 42.82, lng: -1.64 }, "32": { lat: 42.34, lng: -7.86 }, "33": { lat: 43.36, lng: -5.85 }, "34": { lat: 42.01, lng: -4.53 }, "35": { lat: 28.10, lng: -15.42 }, "36": { lat: 42.43, lng: -8.64 }, "37": { lat: 40.97, lng: -5.66 }, "38": { lat: 28.46, lng: -16.25 }, "39": { lat: 43.46, lng: -3.81 }, "40": { lat: 40.95, lng: -4.12 }, "41": { lat: 37.39, lng: -5.99 }, "42": { lat: 41.76, lng: -2.46 }, "43": { lat: 41.12, lng: 1.25 }, "44": { lat: 40.34, lng: -1.11 }, "45": { lat: 39.86, lng: -4.03 }, "46": { lat: 39.47, lng: -0.38 }, "47": { lat: 41.65, lng: -4.72 }, "48": { lat: 43.26, lng: -2.93 }, "49": { lat: 41.50, lng: -5.74 }, "50": { lat: 41.65, lng: -0.89 }, "51": { lat: 35.89, lng: -5.32 }, "52": { lat: 35.29, lng: -2.94 },
};

function normalizePostalCode(value?: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length >= 5 ? digits.slice(0, 5) : null; }
function coordsForPostalCode(postalCode?: string | null) { const normalized = normalizePostalCode(postalCode); return normalized ? POSTAL_PREFIX_COORDS[normalized.slice(0, 2)] || null : null; }
function calculateDistanceKm(fromPostalCode?: string | null, toPostalCode?: string | null) {
  const from = coordsForPostalCode(fromPostalCode); const to = coordsForPostalCode(toPostalCode); if (!from || !to) return undefined;
  const earthRadiusKm = 6371; const dLat = ((to.lat - from.lat) * Math.PI) / 180; const dLng = ((to.lng - from.lng) * Math.PI) / 180; const lat1 = (from.lat * Math.PI) / 180; const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function isAfterDate(value: string | null, filter: PublishedDateFilter) {
  if (filter === "all" || !value) return true; const createdAt = new Date(value).getTime(); if (!Number.isFinite(createdAt)) return true; const start = new Date();
  if (filter === "today") start.setHours(0, 0, 0, 0); if (filter === "7d") start.setDate(start.getDate() - 7); if (filter === "30d") start.setDate(start.getDate() - 30);
  return createdAt >= start.getTime();
}

export function MarketplaceClient({ initialListings, initialSchoolId, initialDirectorySchoolCode = "", initialPostalCode = "", initialCommunityListingCount = null, initialGeneralHasMore = false }: MarketplaceClientProps) {
  const [dbListings, setDbListings] = useState<MarketplaceListing[]>(initialListings);
  const [generalHasMore, setGeneralHasMore] = useState(initialGeneralHasMore);
  const [generalLoading, setGeneralLoading] = useState(false);
  const [generalLoadError, setGeneralLoadError] = useState(false);
  const [generalOffset, setGeneralOffset] = useState(initialListings.length);
  // The sentinel is part of the existing grid footer; it is not a new card.
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const generalRequestInFlight = useRef(false);
  const schoolRequestInFlight = useRef(false);
  const [schoolListings, setSchoolListings] = useState<MarketplaceListing[]>([]);
  const [schoolCount, setSchoolCount] = useState<number | null>(initialCommunityListingCount);
  const [schoolLoaded, setSchoolLoaded] = useState(false);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolHasMore, setSchoolHasMore] = useState(false);
  const [schoolLoadError, setSchoolLoadError] = useState(false);
  const [schoolOffset, setSchoolOffset] = useState(0);

  const [currentUserSchoolId] = useState(initialSchoolId);
  const [currentUserDirectorySchoolCode] = useState(initialDirectorySchoolCode);
  const [viewerPostalCode] = useState(initialPostalCode);
  const [onlyMyCommunity, setOnlyMyCommunity] = useState(false);
  const [category, setCategory] = useState("all");
  const [gradeLevel, setGradeLevel] = useState("all");
  const [listingType, setListingType] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [isbnQuery, setIsbnQuery] = useState("");
  const [priceRange, setPriceRange] = useState([0, PRICE_LIMIT]);
  const [distanceKm, setDistanceKm] = useState(DISTANCE_MAX);
  const [publishedDateFilter, setPublishedDateFilter] = useState<PublishedDateFilter>("all");
  const [saveSearchStatus, setSaveSearchStatus] = useState<SaveSearchStatus>("idle");
  const [demandDetails, setDemandDetails] = useState("");
  const [showSchoolInvite, setShowSchoolInvite] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("joined") !== "1") return;

    setShowSchoolInvite(true);
    params.delete("joined");
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`
    );
  }, []);

  // Only fetch the user's own school feed on explicit opt-in. The endpoint
  // resolves the school from the authenticated account, not user parameters.
  useEffect(() => {
    if (!onlyMyCommunity) return;
    const controller = new AbortController();
    setSchoolListings([]);
    setSchoolOffset(0);
    setSchoolHasMore(false);
    setSchoolLoaded(false);
    setSchoolLoading(true);
    setSchoolLoadError(false);
    fetch("/api/marketplace/my-school?offset=0", {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("school_listings_fetch_failed");
        return response.json();
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setSchoolListings(payload.listings || []);
        setSchoolOffset((payload.listings || []).length);
        setSchoolCount(payload.total ?? null);
        setSchoolHasMore(Boolean(payload.hasMore));
        setSchoolLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSchoolLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSchoolLoading(false);
      });
    return () => controller.abort();
  }, [onlyMyCommunity]);

  const loadMoreGeneralListings = useCallback(async () => {
    // A synchronous ref guard prevents duplicate requests from observer events
    // fired before React has flushed the loading state.
    if (onlyMyCommunity || generalLoading || !generalHasMore ||
        generalRequestInFlight.current) return;
    generalRequestInFlight.current = true;
    setGeneralLoading(true);
    setGeneralLoadError(false);
    try {
      const response = await fetch(
        `/api/marketplace/feed?offset=${generalOffset}`, { cache: "no-store" });
      if (!response.ok) throw new Error("catalogue_next_page_failed");
      const payload = await response.json();
      const rows: MarketplaceListing[] = payload.listings || [];
      setDbListings((current) => {
        const ids = new Set(current.map((listing) => listing.id));
        return [...current, ...rows.filter((listing) => !ids.has(listing.id))];
      });
      setGeneralOffset((current) => current + rows.length);
      setGeneralHasMore(Boolean(payload.hasMore) && rows.length > 0);
    } catch {
      // Don't retry continuously while the sentinel remains visible.
      setGeneralLoadError(true);
    } finally {
      generalRequestInFlight.current = false;
      setGeneralLoading(false);
    }
  }, [onlyMyCommunity, generalLoading, generalHasMore, generalOffset]);

  const loadMoreSchoolListings = useCallback(async () => {
    if (!onlyMyCommunity || !schoolLoaded || schoolLoading || !schoolHasMore ||
        schoolRequestInFlight.current) return;
    schoolRequestInFlight.current = true;
    setSchoolLoading(true);
    setSchoolLoadError(false);
    try {
      const response = await fetch(
        `/api/marketplace/my-school?offset=${schoolOffset}`, { cache: "no-store" });
      if (!response.ok) throw new Error("school_listings_more_failed");
      const payload = await response.json();
      const rows: MarketplaceListing[] = payload.listings || [];
      setSchoolListings((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !ids.has(item.id))];
      });
      setSchoolOffset((current) => current + rows.length);
      setSchoolCount(payload.total ?? null);
      setSchoolHasMore(Boolean(payload.hasMore) && rows.length > 0);
    } catch {
      setSchoolLoadError(true);
    } finally {
      schoolRequestInFlight.current = false;
      setSchoolLoading(false);
    }
  }, [onlyMyCommunity, schoolLoaded, schoolLoading, schoolHasMore, schoolOffset]);

  useEffect(() => {
    const target = feedSentinelRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const waiting = onlyMyCommunity
      ? !schoolLoaded || schoolLoading || schoolLoadError || !schoolHasMore
      : generalLoading || generalLoadError || !generalHasMore;
    if (waiting) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || document.visibilityState === "hidden") return;
        if (onlyMyCommunity) void loadMoreSchoolListings();
        else void loadMoreGeneralListings();
      },
      // Fetch slightly before the end so scrolling stays smooth on mobile.
      { root: null, rootMargin: "360px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onlyMyCommunity, generalHasMore, generalLoading, generalLoadError,
      schoolLoaded, schoolHasMore, schoolLoading, schoolLoadError,
      loadMoreGeneralListings, loadMoreSchoolListings]);

  // A small, dismissible invitation when the user's school has enough
  // inventory. Never change the default all-marketplace view automatically.
  // Session-scoped and per school: avoid showing the same nudge repeatedly.
  useEffect(() => {
    const schoolKey = currentUserDirectorySchoolCode || currentUserSchoolId;
    if (!schoolKey || schoolCount === null || schoolCount < 10 ||
        onlyMyCommunity || showSchoolInvite) return;

    const storageKey = `wetudy:school-invite:${schoolKey}`;
    const handle = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(storageKey) === "seen") return;
        if (new URLSearchParams(window.location.search).get("joined") === "1") return;
        window.sessionStorage.setItem(storageKey, "seen");
      } catch {
        // Browsers can block session storage: do not show a potentially
        // repetitive popup when we cannot enforce the once-per-session rule.
        return;
      }
      toast("¡Tu colegio ya tiene movimiento!", {
        description: `${schoolCount} anuncios disponibles. ¿Quieres echar un vistazo?`,
        action: {
          label: "Ver mi colegio",
          onClick: () => setOnlyMyCommunity(true),
        },
        duration: 7500,
      });
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [schoolCount, currentUserDirectorySchoolCode, currentUserSchoolId,
      onlyMyCommunity, showSchoolInvite]);

  const deferredPriceRange = useDeferredValue(priceRange);
  const deferredDistanceKm = useDeferredValue(distanceKm);
  const displayMinPrice = priceRange[0] ?? 0;
  const displayMaxPrice = priceRange[1] ?? PRICE_LIMIT;
  const minPrice = deferredPriceRange[0] ?? 0;
  const maxPrice = deferredPriceRange[1] ?? PRICE_LIMIT;
  const maxDistanceKm = deferredDistanceKm >= DISTANCE_MAX ? Infinity : deferredDistanceKm;
  const selectedDistanceLabel = distanceKm >= DISTANCE_MAX ? "+200" : `${distanceKm} km`;
  const hasViewerPostalCode = Boolean(normalizePostalCode(viewerPostalCode));
  const hasSearchIntent = Boolean(searchQuery.trim() || isbnQuery.trim() || category !== "all" || gradeLevel !== "all" || listingType !== "all" || condition !== "all" || onlyMyCommunity || minPrice > 0 || maxPrice < PRICE_LIMIT || (!onlyMyCommunity && maxDistanceKm !== Infinity) || publishedDateFilter !== "all");
  const listingsWithDistance = useMemo(() => (onlyMyCommunity ? schoolListings : dbListings).map((listing) => ({ ...listing, distance: listing.distance ?? calculateDistanceKm(viewerPostalCode, listing.postalCode) })), [dbListings, schoolListings, onlyMyCommunity, viewerPostalCode]);

  const filteredListings = useMemo(() => {
    const normalizedSearch = normalizeText(searchQuery);
    const filtered = listingsWithDistance.filter((l) => {
      if (l.status !== "available") return false;
      // School membership matching has already been enforced by the server,
      // including directory codes linked to a newly activated community.
      if (category !== "all" && l.category !== category) return false; if (gradeLevel !== "all" && l.gradeLevel !== gradeLevel) return false; if (listingType !== "all" && l.type !== listingType) return false; if (condition !== "all" && l.condition !== condition) return false; if (!isAfterDate(l.createdAt, publishedDateFilter)) return false;
      if (!onlyMyCommunity && maxDistanceKm !== Infinity && (l.distance === undefined || l.distance > maxDistanceKm)) return false;
      if (normalizedSearch) { const matchesSearch = [l.title, l.description, l.category, l.gradeLevel, l.isbn, l.author, l.publisher, l.format, l.language, l.subject, l.specificType, l.sizeLabel, l.brand, l.model, l.season].some((value) => normalizeText(value || "").includes(normalizedSearch)); if (!matchesSearch) return false; }
      if (isbnQuery) { const normalizedIsbn = isbnQuery.replace(/[^0-9xX]/g, "").toLowerCase(); const listingIsbn = (l.isbn || "").replace(/[^0-9xX]/g, "").toLowerCase(); if (!listingIsbn.includes(normalizedIsbn)) return false; }
      if (l.type === "sale" && l.price !== undefined) { if (l.price < minPrice) return false; if (maxPrice < PRICE_LIMIT && l.price > maxPrice) return false; }
      return true;
    });
    return filtered.sort((a, b) => { switch (sortBy) { case "distance": return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER); case "price_asc": return (a.price ?? 0) - (b.price ?? 0); case "price_desc": return (b.price ?? 0) - (a.price ?? 0); case "discount": return ((b.originalPrice ?? 0) - (b.price ?? 0)) - ((a.originalPrice ?? 0) - (a.price ?? 0)); case "newest": default: return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); } });
  }, [listingsWithDistance, onlyMyCommunity, category, gradeLevel, listingType, condition, publishedDateFilter, maxDistanceKm, searchQuery, isbnQuery, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    if (!hasSearchIntent) return;

    const rawSearchQuery = searchQuery.trim();
    const rawIsbnQuery = isbnQuery.trim();

    if (
      (rawIsbnQuery && isIncompleteIsbnLikeInput(rawIsbnQuery)) ||
      (!rawIsbnQuery && rawSearchQuery && isIncompleteIsbnLikeInput(rawSearchQuery))
    ) {
      return;
    }

    const canonicalIsbn =
      (rawIsbnQuery ? normalizeIsbn(rawIsbnQuery)?.canonicalIsbn || null : null) ||
      extractIsbnFromText(rawSearchQuery)?.canonicalIsbn ||
      null;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch("/api/marketplace/search-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: rawSearchQuery || null,
          isbnQuery: canonicalIsbn,
          category: category === "all" ? null : category,
          gradeLevel: gradeLevel === "all" ? null : gradeLevel,
          listingType: listingType === "all" ? null : listingType,
          condition: condition === "all" ? null : condition,
          priceMin: minPrice > 0 ? minPrice : null,
          priceMax: maxPrice < PRICE_LIMIT ? maxPrice : null,
          onlyMyCommunity,
          nearbyMode: !onlyMyCommunity && maxDistanceKm !== Infinity,
          radiusKm: maxDistanceKm === Infinity ? null : maxDistanceKm,
          resultsCount: filteredListings.length,
          sourcePath: "/marketplace",
        }),
        signal: controller.signal,
        keepalive: true,
      }).catch(() => undefined);
    }, 900);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, isbnQuery, category, gradeLevel, listingType, condition, onlyMyCommunity, minPrice, maxPrice, maxDistanceKm, filteredListings.length, hasSearchIntent]);
  useEffect(() => {
    setSaveSearchStatus("idle");
  }, [searchQuery, isbnQuery, category, gradeLevel, listingType, condition, onlyMyCommunity, priceRange, distanceKm, publishedDateFilter]);

  const hasSchoolContext = Boolean(currentUserSchoolId || currentUserDirectorySchoolCode);
  const communityCountLabel = schoolCount === null
    ? "Anuncios de tu colegio"
    : schoolCount === 1
      ? "1 anuncio de tu colegio"
      : `${schoolCount} anuncios de tu colegio`;
  // Ten is a discovery milestone, NEVER an automatic filter-on threshold.
  const highlightSchoolShortcut = (schoolCount ?? 0) >= 10;
  const subtleSchoolShortcut = (schoolCount ?? 0) >= 5 && !highlightSchoolShortcut;
  const emptySchoolView = onlyMyCommunity && schoolLoaded && filteredListings.length === 0;

  const schoolFeedPending = onlyMyCommunity && !schoolLoaded && !schoolLoadError;
  const activeFiltersCount = [onlyMyCommunity, category !== "all", gradeLevel !== "all", listingType !== "all", condition !== "all", minPrice > 0 || maxPrice < PRICE_LIMIT, !onlyMyCommunity && maxDistanceKm !== Infinity, publishedDateFilter !== "all", isbnQuery.length > 0].filter(Boolean).length;
  const clearFilters = () => { setOnlyMyCommunity(false); setCategory("all"); setGradeLevel("all"); setListingType("all"); setCondition("all"); setSearchQuery(""); setIsbnQuery(""); setPriceRange([0, PRICE_LIMIT]); setDistanceKm(DISTANCE_MAX); setPublishedDateFilter("all"); setDemandDetails(""); };
  const saveSearch = async () => { if (!hasSearchIntent || saveSearchStatus === "saving" || saveSearchStatus === "saved") return; setSaveSearchStatus("saving"); try { const response = await fetch("/api/marketplace/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: demandDetails.trim() || searchQuery.trim() || null, isbnQuery: isbnQuery.trim() || null, category: category === "all" ? null : category, gradeLevel: gradeLevel === "all" ? null : gradeLevel, listingType: listingType === "all" ? null : listingType, condition: condition === "all" ? null : condition, onlyMyCommunity, radiusKm: maxDistanceKm === Infinity ? null : maxDistanceKm, resultsCount: filteredListings.length, sourcePath: "/marketplace", needDetails: demandDetails.trim() || searchQuery.trim() || null, intentSource: "zero_results_prompt" }) }); if (response.status === 401) return setSaveSearchStatus("auth"); if (!response.ok) throw new Error("saved_search_failed"); setSaveSearchStatus("saved"); setDemandDetails(""); } catch { setSaveSearchStatus("error"); } };
  const togglePublishedDateFilter = (value: PublishedDateFilter) => setPublishedDateFilter((current) => (current === value ? "all" : value));

  const FilterControls = () => (
    <div className="flex flex-col gap-5">
      <div className={`rounded-2xl border p-3 transition-colors ${highlightSchoolShortcut
        ? "border-primary/40 bg-primary/5"
        : subtleSchoolShortcut
          ? "border-primary/20 bg-card"
          : "border-border bg-card"}`}>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="community-filter" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <School className="h-4 w-4 text-primary" />
            {currentUserDirectorySchoolCode ? "Solo mi colegio" : "Solo mi comunidad"}
          </Label>
          <Switch id="community-filter" checked={onlyMyCommunity} disabled={!hasSchoolContext} onCheckedChange={setOnlyMyCommunity} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {!hasSchoolContext
            ? "Añade tu colegio en Mi cuenta. Mientras tanto, puedes explorar todos los anuncios."
            : schoolCount === 0
              ? "Tu colegio todavía no tiene anuncios disponibles. Puedes seguir viendo los de otros centros."
              : "Por defecto ves todos los anuncios. Activa este filtro cuando quieras centrarte en tu colegio."}
        </p>
        {hasSchoolContext && schoolCount !== null ? (
          <Badge variant={highlightSchoolShortcut ? "default" : "secondary"}
            className={`mt-2 ${subtleSchoolShortcut ? "bg-primary/10 text-primary" : ""}`}>
            {communityCountLabel}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-2"><Label className="text-sm font-medium text-foreground">Categoría</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex flex-col gap-2"><Label className="text-sm font-medium text-foreground">Curso / Etapa</Label><Select value={gradeLevel} onValueChange={setGradeLevel}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los cursos</SelectItem>{gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex flex-col gap-2"><Label className="text-sm font-medium text-foreground">Tipo</Label><Select value={listingType} onValueChange={setListingType}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Venta y donación</SelectItem><SelectItem value="sale">Solo venta</SelectItem><SelectItem value="donation">Solo donación</SelectItem></SelectContent></Select></div>
      <div className="flex flex-col gap-2"><Label className="text-sm font-medium text-foreground">Estado</Label><Select value={condition} onValueChange={setCondition}><SelectTrigger className="h-11"><span className="truncate">{condition === "all" ? "Todos los estados" : conditions.find((c) => c.value === condition)?.label ?? condition}</span></SelectTrigger><SelectContent className="w-[min(360px,calc(100vw-2rem))]"><SelectItem value="all">Todos los estados</SelectItem>{conditions.map((c) => <SelectItem key={c.value} value={c.value} textValue={c.label}><div className="flex flex-col gap-0.5 py-0.5"><span className="font-medium">{c.label}</span><span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">{c.description}</span></div></SelectItem>)}</SelectContent></Select></div>
      <div className="flex flex-col gap-3"><div className="flex items-center justify-between gap-3"><Label className="text-sm font-medium text-foreground">Precio</Label><span className="text-xs font-medium text-muted-foreground">{displayMinPrice} € - {displayMaxPrice >= PRICE_LIMIT ? "+200 €" : `${displayMaxPrice} €`}</span></div><Slider min={0} max={PRICE_LIMIT} step={1} value={priceRange} onValueChange={(value) => setPriceRange([value[0] ?? 0, value[1] ?? PRICE_LIMIT])} minStepsBetweenThumbs={1} aria-label="Rango de precio" className="py-3" /></div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-3"><Label className="flex items-center gap-2 text-sm font-medium text-foreground"><MapPin className="h-4 w-4 text-primary" />Distancia máxima</Label><span className="text-xs font-medium text-muted-foreground">{selectedDistanceLabel}</span></div><Slider min={1} max={DISTANCE_MAX} step={1} value={[distanceKm]} onValueChange={(value) => setDistanceKm(Math.round(value[0] ?? DISTANCE_MAX))} disabled={onlyMyCommunity} aria-label="Distancia máxima" className="py-3" /><div className="flex justify-between text-[10px] text-muted-foreground"><span>1 km</span><span>50 km</span><span>+200</span></div><p className="text-xs leading-relaxed text-muted-foreground">{onlyMyCommunity ? "Al filtrar por tu centro, la distancia queda desactivada." : hasViewerPostalCode ? "Usamos el código postal de tu cuenta como referencia aproximada. No mostramos direcciones exactas." : "Añade tu código postal en Mi cuenta para poder acotar por distancia."}</p></div>
      <div className="flex flex-col gap-3"><Label className="flex items-center gap-2 text-sm font-medium text-foreground"><CalendarDays className="h-4 w-4 text-primary" />Fecha de publicación</Label><div className="flex flex-col gap-2">{[{ value: "today", label: "Hoy" }, { value: "7d", label: "Últimos 7 días" }, { value: "30d", label: "Últimos 30 días" }].map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><Checkbox checked={publishedDateFilter === option.value} onCheckedChange={() => togglePublishedDateFilter(option.value as PublishedDateFilter)} /><span>{option.label}</span></label>)}</div></div>
      <div className="flex flex-col gap-2"><div className="flex items-center gap-1.5"><Label className="text-sm font-medium text-foreground">ISBN</Label><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 rounded-full"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="sr-only">Qué es el ISBN</span></Button></PopoverTrigger><PopoverContent className="w-72 text-sm" side="top"><p className="font-semibold text-foreground">Qué es el ISBN?</p><p className="mt-1 leading-relaxed text-muted-foreground">Es el código que identifica de forma única una edición de un libro. Úsalo para encontrar libros de texto concretos.</p></PopoverContent></Popover></div><Input value={isbnQuery} onChange={(e) => setIsbnQuery(e.target.value)} placeholder="Buscar por ISBN..." className="h-11 text-sm" /></div>
      {activeFiltersCount > 0 ? <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Limpiar filtros ({activeFiltersCount})</Button> : null}
    </div>
  );

  return <div className="bg-background"><div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{showSchoolInvite ? <div className="mb-5"><CommunityInviteCard campaign="school_joined" title="Ya formas parte de tu comunidad" description="Si conoces otra familia de tu entorno escolar, puedes invitarla ahora a Wetudy." /></div> : null}<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-foreground">Marketplace</h1><p className="text-sm text-muted-foreground">Comunidad Wetudy · {filteredListings.length} anuncios</p></div><Link href="/marketplace/new" className="hidden sm:block"><Button className="gap-2"><Plus className="h-4 w-4" />Publicar anuncio</Button></Link></div><div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por título, curso, ISBN o categoría..." className="h-12 pl-10 text-base sm:text-sm" /></div><div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center"><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-11 w-full sm:w-[220px]"><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="distance">Más cercanos</SelectItem><SelectItem value="price_asc">Precio: de menor a mayor</SelectItem><SelectItem value="price_desc">Precio: de mayor a menor</SelectItem><SelectItem value="discount">Mayor ahorro</SelectItem></SelectContent></Select><Sheet><SheetTrigger asChild><Button variant="outline" className="h-11 gap-2 lg:hidden"><SlidersHorizontal className="h-4 w-4" /><span>Filtros</span>{activeFiltersCount > 0 ? <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">{activeFiltersCount}</Badge> : null}</Button></SheetTrigger><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-6 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-96 sm:rounded-none sm:border-l"><SheetHeader className="px-0 pt-6"><SheetTitle>Filtros</SheetTitle></SheetHeader><FilterControls /></SheetContent></Sheet></div></div><div className="mt-4 flex flex-wrap gap-2 lg:hidden">{categories.slice(0, 5).map((item) => <Button key={item} type="button" variant={category === item ? "default" : "outline"} size="sm" onClick={() => setCategory(category === item ? "all" : item)} className="rounded-full">{item}</Button>)}</div><div className="mt-6 flex gap-8"><aside className="hidden w-64 shrink-0 lg:block"><div className="sticky top-24"><h3 className="mb-4 text-sm font-semibold text-foreground">Filtros</h3><FilterControls /></div></aside><div className="flex-1 pb-20 sm:pb-0">{schoolFeedPending ? <p role="status" className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Cargando los anuncios de tu colegio…</p> : schoolLoadError && !schoolLoaded ? <div role="alert" className="rounded-2xl border border-dashed p-8 text-center"><p className="mb-3 text-sm">No se han podido cargar los anuncios de tu colegio.</p><Button onClick={() => setOnlyMyCommunity(false)}>Ver todos los anuncios</Button></div> : filteredListings.length === 0 ? <Empty className="rounded-2xl border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><PackageSearch /></EmptyMedia><EmptyTitle>{emptySchoolView ? "Aún no hay coincidencias en tu colegio" : hasSearchIntent ? "Todavía no tenemos lo que buscas" : "Todavía no hay anuncios disponibles"}</EmptyTitle><EmptyDescription>{emptySchoolView ? "Tu colegio es solo una parte de Wetudy. Puedes seguir viendo anuncios de otros centros y volver a buscar aquí cuando quieras." : hasSearchIntent ? "Una búsqueda sin resultado es demanda real. Dinos exactamente qué necesitas y te avisaremos si aparece." : "Puedes publicar el primer anuncio o volver más adelante."}</EmptyDescription></EmptyHeader><EmptyContent>{hasSearchIntent ? <div className="mx-auto mb-3 w-full max-w-xl space-y-2 text-left"><Label htmlFor="zero-result-demand" className="text-sm font-medium">¿Qué necesitas exactamente?</Label><Textarea id="zero-result-demand" value={demandDetails} onChange={(event) => setDemandDetails(event.target.value)} maxLength={500} placeholder="Ej. Polo del Colegio X, talla 12, azul marino" className="min-h-20 resize-y bg-background" /><p className="text-xs text-muted-foreground">Los filtros y la búsqueda actuales se guardarán junto con este detalle. Avísame si aparece una coincidencia.</p></div> : null}<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">{hasSearchIntent ? <Button onClick={saveSearch} disabled={saveSearchStatus === "saving" || saveSearchStatus === "saved"} className="gap-2">{saveSearchStatus === "saved" ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}{saveSearchStatus === "saving" ? "Guardando..." : saveSearchStatus === "saved" ? "Demanda guardada" : "Guardar demanda y avisarme"}</Button> : null}{emptySchoolView ? <Button onClick={() => setOnlyMyCommunity(false)}>Ver todos los anuncios</Button> : null}<Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button><Link href="/marketplace/new"><Button variant={hasSearchIntent ? "outline" : "default"}>Publicar anuncio</Button></Link></div>{saveSearchStatus === "auth" ? <p className="mt-3 text-center text-sm text-muted-foreground">Para guardar la demanda, <Link href="/auth?next=/marketplace" className="font-medium text-primary underline-offset-4 hover:underline">inicia sesión o crea una cuenta</Link>.</p> : null}{saveSearchStatus === "error" ? <p className="mt-3 text-center text-sm text-destructive">No se pudo guardar la demanda. Prueba de nuevo.</p> : null}{saveSearchStatus === "saved" ? <p className="mt-3 text-center text-sm text-muted-foreground">Demanda registrada. Búsqueda guardada. Te avisaremos si aparece un anuncio compatible.</p> : null}</EmptyContent></Empty> : <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} currentSchoolId={currentUserSchoolId} />)}</div>}{((onlyMyCommunity && schoolLoaded && schoolHasMore) || (!onlyMyCommunity && generalHasMore)) ? <div ref={feedSentinelRef} aria-hidden="true" className="h-px w-full" /> : null}{((onlyMyCommunity && schoolLoading && schoolLoaded) || (!onlyMyCommunity && generalLoading)) ? <p role="status" aria-live="polite" className="py-5 text-center text-sm text-muted-foreground">Cargando más anuncios…</p> : null}{onlyMyCommunity && schoolLoaded && schoolLoadError ? <div role="alert" className="py-4 text-center"><p className="mb-2 text-sm text-destructive">No se pudieron cargar más anuncios de tu colegio.</p><Button variant="outline" onClick={loadMoreSchoolListings}>Reintentar carga</Button></div> : null}{!onlyMyCommunity && generalLoadError ? <div role="alert" className="py-4 text-center"><p className="mb-2 text-sm text-destructive">No se pudieron cargar más anuncios.</p><Button variant="outline" onClick={loadMoreGeneralListings}>Reintentar carga</Button></div> : null}</div></div><Link href="/marketplace/new" className="fixed bottom-4 right-4 z-30 sm:hidden"><Button className="h-12 rounded-full px-5 shadow-lg"><Plus className="mr-2 h-4 w-4" />Publicar</Button></Link></div></div>;
}
