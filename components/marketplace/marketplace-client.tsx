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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListingCard } from "@/components/listing-card";
import { categories, gradeLevels, conditions } from "@/lib/mock-data";
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type MarketplaceClientProps = {
  initialListings: MarketplaceListing[];
  initialSchoolId: string;
};

type SaveSearchStatus = "idle" | "saving" | "saved" | "auth" | "error";
type PublicationDateFilter = "all" | "today" | "7d" | "30d";

const PRICE_MIN = 0;
const PRICE_MAX = 200;
const DISTANCE_STEPS = [1, 5, 10, 30, 50, 100, 200, 201] as const;
const PUBLICATION_DATE_OPTIONS: Array<{ value: PublicationDateFilter; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
];

function formatDistanceLabel(value: number) {
  return value > 200 ? "+200 km" : `${value} km`;
}

function publicationDateThreshold(filter: PublicationDateFilter) {
  if (filter === "all") return null;
  const threshold = new Date();
  if (filter === "today") threshold.setHours(0, 0, 0, 0);
  if (filter === "7d") threshold.setDate(threshold.getDate() - 7);
  if (filter === "30d") threshold.setDate(threshold.getDate() - 30);
  return threshold;
}

export function MarketplaceClient({ initialListings, initialSchoolId }: MarketplaceClientProps) {
  const [dbListings] = useState<MarketplaceListing[]>(initialListings);
  const [currentUserSchoolId] = useState(initialSchoolId);

  const [onlyMyCommunity, setOnlyMyCommunity] = useState(false);
  const [category, setCategory] = useState("all");
  const [gradeLevel, setGradeLevel] = useState("all");
  const [listingType, setListingType] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [isbnQuery, setIsbnQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [distanceStepIndex, setDistanceStepIndex] = useState(DISTANCE_STEPS.length - 1);
  const [publicationDateFilter, setPublicationDateFilter] = useState<PublicationDateFilter>("all");
  const [saveSearchStatus, setSaveSearchStatus] = useState<SaveSearchStatus>("idle");

  const priceMinValue = priceRange[0];
  const priceMaxValue = priceRange[1];
  const radiusKm = DISTANCE_STEPS[distanceStepIndex];
  const hasPriceFilter = priceMinValue > PRICE_MIN || priceMaxValue < PRICE_MAX;
  const hasDistanceFilter = !onlyMyCommunity && radiusKm <= 200;
  const hasDateFilter = publicationDateFilter !== "all";

  const hasSearchIntent = Boolean(
    searchQuery.trim() ||
      isbnQuery.trim() ||
      category !== "all" ||
      gradeLevel !== "all" ||
      listingType !== "all" ||
      condition !== "all" ||
      onlyMyCommunity ||
      hasPriceFilter ||
      hasDistanceFilter ||
      hasDateFilter
  );

  const filteredListings = useMemo(() => {
    const normalizedSearch = normalizeText(searchQuery);
    const dateThreshold = publicationDateThreshold(publicationDateFilter);

    const filtered = dbListings.filter((l) => {
      if (l.status !== "available") return false;

      if (onlyMyCommunity && currentUserSchoolId && l.schoolId !== currentUserSchoolId) return false;
      if (category !== "all" && l.category !== category) return false;
      if (gradeLevel !== "all" && l.gradeLevel !== gradeLevel) return false;
      if (listingType !== "all" && l.type !== listingType) return false;
      if (condition !== "all" && l.condition !== condition) return false;

      if (dateThreshold) {
        if (!l.createdAt) return false;
        if (new Date(l.createdAt) < dateThreshold) return false;
      }

      if (hasDistanceFilter && typeof l.distance === "number" && l.distance > radiusKm) return false;

      if (normalizedSearch) {
        const matchesSearch =
          normalizeText(l.title).includes(normalizedSearch) ||
          normalizeText(l.description || "").includes(normalizedSearch) ||
          normalizeText(l.category || "").includes(normalizedSearch) ||
          normalizeText(l.gradeLevel || "").includes(normalizedSearch);

        if (!matchesSearch) return false;
      }

      if (isbnQuery) {
        const normalizedIsbn = isbnQuery.replace(/[^0-9xX]/g, "").toLowerCase();
        const listingIsbn = (l.isbn || "").replace(/[^0-9xX]/g, "").toLowerCase();

        if (!listingIsbn.includes(normalizedIsbn)) return false;
      }

      if (l.type === "sale" && l.price !== undefined) {
        if (l.price < priceMinValue || l.price > priceMaxValue) return false;
      }

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
    category,
    gradeLevel,
    listingType,
    condition,
    searchQuery,
    isbnQuery,
    priceMinValue,
    priceMaxValue,
    sortBy,
    publicationDateFilter,
    hasDistanceFilter,
    radiusKm,
  ]);

  useEffect(() => {
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
          priceMin: hasPriceFilter ? priceMinValue : null,
          priceMax: hasPriceFilter ? priceMaxValue : null,
          onlyMyCommunity,
          nearbyMode: hasDistanceFilter,
          radiusKm: hasDistanceFilter ? radiusKm : null,
          publicationDate: publicationDateFilter === "all" ? null : publicationDateFilter,
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
    priceMinValue,
    priceMaxValue,
    hasPriceFilter,
    hasDistanceFilter,
    radiusKm,
    publicationDateFilter,
    filteredListings.length,
    hasSearchIntent,
  ]);

  useEffect(() => {
    setSaveSearchStatus("idle");
  }, [searchQuery, isbnQuery, category, gradeLevel, listingType, condition, onlyMyCommunity, priceRange, radiusKm, publicationDateFilter]);

  const activeFiltersCount = [
    onlyMyCommunity,
    category !== "all",
    gradeLevel !== "all",
    listingType !== "all",
    condition !== "all",
    hasPriceFilter,
    isbnQuery.length > 0,
    hasDistanceFilter,
    hasDateFilter,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setOnlyMyCommunity(false);
    setCategory("all");
    setGradeLevel("all");
    setListingType("all");
    setCondition("all");
    setSearchQuery("");
    setIsbnQuery("");
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setDistanceStepIndex(DISTANCE_STEPS.length - 1);
    setPublicationDateFilter("all");
  };

  const saveSearch = async () => {
    if (!hasSearchIntent || saveSearchStatus === "saving" || saveSearchStatus === "saved") return;

    setSaveSearchStatus("saving");

    try {
      const response = await fetch("/api/marketplace/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery.trim() || null,
          isbnQuery: isbnQuery.trim() || null,
          category: category === "all" ? null : category,
          gradeLevel: gradeLevel === "all" ? null : gradeLevel,
          listingType: listingType === "all" ? null : listingType,
          condition: condition === "all" ? null : condition,
          onlyMyCommunity,
          resultsCount: filteredListings.length,
          sourcePath: "/marketplace",
        }),
      });

      if (response.status === 401) {
        setSaveSearchStatus("auth");
        return;
      }

      if (!response.ok) throw new Error("saved_search_failed");

      setSaveSearchStatus("saved");
    } catch {
      setSaveSearchStatus("error");
    }
  };

  const togglePublicationDate = (value: PublicationDateFilter, checked: boolean | "indeterminate") => {
    setPublicationDateFilter(checked === true ? value : "all");
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="community-filter" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <School className="h-4 w-4 text-primary" />
            Solo mi comunidad
          </Label>
          <Switch id="community-filter" checked={onlyMyCommunity} disabled={!currentUserSchoolId} onCheckedChange={setOnlyMyCommunity} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {currentUserSchoolId
            ? "Actívalo para priorizar anuncios de tu centro."
            : "Añade tu centro en Mi cuenta para activar este filtro."}
        </p>
      </div>

      {!onlyMyCommunity ? (
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Distancia máxima
            </Label>
            <span className="text-sm font-semibold text-foreground">{formatDistanceLabel(radiusKm)}</span>
          </div>
          <Slider
            value={[distanceStepIndex]}
            min={0}
            max={DISTANCE_STEPS.length - 1}
            step={1}
            onValueChange={(value) => setDistanceStepIndex(value[0] ?? DISTANCE_STEPS.length - 1)}
            className="mt-4"
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {DISTANCE_STEPS.map((step) => (
              <span key={step}>{step === 201 ? "+200" : step}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Categoría</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Curso / Etapa</Label>
        <Select value={gradeLevel} onValueChange={setGradeLevel}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cursos</SelectItem>
            {gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-foreground">Tipo</Label>
        <Select value={listingType} onValueChange={setListingType}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="h-11">
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
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-medium text-foreground">Rango de precio</Label>
          <span className="text-sm font-semibold text-foreground">{priceMinValue} € - {priceMaxValue >= PRICE_MAX ? `+${PRICE_MAX} €` : `${priceMaxValue} €`}</span>
        </div>
        <Slider
          value={priceRange}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={5}
          minStepsBetweenThumbs={1}
          onValueChange={(value) => setPriceRange([value[0] ?? PRICE_MIN, value[1] ?? PRICE_MAX])}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{PRICE_MIN} €</span>
          <span>{PRICE_MAX}+ €</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          Fecha de publicación
        </Label>
        <div className="grid gap-3">
          {PUBLICATION_DATE_OPTIONS.map((option) => (
            <Label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm font-normal text-foreground">
              <Checkbox
                checked={publicationDateFilter === option.value}
                onCheckedChange={(checked) => togglePublicationDate(option.value, checked)}
              />
              {option.label}
            </Label>
          ))}
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
        <Input value={isbnQuery} onChange={(e) => setIsbnQuery(e.target.value)} placeholder="Buscar por ISBN..." className="h-11 text-sm" />
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
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
            <p className="text-sm text-muted-foreground">Comunidad Wetudy · {filteredListings.length} anuncios</p>
          </div>
          <Link href="/marketplace/new" className="hidden sm:block">
            <Button className="gap-2"><Plus className="h-4 w-4" />Publicar anuncio</Button>
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por título, curso, ISBN o categoría..." className="h-12 pl-10 text-base sm:text-sm" />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-11 w-full sm:w-[220px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="price_asc">Precio: de menor a mayor</SelectItem>
                <SelectItem value="price_desc">Precio: de mayor a menor</SelectItem>
                <SelectItem value="discount">Mayor ahorro</SelectItem>
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 lg:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filtros</span>
                  {activeFiltersCount > 0 ? <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">{activeFiltersCount}</Badge> : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-6 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-96 sm:rounded-none sm:border-l">
                <SheetHeader className="px-0 pt-6"><SheetTitle>Filtros</SheetTitle></SheetHeader>
                <FilterControls />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
          {categories.slice(0, 5).map((item) => (
            <Button key={item} type="button" variant={category === item ? "default" : "outline"} size="sm" onClick={() => setCategory(category === item ? "all" : item)} className="rounded-full">
              {item}
            </Button>
          ))}
        </div>

        <div className="mt-6 flex gap-8">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Filtros</h3>
              <FilterControls />
            </div>
          </aside>

          <div className="flex-1 pb-20 sm:pb-0">
            {filteredListings.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><PackageSearch /></EmptyMedia>
                  <EmptyTitle>No hay anuncios con esos filtros</EmptyTitle>
                  <EmptyDescription>
                    Podemos guardar esta búsqueda para entender qué material falta y avisarte cuando activemos las notificaciones.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    {hasSearchIntent ? (
                      <Button onClick={saveSearch} disabled={saveSearchStatus === "saving" || saveSearchStatus === "saved"} className="gap-2">
                        {saveSearchStatus === "saved" ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        {saveSearchStatus === "saving" ? "Guardando..." : saveSearchStatus === "saved" ? "Búsqueda guardada" : "Avísame si aparece"}
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
                    <Link href="/marketplace/new"><Button variant={hasSearchIntent ? "outline" : "default"}>Publicar anuncio</Button></Link>
                  </div>
                  {saveSearchStatus === "auth" ? (
                    <p className="mt-3 text-center text-sm text-muted-foreground">
                      Para guardar la búsqueda, <Link href="/auth?next=/marketplace" className="font-medium text-primary underline-offset-4 hover:underline">inicia sesión o crea una cuenta</Link>.
                    </p>
                  ) : null}
                  {saveSearchStatus === "error" ? (
                    <p className="mt-3 text-center text-sm text-destructive">No se pudo guardar la búsqueda. Prueba de nuevo.</p>
                  ) : null}
                  {saveSearchStatus === "saved" ? (
                    <p className="mt-3 text-center text-sm text-muted-foreground">La hemos guardado como señal de demanda. No enviaremos emails hasta activar las notificaciones.</p>
                  ) : null}
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} currentSchoolId={currentUserSchoolId} />
                ))}
              </div>
            )}
          </div>
        </div>

        <Link href="/marketplace/new" className="fixed bottom-4 right-4 z-30 sm:hidden">
          <Button className="h-12 rounded-full px-5 shadow-lg"><Plus className="mr-2 h-4 w-4" />Publicar</Button>
        </Link>
      </div>
    </div>
  );
}
