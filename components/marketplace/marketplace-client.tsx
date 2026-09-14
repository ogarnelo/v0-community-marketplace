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
import {
  Plus,
  Search,
  SlidersHorizontal,
  MapPin,
  X,
  HelpCircle,
  PackageSearch,
  School,
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parsePrice(value: string, fallback: number) {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type MarketplaceClientProps = {
  initialListings: MarketplaceListing[];
  initialSchoolId: string;
};

export function MarketplaceClient({ initialListings, initialSchoolId }: MarketplaceClientProps) {
  const [dbListings] = useState<MarketplaceListing[]>(initialListings);
  const [currentUserSchoolId] = useState(initialSchoolId);

  const [nearbyMode, setNearbyMode] = useState(false);
  const [onlyMyCommunity, setOnlyMyCommunity] = useState(false);
  const [radius, setRadius] = useState("10");
  const [category, setCategory] = useState("all");
  const [gradeLevel, setGradeLevel] = useState("all");
  const [listingType, setListingType] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [isbnQuery, setIsbnQuery] = useState("");
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const handleSliderChange = (values: number[]) => {
    setPriceRange(values);
    setPriceMin(values[0] === 0 ? "" : String(values[0]));
    setPriceMax(values[1] === 200 ? "" : String(values[1]));
  };

  const handlePriceMinChange = (val: string) => {
    setPriceMin(val);
    const num = parsePrice(val, 0);
    setPriceRange([Math.max(0, num), priceRange[1]]);
  };

  const handlePriceMaxChange = (val: string) => {
    setPriceMax(val);
    const num = parsePrice(val, 200);
    setPriceRange([priceRange[0], Math.max(priceRange[0], num)]);
  };

  const filteredListings = useMemo(() => {
    const filtered = dbListings.filter((l) => {
      if (l.status !== "available") return false;

      if (onlyMyCommunity && currentUserSchoolId && l.schoolId !== currentUserSchoolId) return false;
      if (category !== "all" && l.category !== category) return false;
      if (gradeLevel !== "all" && l.gradeLevel !== gradeLevel) return false;
      if (listingType !== "all" && l.type !== listingType) return false;
      if (condition !== "all" && l.condition !== condition) return false;

      if (searchQuery) {
        const normalized = normalizeText(searchQuery);
        const matchesSearch =
          normalizeText(l.title).includes(normalized) ||
          normalizeText(l.description || "").includes(normalized) ||
          normalizeText(l.category || "").includes(normalized);

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
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
  }, [
    dbListings,
    onlyMyCommunity,
    currentUserSchoolId,
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
  ]);

  useEffect(() => {
    const hasSearchIntent = Boolean(
      searchQuery.trim() ||
        isbnQuery.trim() ||
        category !== "all" ||
        gradeLevel !== "all" ||
        listingType !== "all" ||
        condition !== "all" ||
        onlyMyCommunity ||
        nearbyMode ||
        priceRange[0] > 0 ||
        priceRange[1] < 200
    );

    if (!hasSearchIntent) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch("/api/marketplace/search-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery.trim() || null,
          isbnQuery: isbnQuery.trim() || null,
          category: category === "all" ? null : category,
          gradeLevel: gradeLevel === "all" ? null : gradeLevel,
          listingType: listingType === "all" ? null : listingType,
          condition: condition === "all" ? null : condition,
          priceMin: priceRange[0] > 0 ? priceRange[0] : null,
          priceMax: priceRange[1] < 200 ? priceRange[1] : null,
          onlyMyCommunity,
          nearbyMode,
          radiusKm: nearbyMode ? Number(radius) : null,
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
  }, [
    searchQuery,
    isbnQuery,
    category,
    gradeLevel,
    listingType,
    condition,
    onlyMyCommunity,
    nearbyMode,
    radius,
    priceRange,
    filteredListings.length,
  ]);

  const activeFiltersCount = [
    onlyMyCommunity,
    nearbyMode,
    category !== "all",
    gradeLevel !== "all",
    listingType !== "all",
    condition !== "all",
    priceRange[0] > 0 || priceRange[1] < 200,
    isbnQuery.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setOnlyMyCommunity(false);
    setNearbyMode(false);
    setCategory("all");
    setGradeLevel("all");
    setListingType("all");
    setCondition("all");
    setSearchQuery("");
    setIsbnQuery("");
    setPriceRange([0, 200]);
    setPriceMin("");
    setPriceMax("");
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-5">
      {currentUserSchoolId ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="community-filter" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <School className="h-4 w-4 text-primary" />
              Solo mi comunidad
            </Label>
            <Switch id="community-filter" checked={onlyMyCommunity} onCheckedChange={setOnlyMyCommunity} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Úsalo para priorizar anuncios de tu centro. Wetudy también puede mostrar anuncios útiles de otras comunidades.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Categoría</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Curso / Etapa</Label>
        <Select value={gradeLevel} onValueChange={setGradeLevel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cursos</SelectItem>
            {gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Tipo</Label>
        <Select value={listingType} onValueChange={setListingType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Venta y donación</SelectItem>
            <SelectItem value="sale">Solo venta</SelectItem>
            <SelectItem value="donation">Solo donación</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Estado</Label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger>
            <span className="truncate">
              {condition === "all" ? "Todos los estados" : conditions.find((c) => c.value === condition)?.label ?? condition}
            </span>
          </SelectTrigger>
          <SelectContent className="w-[min(360px,calc(100vw-2rem))]">
            <SelectItem value="all">Todos los estados</SelectItem>
            {conditions.map((c) => (
              <SelectItem key={c.value} value={c.value} textValue={c.label}>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="font-medium">{c.label}</span>
                  <span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">{c.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium text-foreground">Rango de precio</Label>
        <Slider value={priceRange} onValueChange={handleSliderChange} min={0} max={200} step={5} className="w-full" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input inputMode="decimal" type="text" placeholder="Min" value={priceMin} onChange={(e) => handlePriceMinChange(e.target.value)} className="h-8 pr-6 text-sm" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
          <span className="text-xs text-muted-foreground">-</span>
          <div className="relative flex-1">
            <Input inputMode="decimal" type="text" placeholder="Max" value={priceMax} onChange={(e) => handlePriceMaxChange(e.target.value)} className="h-8 pr-6 text-sm" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
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
                <span className="sr-only">Qué es el ISBN</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm" side="top">
              <p className="font-semibold text-foreground">Qué es el ISBN?</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Es el código que identifica de forma única una edición de un libro. Úsalo para encontrar libros de texto concretos.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <Input value={isbnQuery} onChange={(e) => setIsbnQuery(e.target.value)} placeholder="Buscar por ISBN..." className="h-8 text-sm" />
      </div>

      {activeFiltersCount > 0 ? (
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
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
            <p className="text-sm text-muted-foreground">Comunidad Wetudy · {filteredListings.length} anuncios</p>
          </div>
          <Link href="/marketplace/new">
            <Button className="gap-2"><Plus className="h-4 w-4" />Publicar anuncio</Button>
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Switch checked={nearbyMode} onCheckedChange={setNearbyMode} id="nearby" />
              <Label htmlFor="nearby" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {nearbyMode ? "Cerca de mí" : "Todos los anuncios"}
              </Label>
            </div>
            {nearbyMode ? (
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
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
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar material, curso o categoría..." className="pl-10" />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="price_asc">Precio: de menor a mayor</SelectItem>
              <SelectItem value="price_desc">Precio: de mayor a menor</SelectItem>
              <SelectItem value="discount">Mayor ahorro</SelectItem>
            </SelectContent>
          </Select>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />Filtros
                {activeFiltersCount > 0 ? <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">{activeFiltersCount}</Badge> : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
              <div className="mt-6"><FilterControls /></div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-6 flex gap-8">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Filtros</h3>
              <FilterControls />
            </div>
          </aside>

          <div className="flex-1">
            {filteredListings.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><PackageSearch /></EmptyMedia>
                  <EmptyTitle>No hay anuncios con esos filtros</EmptyTitle>
                  <EmptyDescription>
                    Hemos guardado esta señal de demanda para entender qué material falta. Prueba a ampliar la búsqueda o publica el primer anuncio.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
                    <Link href="/marketplace/new"><Button>Publicar anuncio</Button></Link>
                  </div>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} currentSchoolId={currentUserSchoolId} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
