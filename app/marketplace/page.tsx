"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListingCard } from "@/components/listing-card";
import { categories, gradeLevels, conditions } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Search,
  SlidersHorizontal,
  MapPin,
  X,
  HelpCircle,
  PackageSearch,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  buildPhotosMap,
  type ListingPhotoRow,
  type ListingRow,
  type MarketplaceListing,
  type ProfileRow,
} from "@/lib/types/marketplace";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import SaveSearchButton from "@/components/marketplace/save-search-button";

export default function MarketplacePage() {
  const [dbListings, setDbListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserSchoolId, setCurrentUserSchoolId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [latestBoostMap, setLatestBoostMap] = useState<Map<string, string>>(new Map());

  const [nearbyMode, setNearbyMode] = useState(false);
  const [radius, setRadius] = useState("10");
  const [category, setCategory] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("category") || "all" : "all");
  const [gradeLevel, setGradeLevel] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("grade") || "all" : "all");
  const [listingType, setListingType] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") || "all" : "all");
  const [condition, setCondition] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("condition") || "all" : "all");
  const [sortBy, setSortBy] = useState("newest");
  const [followedOnly, setFollowedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") || "" : "");
  const [isbnQuery, setIsbnQuery] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("isbn") || "" : "");
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  useEffect(() => {
    const loadListings = async () => {
      setLoading(true);

      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        let favoriteIds = new Set<string>();
        let viewerSchoolId = "";
        let nextCurrentUserId = "";
        let nextFollowingIds: string[] = [];

        if (user) {
          nextCurrentUserId = user.id;

          const [{ data: favorites }, { data: profile }, { data: follows }] = await Promise.all([
            supabase
              .from("favorites")
              .select("listing_id")
              .eq("user_id", user.id),
            supabase
              .from("profiles")
              .select("id, full_name, user_type, school_id")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("user_follows")
              .select("following_id")
              .eq("follower_id", user.id),
          ]);

          favoriteIds = new Set(
            (favorites || []).map((fav: { listing_id: string }) => fav.listing_id)
          );

          nextFollowingIds = (follows || []).map((row: { following_id: string }) => row.following_id);

          const typedProfile = (profile as ProfileRow | null) ?? null;

          viewerSchoolId =
            typedProfile?.school_id && typedProfile.school_id.trim().length > 0
              ? typedProfile.school_id
              : "";
        }

        setCurrentUserSchoolId(viewerSchoolId);
        setCurrentUserId(nextCurrentUserId);
        setFollowingIds(nextFollowingIds);

        const { data: listingsData, error: listingsError } = await supabase
          .from("listings")
          .select(
            "id, title, description, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, user_id, school_id, status, created_at"
          )
          .eq("status", "available")
          .order("created_at", { ascending: false });

        if (listingsError) {
          console.error("Error cargando listings:", listingsError);
          setDbListings([]);
          return;
        }

        const listingRows = (listingsData || []) as ListingRow[];
        const listingIds = listingRows.map((item) => item.id);

        let photosMap = new Map<string, string[]>();
        let boostsMap = new Map<string, string>();

        if (listingIds.length > 0) {
          const [{ data: listingPhotos, error: listingPhotosError }, { data: boostsData, error: boostsError }] = await Promise.all([
            supabase
              .from("listing_photos")
              .select("id, listing_id, url, sort_order")
              .in("listing_id", listingIds)
              .order("sort_order", { ascending: true }),
            supabase
              .from("listing_boosts")
              .select("listing_id, created_at")
              .in("listing_id", listingIds)
              .order("created_at", { ascending: false }),
          ]);

          if (listingPhotosError) {
            console.error("Error cargando listing_photos:", listingPhotosError);
          } else {
            photosMap = buildPhotosMap((listingPhotos || []) as ListingPhotoRow[]);
          }

          if (boostsError) {
            console.error("Error cargando listing_boosts:", boostsError);
          } else {
            for (const boost of (boostsData || []) as { listing_id: string; created_at: string }[]) {
              if (!boostsMap.has(boost.listing_id)) {
                boostsMap.set(boost.listing_id, boost.created_at);
              }
            }
          }
        }

        setLatestBoostMap(boostsMap);

        const mapped: MarketplaceListing[] = listingRows.map((item) => ({
          id: item.id,
          title: item.title || "Anuncio sin título",
          description: item.description || null,
          category: item.category,
          gradeLevel: item.grade_level,
          condition: item.condition,
          type: item.type || item.listing_type,
          isbn: item.isbn || null,
          price: item.price ?? undefined,
          originalPrice:
            item.original_price ?? item.estimated_retail_price ?? undefined,
          photos: photosMap.get(item.id) || [],
          sellerId: item.seller_id || item.user_id || null,
          schoolId: item.school_id || null,
          status: item.status,
          createdAt: item.created_at || null,
          distance: undefined,
          isFavorite: favoriteIds.has(item.id),
        }));

        setDbListings(mapped);
      } catch (error) {
        console.error("Error cargando marketplace:", error);
        setDbListings([]);
      } finally {
        setLoading(false);
      }
    };

    void loadListings();
  }, []);

  const handleSliderChange = (values: number[]) => {
    setPriceRange(values);
    setPriceMin(values[0] === 0 ? "" : String(values[0]));
    setPriceMax(values[1] === 200 ? "" : String(values[1]));
  };

  const handlePriceMinChange = (val: string) => {
    setPriceMin(val);
    const num = Number(val) || 0;
    setPriceRange([num, priceRange[1]]);
  };

  const handlePriceMaxChange = (val: string) => {
    setPriceMax(val);
    const num = Number(val) || 200;
    setPriceRange([priceRange[0], num]);
  };

  const filteredListings = useMemo(() => {
    const filtered = dbListings.filter((l) => {
      if (l.status !== "available") return false;

      if (category !== "all" && l.category !== category) return false;
      if (gradeLevel !== "all" && l.gradeLevel !== gradeLevel) return false;
      if (listingType !== "all" && l.type !== listingType) return false;
      if (condition !== "all" && l.condition !== condition) return false;

      if (searchQuery) {
        const normalized = searchQuery.toLowerCase();
        const matchesSearch =
          l.title.toLowerCase().includes(normalized) ||
          (l.description || "").toLowerCase().includes(normalized);

        if (!matchesSearch) return false;
      }

      if (isbnQuery) {
        const normalizedIsbn = isbnQuery.replace(/[^0-9xX]/g, "").toLowerCase();
        const listingIsbn = (l.isbn || "").replace(/[^0-9xX]/g, "").toLowerCase();

        if (!listingIsbn.includes(normalizedIsbn)) return false;
      }

      if (l.type === "sale" && l.price !== undefined) {
        if (l.price < priceRange[0] || l.price > priceRange[1]) return false;
      }

      if (nearbyMode && l.distance && l.distance > Number(radius)) return false;
      if (followedOnly && (!l.sellerId || !followingIds.includes(l.sellerId))) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return (a.price ?? 0) - (b.price ?? 0);
        case "price_desc":
          return (b.price ?? 0) - (a.price ?? 0);
        case "discount": {
          const discountA = (a.originalPrice ?? 0) - (a.price ?? 0);
          const discountB = (b.originalPrice ?? 0) - (b.price ?? 0);
          return discountB - discountA;
        }
        case "newest":
        default: {
          const boostedAtA = latestBoostMap.get(a.id) || a.createdAt || "";
          const boostedAtB = latestBoostMap.get(b.id) || b.createdAt || "";
          return new Date(boostedAtB || 0).getTime() - new Date(boostedAtA || 0).getTime();
        }
      }
    });
  }, [
    dbListings,
    nearbyMode,
    radius,
    category,
    gradeLevel,
    listingType,
    condition,
    searchQuery,
    isbnQuery,
    priceRange,
    sortBy,
    followedOnly,
    followingIds,
    latestBoostMap,
  ]);

  const activeFiltersCount = [
    category !== "all",
    gradeLevel !== "all",
    listingType !== "all",
    condition !== "all",
    priceRange[0] > 0 || priceRange[1] < 200,
    isbnQuery.length > 0,
    followedOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCategory("all");
    setGradeLevel("all");
    setListingType("all");
    setCondition("all");
    setSearchQuery("");
    setIsbnQuery("");
    setPriceRange([0, 200]);
    setPriceMin("");
    setPriceMax("");
    setFollowedOnly(false);
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-5">
      {currentUserId ? (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium text-foreground">Solo perfiles que sigues</Label>
            <p className="text-xs text-muted-foreground">Muestra solo anuncios de usuarios que ya sigues.</p>
          </div>
          <Switch checked={followedOnly} onCheckedChange={setFollowedOnly} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">
          Curso / Etapa
        </Label>
        <Select value={gradeLevel} onValueChange={setGradeLevel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cursos</SelectItem>
            {gradeLevels.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Tipo</Label>
        <Select value={listingType} onValueChange={setListingType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Venta y donacion</SelectItem>
            <SelectItem value="sale">Solo venta</SelectItem>
            <SelectItem value="donation">Solo donacion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Estado</Label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger>
            <span className="truncate">
              {condition === "all"
                ? "Todos los estados"
                : conditions.find((c) => c.value === condition)?.label ??
                condition}
            </span>
          </SelectTrigger>
          <SelectContent className="w-[min(360px,calc(100vw-2rem))]">
            <SelectItem value="all">Todos los estados</SelectItem>
            {conditions.map((c) => (
              <SelectItem key={c.value} value={c.value} textValue={c.label}>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="font-medium">{c.label}</span>
                  <span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">
                    {c.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium text-foreground">
          Rango de precio
        </Label>
        <Slider
          value={priceRange}
          onValueChange={handleSliderChange}
          min={0}
          max={200}
          step={5}
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Min"
              value={priceMin}
              onChange={(e) => handlePriceMinChange(e.target.value)}
              className="h-8 pr-6 text-sm"
              min={0}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              €
            </span>
          </div>
          <span className="text-xs text-muted-foreground">-</span>
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Max"
              value={priceMax}
              onChange={(e) => handlePriceMaxChange(e.target.value)}
              className="h-8 pr-6 text-sm"
              min={0}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              €
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm font-medium text-foreground">ISBN</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="sr-only">Que es el ISBN</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm" side="top">
              <p className="font-semibold text-foreground">Que es el ISBN?</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                ISBN son las siglas de International Standard Book Number y
                consiste en un codigo que nos sirve para identificar de manera
                unica cada producto editorial.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          value={isbnQuery}
          onChange={(e) => setIsbnQuery(e.target.value)}
          placeholder="Buscar por ISBN..."
          className="h-8 text-sm"
        />
      </div>

      {activeFiltersCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5" /> Limpiar filtros ({activeFiltersCount})
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              Comunidad Wetudy · {filteredListings.length} anuncios
            </p>
          </div>

          <Link href="/marketplace/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Publicar anuncio
            </Button>
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={nearbyMode}
                onCheckedChange={setNearbyMode}
                id="nearby"
              />
              <Label
                htmlFor="nearby"
                className="flex cursor-pointer items-center gap-1.5 text-sm font-medium"
              >
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {nearbyMode ? "Cerca de mi" : "Todos los anuncios"}
              </Label>
            </div>
            {nearbyMode ? (
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="20">20 km</SelectItem>
                  <SelectItem value="50">50 km</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar material..."
              className="pl-10"
            />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="price_asc">Precio: de menor a mayor</SelectItem>
              <SelectItem value="price_desc">Precio: de mayor a menor</SelectItem>
              <SelectItem value="discount">Mayor ahorro</SelectItem>
            </SelectContent>
          </Select>

          {currentUserId ? (
            <SaveSearchButton
              query={searchQuery}
              category={category}
              gradeLevel={gradeLevel}
              condition={condition}
              listingType={listingType}
              isbn={isbnQuery}
              minPrice={priceRange[0] > 0 ? priceRange[0] : null}
              maxPrice={priceRange[1] < 200 ? priceRange[1] : null}
            />
          ) : null}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 ? (
                  <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-6 flex gap-8">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Filtros
              </h3>
              <FilterControls />
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl border bg-card">
                    <Skeleton className="aspect-[4/3] w-full" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredListings.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageSearch />
                  </EmptyMedia>
                  <EmptyTitle>No hay anuncios con esos filtros</EmptyTitle>
                  <EmptyDescription>
                    Prueba a ampliar la búsqueda, quitar filtros o publicar el primer producto si todavía no hay oferta para eso.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
                    <Link href="/marketplace/new">
                      <Button>Publicar anuncio</Button>
                    </Link>
                  </div>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    currentSchoolId={currentUserSchoolId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
