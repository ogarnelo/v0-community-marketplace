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
import { diversifyRecentPages } from "@/lib/marketplace/diverse-feed.mjs";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

type MarketplaceClientProps = { initialListings: MarketplaceListing[]; initialSchoolId: string; initialDirectorySchoolCode?: string; initialPostalCode?: string; initialCommunityListingCount?: number | null; initialGeneralHasMore?: boolean; initialIsAuthenticated?: boolean; initialHasKnownPostalCode?: boolean };
type SaveSearchStatus = "idle" | "saving" | "saved" | "auth" | "error" | "details" | "postcode";
type PublishedDateFilter = "all" | "today" | "7d" | "30d";

const PRICE_LIMIT = 200;
const DISTANCE_MAX = 201;

function isAfterDate(value: string | null, filter: PublishedDateFilter) {
  if (filter === "all" || !value) return true; const createdAt = new Date(value).getTime(); if (!Number.isFinite(createdAt)) return true; const start = new Date();
  if (filter === "today") start.setHours(0, 0, 0, 0); if (filter === "7d") start.setDate(start.getDate() - 7); if (filter === "30d") start.setDate(start.getDate() - 30);
  return createdAt >= start.getTime();
}

export function MarketplaceClient({ initialListings, initialSchoolId, initialDirectorySchoolCode = "", initialPostalCode = "", initialCommunityListingCount = null, initialGeneralHasMore = false, initialIsAuthenticated = false, initialHasKnownPostalCode = false }: MarketplaceClientProps) {
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
  const [sortBy, setSortBy] = useState("explore");
  const [searchQuery, setSearchQuery] = useState("");
  const [isbnQuery, setIsbnQuery] = useState("");
  const [priceRange, setPriceRange] = useState([0, PRICE_LIMIT]);
  const [distanceKm, setDistanceKm] = useState(DISTANCE_MAX);
  const [publishedDateFilter, setPublishedDateFilter] = useState<PublishedDateFilter>("all");
  const [saveSearchStatus, setSaveSearchStatus] = useState<SaveSearchStatus>("idle");
  const [demandDetails, setDemandDetails] = useState("");
  const [showSchoolInvite, setShowSchoolInvite] = useState(false);
  const [generalAppliedKey, setGeneralAppliedKey] = useState("");
  const [schoolAppliedKey, setSchoolAppliedKey] = useState("");
  const [generalInitialRetry, setGeneralInitialRetry] = useState(0);
  const [schoolInitialRetry, setSchoolInitialRetry] = useState(0);
  const generalActiveKeyRef = useRef("");
  const observedDemandKeyRef = useRef("");
  const schoolActiveKeyRef = useRef("");

  // All active product criteria and postal radius are filtered server-side
  // BEFORE pagination. There is no client-side scan of irrelevant pages.
  const feedFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim().length >= 2) params.set("q", searchQuery.trim().slice(0, 90));
    if (isbnQuery.trim().length >= 2) params.set("isbn", isbnQuery.trim().slice(0, 30));
    if (category !== "all") params.set("category", category);
    if (gradeLevel !== "all") params.set("gradeLevel", gradeLevel);
    if (listingType !== "all") params.set("listingType", listingType);
    if (condition !== "all") params.set("condition", condition);
    if (priceRange[0] > 0) params.set("minPrice", String(priceRange[0]));
    if (priceRange[1] < PRICE_LIMIT) params.set("maxPrice", String(priceRange[1]));
    if (sortBy === "price_asc" || sortBy === "price_desc" || sortBy === "discount") params.set("sort", sortBy);
    if (sortBy === "distance" && initialHasKnownPostalCode && !onlyMyCommunity) params.set("sort", "distance");
    if (!onlyMyCommunity && distanceKm < DISTANCE_MAX && initialHasKnownPostalCode) {
      params.set("radiusKm", String(distanceKm));
    }
    if (publishedDateFilter !== "all") {
      const since = new Date();
      if (publishedDateFilter === "today") since.setHours(0, 0, 0, 0);
      if (publishedDateFilter === "7d") since.setDate(since.getDate() - 7);
      if (publishedDateFilter === "30d") since.setDate(since.getDate() - 30);
      params.set("since", since.toISOString());
    }
    return params.toString();
  }, [searchQuery, isbnQuery, category, gradeLevel, listingType, condition,
      priceRange, sortBy, publishedDateFilter, distanceKm, onlyMyCommunity, initialHasKnownPostalCode]);
  const [debouncedFeedFilters, setDebouncedFeedFilters] = useState(feedFilters);
  const filterDebouncing = feedFilters !== debouncedFeedFilters;
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFeedFilters(feedFilters), 350);
    return () => window.clearTimeout(id);
  }, [feedFilters]);



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

  // Restore filters from a saved-search URL after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q"), isbn = params.get("isbn");
    const fromCategory = params.get("category");
    const grade = params.get("grade") || params.get("gradeLevel");
    const type = params.get("type") || params.get("listingType");
    const fromCondition = params.get("condition");
    const fromRadius = params.get("radiusKm");
    if (q) setSearchQuery(q.slice(0, 90));
    if (isbn) setIsbnQuery(isbn.slice(0, 30));
    if (fromCategory) setCategory(fromCategory.slice(0, 80));
    if (grade) setGradeLevel(grade.slice(0, 80));
    if (type === "sale" || type === "donation") setListingType(type);
    if (fromCondition) setCondition(fromCondition.slice(0, 50));
    if (params.get("community") === "1" &&
        (currentUserSchoolId || currentUserDirectorySchoolCode)) {
      setOnlyMyCommunity(true);
    }
    if (fromRadius && /^[1-9][0-9]{0,2}$/.test(fromRadius) &&
        Number(fromRadius) <= 200) {
      if (initialHasKnownPostalCode) setDistanceKm(Number(fromRadius));
      else toast("Necesitas un código postal válido para recuperar el radio guardado", {
        description: "Revísalo en Mi cuenta.", duration: 5000,
      });
    }
  }, [initialHasKnownPostalCode, currentUserSchoolId, currentUserDirectorySchoolCode]);

  // Keep the full general catalogue server-filtered as the user edits
  // search controls; cancel stale requests and debounce keystrokes.
  useEffect(() => {
    if (onlyMyCommunity) return;
    const controller = new AbortController();
    const requestKey = debouncedFeedFilters;
    generalActiveKeyRef.current = requestKey;
    if (!requestKey) {
      setDbListings(initialListings);
      setGeneralOffset(initialListings.length);
      setGeneralHasMore(initialGeneralHasMore);
      setGeneralAppliedKey("");
      setGeneralLoadError(false);
      setGeneralLoading(false);
      return () => controller.abort();
    }
    setGeneralLoadError(false);
    setGeneralLoading(true);
    fetch("/api/marketplace/feed?offset=0&" + requestKey, {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("filtered_marketplace_request_failed");
        return response.json();
      })
      .then((payload) => {
        if (controller.signal.aborted || generalActiveKeyRef.current !== requestKey) return;
        const rows: MarketplaceListing[] = payload.listings || [];
        setDbListings(rows);
        setGeneralOffset(rows.length);
        setGeneralHasMore(Boolean(payload.hasMore) && rows.length > 0);
        setGeneralAppliedKey(requestKey);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGeneralLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setGeneralLoading(false);
      });
    return () => controller.abort();
  }, [onlyMyCommunity, debouncedFeedFilters, generalInitialRetry,
      initialListings, initialGeneralHasMore]);

  // The school scope is resolved using the authenticated account on the
  // server; only non-school filters are ever sent in query parameters.
  useEffect(() => {
    if (!onlyMyCommunity) return;
    const controller = new AbortController();
    const requestKey = debouncedFeedFilters;
    schoolActiveKeyRef.current = requestKey;
    setSchoolListings([]);
    setSchoolOffset(0);
    setSchoolHasMore(false);
    setSchoolLoaded(false);
    setSchoolLoading(true);
    setSchoolLoadError(false);
    fetch("/api/marketplace/my-school?offset=0" +
        (requestKey ? "&" + requestKey : ""), {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("school_listings_fetch_failed");
        return response.json();
      })
      .then((payload) => {
        if (controller.signal.aborted || schoolActiveKeyRef.current !== requestKey) return;
        const rows: MarketplaceListing[] = payload.listings || [];
        setSchoolListings(rows);
        setSchoolOffset(rows.length);
        if (!requestKey && typeof payload.total === "number") setSchoolCount(payload.total);
        setSchoolHasMore(Boolean(payload.hasMore) && rows.length > 0);
        setSchoolAppliedKey(requestKey);
        setSchoolLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSchoolLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSchoolLoading(false);
      });
    return () => controller.abort();
  }, [onlyMyCommunity, debouncedFeedFilters, schoolInitialRetry]);

  const loadMoreGeneralListings = useCallback(async () => {
    // A synchronous ref guard prevents duplicate requests from observer events
    // fired before React has flushed the loading state.
    if (onlyMyCommunity || generalLoading || !generalHasMore ||
        generalAppliedKey !== debouncedFeedFilters || filterDebouncing ||
        generalRequestInFlight.current) return;
    generalRequestInFlight.current = true;
    setGeneralLoading(true);
    setGeneralLoadError(false);
    try {
      const requestKey = debouncedFeedFilters;
      const response = await fetch(
        `/api/marketplace/feed?offset=${generalOffset}` +
          (requestKey ? "&" + requestKey : ""), { cache: "no-store" });
      if (!response.ok) throw new Error("catalogue_next_page_failed");
      const payload = await response.json();
      if (generalActiveKeyRef.current !== requestKey) return;
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
  }, [onlyMyCommunity, generalLoading, generalHasMore, generalOffset,
      debouncedFeedFilters, generalAppliedKey, filterDebouncing]);

  const loadMoreSchoolListings = useCallback(async () => {
    if (!onlyMyCommunity || !schoolLoaded || schoolLoading || !schoolHasMore ||
        schoolAppliedKey !== debouncedFeedFilters || filterDebouncing ||
        schoolRequestInFlight.current) return;
    schoolRequestInFlight.current = true;
    setSchoolLoading(true);
    setSchoolLoadError(false);
    try {
      const requestKey = debouncedFeedFilters;
      const response = await fetch(
        `/api/marketplace/my-school?offset=${schoolOffset}` +
          (requestKey ? "&" + requestKey : ""), { cache: "no-store" });
      if (!response.ok) throw new Error("school_listings_more_failed");
      const payload = await response.json();
      if (schoolActiveKeyRef.current !== requestKey) return;
      const rows: MarketplaceListing[] = payload.listings || [];
      setSchoolListings((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !ids.has(item.id))];
      });
      setSchoolOffset((current) => current + rows.length);
      if (!requestKey && typeof payload.total === "number") setSchoolCount(payload.total);
      setSchoolHasMore(Boolean(payload.hasMore) && rows.length > 0);
    } catch {
      setSchoolLoadError(true);
    } finally {
      schoolRequestInFlight.current = false;
      setSchoolLoading(false);
    }
  }, [onlyMyCommunity, schoolLoaded, schoolLoading, schoolHasMore, schoolOffset,
      schoolAppliedKey, debouncedFeedFilters, filterDebouncing]);

  useEffect(() => {
    const target = feedSentinelRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    // Never stop paginating after a fixed number of nonmatching cards:
    // there may still be a relevant local listing on a later page.
    const waiting = filterDebouncing || (onlyMyCommunity
      ? !schoolLoaded || schoolLoading || schoolLoadError || !schoolHasMore ||
        schoolAppliedKey !== debouncedFeedFilters
      : generalLoading || generalLoadError || !generalHasMore ||
        generalAppliedKey !== debouncedFeedFilters);
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
      generalAppliedKey, schoolAppliedKey, debouncedFeedFilters, filterDebouncing,
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
  const explainMissingPostalCode = () => {
    if (onlyMyCommunity || hasViewerPostalCode) return;
    toast("Para usar el filtro de distancia necesitas un código postal válido", {
      description: "Añádelo o compruébalo en Mi cuenta para explorar anuncios próximos a tu zona.",
      duration: 5000,
      action: {
        label: "Mi cuenta",
        onClick: () => window.location.assign("/account"),
      },
    });
  };

  const hasViewerPostalCode = initialHasKnownPostalCode;
  const hasSearchIntent = Boolean(searchQuery.trim() || isbnQuery.trim() || category !== "all" || gradeLevel !== "all" || listingType !== "all" || condition !== "all" || onlyMyCommunity || minPrice > 0 || maxPrice < PRICE_LIMIT || (!onlyMyCommunity && maxDistanceKm !== Infinity) || publishedDateFilter !== "all");
  const listingsWithDistance = useMemo(() => onlyMyCommunity ? schoolListings : dbListings,
    [dbListings, schoolListings, onlyMyCommunity]);

  const radiusIsActive = !onlyMyCommunity && maxDistanceKm !== Infinity;
  const filteredListings = useMemo(() => {
    // Server applies product filters plus approximate radius before pagination.
    // This status check is a defensive UI guard only.
    const filtered = listingsWithDistance.filter((listing) => {
      if (listing.status !== "available") return false;
      return true;
    });
    if (sortBy === "distance" && onlyMyCommunity) {
      return filtered.sort((a, b) =>
        (a.distance ?? Number.MAX_SAFE_INTEGER) -
        (b.distance ?? Number.MAX_SAFE_INTEGER));
    }
    // With no filters, show a stable category mix across each fetched page.
    // Other sort options preserve the strict server ordering.
    if (sortBy === "explore" && !hasSearchIntent) return diversifyRecentPages(filtered);
    return filtered;
  }, [listingsWithDistance, sortBy, onlyMyCommunity, maxDistanceKm, hasSearchIntent]);

  useEffect(() => {
    // Record search intent once per settled query, not once for every
    // infinite-scroll page. Anonymous events are discarded by the API, so
    // skip those POST requests entirely.
    if (!hasSearchIntent) {
      observedDemandKeyRef.current = "";
      return;
    }
    if (!initialIsAuthenticated || filterDebouncing) return;
    const resultReady = onlyMyCommunity
      ? schoolLoaded && !schoolLoadError &&
        schoolAppliedKey === debouncedFeedFilters
      : !generalLoadError && generalAppliedKey === debouncedFeedFilters;
    if (!resultReady) return;

    const rawSearchQuery = searchQuery.trim();
    const rawIsbnQuery = isbnQuery.trim();
    if ((rawSearchQuery.length === 1 || rawIsbnQuery.length === 1) ||
        (rawIsbnQuery && isIncompleteIsbnLikeInput(rawIsbnQuery)) ||
        (!rawIsbnQuery && rawSearchQuery && isIncompleteIsbnLikeInput(rawSearchQuery))) {
      return;
    }
    const key = JSON.stringify({
      filters: debouncedFeedFilters, school: onlyMyCommunity,
      radius: onlyMyCommunity ? null : maxDistanceKm,
    });
    if (observedDemandKeyRef.current === key) return;

    const canonicalIsbn =
      (rawIsbnQuery ? normalizeIsbn(rawIsbnQuery)?.canonicalIsbn || null : null) ||
      extractIsbnFromText(rawSearchQuery)?.canonicalIsbn || null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (observedDemandKeyRef.current === key) return;
      observedDemandKeyRef.current = key;
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
          // Count the first settled page; later scrolling never records again.
          resultsCount: filteredListings.length,
          sourcePath: "/marketplace",
        }),
        signal: controller.signal,
        keepalive: true,
      }).catch(() => undefined);
    }, 900);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [initialIsAuthenticated, hasSearchIntent, filterDebouncing,
      debouncedFeedFilters, onlyMyCommunity, maxDistanceKm,
      generalAppliedKey, generalLoadError,
      schoolAppliedKey, schoolLoaded, schoolLoadError,
      searchQuery, isbnQuery, category, gradeLevel,
      listingType, condition, minPrice, maxPrice]);
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
  const generalFeedPending = !onlyMyCommunity && (
    filterDebouncing || (!generalLoadError &&
      generalAppliedKey !== debouncedFeedFilters));
  const generalInitialError = !onlyMyCommunity && generalLoadError &&
    generalAppliedKey !== debouncedFeedFilters;
  const schoolFeedPending = onlyMyCommunity && (
    filterDebouncing || (!schoolLoadError && (
      !schoolLoaded || schoolAppliedKey !== debouncedFeedFilters)));
  const emptySchoolView = onlyMyCommunity && !schoolFeedPending && schoolLoaded &&
    schoolAppliedKey === debouncedFeedFilters && filteredListings.length === 0;
  const radiusNoMatches = radiusIsActive && !generalHasMore && filteredListings.length === 0;
  const widerRadius = [5, 10, 30, 50, 100, 200, DISTANCE_MAX].find((km) => km > distanceKm) ?? DISTANCE_MAX;

  const shortSearchTerm =
    searchQuery.trim().length === 1 || isbnQuery.trim().length === 1;
  const activeFiltersCount = [onlyMyCommunity, category !== "all", gradeLevel !== "all", listingType !== "all", condition !== "all", minPrice > 0 || maxPrice < PRICE_LIMIT, !onlyMyCommunity && maxDistanceKm !== Infinity, publishedDateFilter !== "all", isbnQuery.length > 0].filter(Boolean).length;
  const clearFilters = () => { setOnlyMyCommunity(false); setCategory("all"); setGradeLevel("all"); setListingType("all"); setCondition("all"); setSearchQuery(""); setIsbnQuery(""); setPriceRange([0, PRICE_LIMIT]); setDistanceKm(DISTANCE_MAX); setPublishedDateFilter("all"); setDemandDetails(""); };
  const saveSearch = async () => { if (!hasSearchIntent || saveSearchStatus === "saving" || saveSearchStatus === "saved") return; if (!searchQuery.trim() && !isbnQuery.trim() && category === "all" && gradeLevel === "all" && !demandDetails.trim()) { setSaveSearchStatus("details"); return; } setSaveSearchStatus("saving"); try { const response = await fetch("/api/marketplace/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery.trim() || null, isbnQuery: isbnQuery.trim() || null, category: category === "all" ? null : category, gradeLevel: gradeLevel === "all" ? null : gradeLevel, listingType: listingType === "all" ? null : listingType, condition: condition === "all" ? null : condition, onlyMyCommunity, radiusKm: maxDistanceKm === Infinity ? null : maxDistanceKm, resultsCount: filteredListings.length, sourcePath: "/marketplace", needDetails: demandDetails.trim() || searchQuery.trim() || null, intentSource: "zero_results_prompt" }) }); if (response.status === 401) return setSaveSearchStatus("auth"); if (response.status === 422) return setSaveSearchStatus("postcode"); if (!response.ok) throw new Error("saved_search_failed"); setSaveSearchStatus("saved"); setDemandDetails(""); } catch { setSaveSearchStatus("error"); } };
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
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3"
        onPointerDownCapture={explainMissingPostalCode}
        onKeyDownCapture={(event) => {
          if (!hasViewerPostalCode && !onlyMyCommunity &&
              (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            explainMissingPostalCode();
          }
        }}
        role={!hasViewerPostalCode && !onlyMyCommunity ? "button" : undefined}
        tabIndex={!hasViewerPostalCode && !onlyMyCommunity ? 0 : undefined}
        aria-label={!hasViewerPostalCode && !onlyMyCommunity
          ? "Distancia desactivada. Añade tu código postal en Mi cuenta" : undefined}>
        <div className="flex items-center justify-between gap-3"><Label className="flex items-center gap-2 text-sm font-medium text-foreground"><MapPin className="h-4 w-4 text-primary" />Distancia aproximada</Label><span className="text-xs font-medium text-muted-foreground">{selectedDistanceLabel}{distanceKm < DISTANCE_MAX ? " aprox." : ""}</span></div><Slider min={1} max={DISTANCE_MAX} step={1} value={[distanceKm]} onValueChange={(value) => setDistanceKm(Math.round(value[0] ?? DISTANCE_MAX))} disabled={onlyMyCommunity || !hasViewerPostalCode} aria-label="Distancia aproximada por provincia" className="py-3" /><div className="flex justify-between text-[10px] text-muted-foreground"><span>1 km</span><span>50 km</span><span>+200</span></div><p className="text-xs leading-relaxed text-muted-foreground">{onlyMyCommunity ? "Al filtrar por tu centro, la distancia queda desactivada." : hasViewerPostalCode ? "Estimación entre centros de códigos postales, no kilómetros exactos ni rutas. No mostramos direcciones." : "Añade tu código postal en Mi cuenta para poder acotar por distancia."}</p></div>
      <div className="flex flex-col gap-3"><Label className="flex items-center gap-2 text-sm font-medium text-foreground"><CalendarDays className="h-4 w-4 text-primary" />Fecha de publicación</Label><div className="flex flex-col gap-2">{[{ value: "today", label: "Hoy" }, { value: "7d", label: "Últimos 7 días" }, { value: "30d", label: "Últimos 30 días" }].map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><Checkbox checked={publishedDateFilter === option.value} onCheckedChange={() => togglePublishedDateFilter(option.value as PublishedDateFilter)} /><span>{option.label}</span></label>)}</div></div>
      <div className="flex flex-col gap-2"><div className="flex items-center gap-1.5"><Label className="text-sm font-medium text-foreground">ISBN</Label><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 rounded-full"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="sr-only">Qué es el ISBN</span></Button></PopoverTrigger><PopoverContent className="w-72 text-sm" side="top"><p className="font-semibold text-foreground">Qué es el ISBN?</p><p className="mt-1 leading-relaxed text-muted-foreground">Es el código que identifica de forma única una edición de un libro. Úsalo para encontrar libros de texto concretos.</p></PopoverContent></Popover></div><Input value={isbnQuery} onChange={(e) => setIsbnQuery(e.target.value)} placeholder="Buscar por ISBN..." className="h-11 text-sm" /></div>
      {activeFiltersCount > 0 ? <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Limpiar filtros ({activeFiltersCount})</Button> : null}
    </div>
  );

  return <div className="bg-background"><div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{showSchoolInvite ? <div className="mb-5"><CommunityInviteCard campaign="school_joined" title="Ya formas parte de tu comunidad" description="Si conoces otra familia de tu entorno escolar, puedes invitarla ahora a Wetudy." /></div> : null}<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-foreground">Marketplace</h1><p className="text-sm text-muted-foreground">Comunidad Wetudy · {generalFeedPending || schoolFeedPending ? "buscando" : filteredListings.length} anuncios visibles</p></div><Link href="/marketplace/new" className="hidden sm:block"><Button className="gap-2"><Plus className="h-4 w-4" />Publicar anuncio</Button></Link></div><div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por título, curso, ISBN o categoría..." className="h-12 pl-10 text-base sm:text-sm" /></div><div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center"><Select value={sortBy} onValueChange={(value) => {
          if (value === "distance" && !hasViewerPostalCode) {
            explainMissingPostalCode();
            return;
          }
          setSortBy(value);
        }}><SelectTrigger className="h-11 w-full sm:w-[220px]"><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="explore">Explorar (variedad)</SelectItem><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="distance">Más cercanos</SelectItem><SelectItem value="price_asc">Precio: de menor a mayor</SelectItem><SelectItem value="price_desc">Precio: de mayor a menor</SelectItem><SelectItem value="discount">Mayor ahorro</SelectItem></SelectContent></Select><Sheet><SheetTrigger asChild><Button variant="outline" className="h-11 gap-2 lg:hidden"><SlidersHorizontal className="h-4 w-4" /><span>Filtros</span>{activeFiltersCount > 0 ? <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">{activeFiltersCount}</Badge> : null}</Button></SheetTrigger><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-6 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-96 sm:rounded-none sm:border-l"><SheetHeader className="px-0 pt-6"><SheetTitle>Filtros</SheetTitle></SheetHeader><FilterControls /></SheetContent></Sheet></div></div><div className="mt-4 flex flex-wrap gap-2 lg:hidden">{categories.slice(0, 5).map((item) => <Button key={item} type="button" variant={category === item ? "default" : "outline"} size="sm" onClick={() => setCategory(category === item ? "all" : item)} className="rounded-full">{item}</Button>)}</div>{shortSearchTerm ? <p role="status" className="mt-2 text-xs text-muted-foreground">Escribe al menos 2 caracteres para buscar en todos los anuncios.</p> : null}{sortBy === "distance" ? <p className="mt-2 text-xs text-muted-foreground">{onlyMyCommunity ? "En tu colegio se ordenan los anuncios cargados." : radiusIsActive ? "Primero los anuncios más próximos dentro del radio seleccionado." : "Ordenación global por distancia aproximada entre códigos postales."}</p> : null}<div className="mt-6 flex gap-8"><aside className="hidden w-64 shrink-0 lg:block"><div className="sticky top-24"><h3 className="mb-4 text-sm font-semibold text-foreground">Filtros</h3><FilterControls /></div></aside><div className="flex-1 pb-20 sm:pb-0">{generalFeedPending || schoolFeedPending ? <p role="status" className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{onlyMyCommunity ? "Buscando anuncios de tu colegio…" : "Buscando anuncios en Wetudy…"}</p> : generalInitialError ? <div role="alert" className="rounded-2xl border border-dashed p-8 text-center"><p className="mb-3 text-sm">No se pudo completar la búsqueda.</p><Button variant="outline" onClick={() => setGeneralInitialRetry((n) => n + 1)}>Reintentar búsqueda</Button></div> : schoolLoadError && !schoolLoaded ? <div role="alert" className="rounded-2xl border border-dashed p-8 text-center"><p className="mb-3 text-sm">No se han podido cargar los anuncios de tu colegio.</p><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => setSchoolInitialRetry((n) => n + 1)}>Reintentar búsqueda</Button><Button onClick={() => setOnlyMyCommunity(false)}>Ver todos los anuncios</Button></div></div> : filteredListings.length === 0 ? <Empty className="rounded-2xl border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><PackageSearch /></EmptyMedia><EmptyTitle>{emptySchoolView ? "Aún no hay coincidencias en tu colegio" : radiusNoMatches ? `No encontramos anuncios a ${distanceKm} km aprox.` : hasSearchIntent ? "Todavía no tenemos lo que buscas" : "Todavía no hay anuncios disponibles"}</EmptyTitle><EmptyDescription>{emptySchoolView ? "Tu colegio es solo una parte de Wetudy. Puedes seguir viendo anuncios de otros centros y volver a buscar aquí cuando quieras." : radiusNoMatches ? "No hay coincidencias dentro del radio seleccionado. Puedes ampliarlo sin perder tu búsqueda ni los demás filtros, o guardar lo que necesitas." : hasSearchIntent ? "Una búsqueda sin resultado es demanda real. Dinos exactamente qué necesitas y te avisaremos si aparece." : "Puedes publicar el primer anuncio o volver más adelante."}</EmptyDescription></EmptyHeader><EmptyContent>{hasSearchIntent ? <div className="mx-auto mb-3 w-full max-w-xl space-y-2 text-left"><Label htmlFor="zero-result-demand" className="text-sm font-medium">¿Qué necesitas exactamente?</Label><Textarea id="zero-result-demand" value={demandDetails} onChange={(event) => { setDemandDetails(event.target.value); if (saveSearchStatus === "details") setSaveSearchStatus("idle"); }} maxLength={500} placeholder="Ej. Polo del Colegio X, talla 12, azul marino" className="min-h-20 resize-y bg-background" /><p className="text-xs text-muted-foreground">Los filtros y la búsqueda actuales se guardarán junto con este detalle. Avísame si aparece una coincidencia.</p></div> : null}<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">{hasSearchIntent ? <Button onClick={saveSearch} disabled={saveSearchStatus === "saving" || saveSearchStatus === "saved"} className="gap-2">{saveSearchStatus === "saved" ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}{saveSearchStatus === "saving" ? "Guardando..." : saveSearchStatus === "saved" ? "Demanda guardada" : "Guardar demanda y avisarme"}</Button> : null}{emptySchoolView ? <Button onClick={() => setOnlyMyCommunity(false)}>Ver todos los anuncios</Button> : null}{radiusNoMatches ? <Button onClick={() => setDistanceKm(widerRadius)}>Ampliar distancia</Button> : null}<Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button><Link href="/marketplace/new"><Button variant={hasSearchIntent ? "outline" : "default"}>Publicar anuncio</Button></Link></div>{saveSearchStatus === "auth" ? <p className="mt-3 text-center text-sm text-muted-foreground">Para guardar la demanda, <Link href="/auth?next=/marketplace" className="font-medium text-primary underline-offset-4 hover:underline">inicia sesión o crea una cuenta</Link>.</p> : null}{saveSearchStatus === "details" ? <p role="status" className="mt-3 text-center text-sm text-muted-foreground">Describe qué material necesitas para poder guardar el aviso.</p> : null}{saveSearchStatus === "postcode" ? <p role="alert" className="mt-3 text-center text-sm text-muted-foreground">Para guardar este radio, revisa tu código postal en Mi cuenta.</p> : null}{saveSearchStatus === "error" ? <p className="mt-3 text-center text-sm text-destructive">No se pudo guardar la demanda. Prueba de nuevo.</p> : null}{saveSearchStatus === "saved" ? <p className="mt-3 text-center text-sm text-muted-foreground">Demanda registrada. Búsqueda guardada. Te avisaremos si aparece un anuncio compatible.</p> : null}</EmptyContent></Empty> : <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} currentSchoolId={currentUserSchoolId} />)}</div>}{((onlyMyCommunity && schoolLoaded && schoolHasMore) || (!onlyMyCommunity && generalHasMore)) ? <div ref={feedSentinelRef} aria-hidden="true" className="h-px w-full" /> : null}{((onlyMyCommunity && schoolLoading && schoolLoaded) || (!onlyMyCommunity && generalLoading)) ? <p role="status" aria-live="polite" className="py-5 text-center text-sm text-muted-foreground">Cargando más anuncios…</p> : null}{onlyMyCommunity && schoolLoaded && schoolLoadError ? <div role="alert" className="py-4 text-center"><p className="mb-2 text-sm text-destructive">No se pudieron cargar más anuncios de tu colegio.</p><Button variant="outline" onClick={loadMoreSchoolListings}>Reintentar carga</Button></div> : null}{!onlyMyCommunity && generalLoadError ? <div role="alert" className="py-4 text-center"><p className="mb-2 text-sm text-destructive">No se pudieron cargar más anuncios.</p><Button variant="outline" onClick={loadMoreGeneralListings}>Reintentar carga</Button></div> : null}</div></div><Link href="/marketplace/new" className="fixed bottom-4 right-4 z-30 sm:hidden"><Button className="h-12 rounded-full px-5 shadow-lg"><Plus className="mr-2 h-4 w-4" />Publicar</Button></Link></div></div>;
}
