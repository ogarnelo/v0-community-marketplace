"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Eye,
  Flag,
  Heart,
  KeyRound,
  Package,
  Percent,
  Shield,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  school_type: string | null;
};

type ListingRow = {
  id: string;
  title: string | null;
  category: string | null;
  grade_level: string | null;
  price: number | null;
  type: string | null;
  status: string | null;
  condition: string | null;
  seller_id: string | null;
  school_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  school_id: string | null;
  user_type: string | null;
  grade_level: string | null;
};

type ReportRow = {
  id: string;
  target_type: "listing" | "conversation";
  listing_id: string | null;
  conversation_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

type SchoolAccessCodeRow = {
  code: string;
  is_active: boolean;
  created_at: string;
};

type ListingViewRow = {
  listing_id: string;
  viewed_at: string;
};

type SchoolAdminDashboardProps = {
  school: SchoolRow | null;
  listings: ListingRow[];
  members: ProfileRow[];
  schoolAdmins: ProfileRow[];
  reports: ReportRow[];
  accessCodes: SchoolAccessCodeRow[];
  listingViews: ListingViewRow[];
};

type RangeKey = "30d" | "90d" | "180d" | "total";

const CORPORATE_BLUE = "#2563eb";
const CORPORATE_BLUE_SOFT = "#60a5fa";
const CORPORATE_GREEN = "#16a34a";
const CORPORATE_RED = "#dc2626";
const CORPORATE_AMBER = "#d97706";

const growthChartConfig = {
  listings: { label: "Anuncios", color: CORPORATE_BLUE },
  reports: { label: "Reports", color: CORPORATE_RED },
} satisfies ChartConfig;

const rankingChartConfig = {
  percentage: { label: "%", color: CORPORATE_BLUE },
} satisfies ChartConfig;

const listingTypeChartConfig = {
  sale: { label: "Venta", color: CORPORATE_BLUE },
  donation: { label: "Donación", color: CORPORATE_GREEN },
} satisfies ChartConfig;

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function getSchoolTypeLabel(schoolType?: string | null) {
  switch (schoolType) {
    case "school":
      return "Colegio / Instituto";
    case "academy":
      return "Academia";
    case "university":
      return "Universidad";
    default:
      return "Centro";
  }
}

function getUserTypeLabel(userType?: string | null) {
  switch (userType) {
    case "parent":
      return "Familia / AMPA";
    case "student":
      return "Estudiante";
    default:
      return "Usuario";
  }
}

function prettyGradeLevel(value?: string | null) {
  if (!value || !value.trim()) return "Sin etapa";

  return value
    .split("_")
    .map((part) => {
      const normalized = part.toLowerCase();

      if (normalized === "eso") return "ESO";
      if (normalized === "bachillerato") return "Bachillerato";
      if (normalized === "infantil") return "Infantil";
      if (normalized === "primaria") return "Primaria";
      if (normalized === "secundaria") return "Secundaria";
      if (normalized === "fp") return "FP";

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function prettyCategory(value?: string | null) {
  return value?.trim() || "Sin categoría";
}

function prettyCondition(value?: string | null) {
  switch (value) {
    case "new_with_tags":
      return "Nuevo con etiquetas";
    case "new_without_tags":
      return "Nuevo sin etiquetas";
    case "like_new":
      return "Como nuevo";
    case "good":
      return "En buen estado";
    case "fair":
      return "Con desgaste";
    default:
      return value?.trim() || "Sin estado de uso";
  }
}

function prettyUserType(value?: string | null) {
  switch (value) {
    case "student":
      return "Estudiantes";
    case "parent":
      return "Familias / tutores";
    default:
      return "Otros";
  }
}

function monthKey(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    month: "short",
    year: "2-digit",
  }).format(parsed);
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithinRange(date: string, range: RangeKey) {
  if (range === "total") return true;

  const now = new Date();
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return false;

  const days = range === "30d" ? 30 : range === "90d" ? 90 : 180;
  const start = new Date(now);
  start.setDate(now.getDate() - days);

  return parsed >= start;
}

function buildPercentageRanking(
  items: Array<{ label: string; total: number }>,
  emptyLabel = "Sin datos"
) {
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (total <= 0) {
    return [{ label: emptyLabel, total: 0, percentage: 0 }];
  }

  return items
    .filter((item) => item.total > 0)
    .map((item) => ({
      ...item,
      percentage: Number(((item.total / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

function RankingChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: Array<{ label: string; total: number; percentage: number }>;
}) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={rankingChartConfig} className="h-[250px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${value}%`} />}
            />
            <Bar dataKey="percentage" radius={8} fill={CORPORATE_BLUE} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default function SchoolAdminDashboard({
  school,
  listings,
  members,
  schoolAdmins,
  reports,
  accessCodes,
  listingViews,
}: SchoolAdminDashboardProps) {
  const [selectedRange, setSelectedRange] = useState<RangeKey>("90d");

  const filteredListings = useMemo(
    () => listings.filter((item) => isWithinRange(item.created_at, selectedRange)),
    [listings, selectedRange]
  );

  const filteredReports = useMemo(
    () => reports.filter((item) => isWithinRange(item.created_at, selectedRange)),
    [reports, selectedRange]
  );

  const filteredListingViews = useMemo(
    () => listingViews.filter((item) => isWithinRange(item.viewed_at, selectedRange)),
    [listingViews, selectedRange]
  );

  const donationListings = filteredListings.filter((listing) => listing.type === "donation");
  const totalVisibleVolume = filteredListings.reduce(
    (sum, listing) =>
      listing.status === "available" && typeof listing.price === "number"
        ? sum + listing.price
        : sum,
    0
  );

  const totalSales = filteredListings.reduce(
    (sum, listing) =>
      listing.status === "sold" && typeof listing.price === "number"
        ? sum + listing.price
        : sum,
    0
  );

  const totalTransactions = filteredListings.filter(
    (listing) => listing.status === "sold"
  ).length;

  const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  const conversionRate =
    filteredListingViews.length > 0
      ? (totalTransactions / filteredListingViews.length) * 100
      : null;

  const monthlyActivityData = useMemo(() => {
    const buckets = new Map<string, { month: string; listings: number; reports: number }>();

    const add = (date: string, key: "listings" | "reports") => {
      const bucketKey = monthKey(date);
      const current = buckets.get(bucketKey) || {
        month: bucketKey,
        listings: 0,
        reports: 0,
      };

      current[key] += 1;
      buckets.set(bucketKey, current);
    };

    filteredListings.forEach((listing) => add(listing.created_at, "listings"));
    filteredReports.forEach((report) => add(report.created_at, "reports"));

    return Array.from(buckets.values()).slice(-6);
  }, [filteredListings, filteredReports]);

  const listingTypeData = useMemo(() => {
    const saleTotal = filteredListings.filter((listing) => listing.type === "sale").length;
    const donationTotal = filteredListings.filter(
      (listing) => listing.type === "donation"
    ).length;

    return [
      { type: "sale", total: saleTotal, fill: CORPORATE_BLUE },
      { type: "donation", total: donationTotal, fill: CORPORATE_GREEN },
    ].filter((item) => item.total > 0);
  }, [filteredListings]);

  const categoryRanking = useMemo(() => {
    const counts = new Map<string, number>();

    filteredListings.forEach((listing) => {
      const key = prettyCategory(listing.category);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    ).slice(0, 8);
  }, [filteredListings]);

  const listingGradeLevelRanking = useMemo(() => {
    const counts = new Map<string, number>();

    filteredListings.forEach((listing) => {
      const key = prettyGradeLevel(listing.grade_level);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    ).slice(0, 8);
  }, [filteredListings]);

  const userGradeLevelRanking = useMemo(() => {
    const counts = new Map<string, number>();

    members.forEach((member) => {
      const key = prettyGradeLevel(member.grade_level);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    ).slice(0, 8);
  }, [members]);

  const conditionRanking = useMemo(() => {
    const counts = new Map<string, number>();

    filteredListings.forEach((listing) => {
      const key = prettyCondition(listing.condition);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    );
  }, [filteredListings]);

  const userTypeRanking = useMemo(() => {
    const counts = new Map<string, number>();

    members.forEach((member) => {
      const key = prettyUserType(member.user_type);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    );
  }, [members]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{school?.city || "Ciudad no indicada"}</span>
        {school?.region ? <span>· {school.region}</span> : null}
        {school?.school_type ? (
          <Badge variant="outline">{getSchoolTypeLabel(school.school_type)}</Badge>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Rango temporal:</span>
        {[
          { key: "30d", label: "30 días" },
          { key: "90d", label: "90 días" },
          { key: "180d", label: "180 días" },
          { key: "total", label: "Total" },
        ].map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={selectedRange === item.key ? "default" : "outline"}
            onClick={() => setSelectedRange(item.key as RangeKey)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{filteredListings.length}</p>
              <p className="text-xs text-muted-foreground">Anuncios</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Heart className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{donationListings.length}</p>
              <p className="text-xs text-muted-foreground">Donaciones</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Users className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
              <p className="text-xs text-muted-foreground">Miembros</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <Shield className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{schoolAdmins.length}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10">
              <Flag className="h-5 w-5 text-chart-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{filteredReports.length}</p>
              <p className="text-xs text-muted-foreground">Reports</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-5">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(totalVisibleVolume)}€
              </p>
              <p className="text-xs text-muted-foreground">Volumen visible</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
              <TrendingUp className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{Math.round(totalSales)}€</p>
              <p className="text-xs text-muted-foreground">Ventas totales</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalTransactions}</p>
              <p className="text-xs text-muted-foreground">Transacciones</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
              <BarChart3 className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(averageTicket)}€
              </p>
              <p className="text-xs text-muted-foreground">Ticket medio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Percent className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {conversionRate != null ? `${conversionRate.toFixed(1)}%` : "N/D"}
              </p>
              <p className="text-xs text-muted-foreground">Conversión</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="listings">Anuncios</TabsTrigger>
          <TabsTrigger value="members">Miembros</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="access">Accesos</TabsTrigger>
          <TabsTrigger value="flagged">Reportados</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-border xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Actividad del centro
                </CardTitle>
                <CardDescription>
                  Evolución de anuncios publicados y reports recibidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={growthChartConfig} className="h-[280px] w-full">
                  <LineChart data={monthlyActivityData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="listings" stroke={CORPORATE_BLUE} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="reports" stroke={CORPORATE_RED} strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Resumen ejecutivo</CardTitle>
                <CardDescription>Lectura rápida del estado del centro.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Anuncios disponibles
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {filteredListings.filter((listing) => listing.status === "available").length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stock visible en marketplace.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Miembros familia / AMPA
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {members.filter((member) => member.user_type === "parent").length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Base adulta vinculada al centro.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Código activo principal
                  </p>
                  <p className="mt-2 font-mono text-xl font-bold text-foreground">
                    {accessCodes[0]?.code || "Sin código"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Acceso actual para nuevos miembros.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <RankingChart
              title="Ranking por categoría"
              description="Peso porcentual de cada categoría de producto."
              data={categoryRanking}
            />

            <RankingChart
              title="Ranking por curso/etapa de anuncios"
              description="Peso porcentual de cada curso o etapa en los anuncios."
              data={listingGradeLevelRanking}
            />

            <RankingChart
              title="Ranking por curso/etapa de usuarios"
              description="Peso porcentual de cada curso o etapa en los usuarios."
              data={userGradeLevelRanking}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Tipos de anuncio</CardTitle>
                <CardDescription>
                  Distribución entre venta y donación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {listingTypeData.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No hay datos de tipos de anuncio.
                  </p>
                ) : (
                  <ChartContainer config={listingTypeChartConfig} className="mx-auto h-[240px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="type" hideLabel />} />
                      <Pie
                        data={listingTypeData}
                        dataKey="total"
                        nameKey="type"
                        innerRadius={60}
                        outerRadius={90}
                      >
                        {listingTypeData.map((entry) => (
                          <Cell key={entry.type} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="type" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <RankingChart
              title="Ranking por estado de producto"
              description="Peso porcentual según el estado de uso registrado."
              data={conditionRanking}
            />

            <RankingChart
              title="Ranking por tipo de usuario"
              description="Peso porcentual entre estudiantes y familias / tutores."
              data={userTypeRanking}
            />
          </div>
        </TabsContent>

        <TabsContent value="listings" className="mt-4 flex flex-col gap-3">
          {listings.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aún no hay anuncios en este centro.
              </CardContent>
            </Card>
          ) : (
            listings.map((listing) => (
              <Card key={listing.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {listing.title || "Anuncio"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.category || "Sin categoría"} · {listing.status || "Sin estado"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {listing.type === "donation" ? (
                      <Badge variant="secondary" className="text-xs">
                        Donación
                      </Badge>
                    ) : (
                      <span className="text-sm font-bold text-foreground">
                        {typeof listing.price === "number" ? `${listing.price}€` : "Consultar"}
                      </span>
                    )}

                    <Link href={`/marketplace/listing/${listing.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4 flex flex-col gap-3">
          {members.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aún no hay miembros vinculados a este centro.
              </CardContent>
            </Card>
          ) : (
            members.map((member) => (
              <Card key={member.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-sm text-primary">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {member.full_name?.trim() || "Usuario"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getUserTypeLabel(member.user_type)}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="capitalize text-xs">
                    {member.user_type || "sin definir"}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="admins" className="mt-4 flex flex-col gap-3">
          {schoolAdmins.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aún no hay administradores asignados para este centro.
              </CardContent>
            </Card>
          ) : (
            schoolAdmins.map((admin) => (
              <Card key={admin.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-sm text-primary">
                        {getInitials(admin.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {admin.full_name?.trim() || "Administrador"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rol administrativo real del centro
                      </p>
                    </div>
                  </div>

                  <Badge>school_admin</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="access" className="mt-4 flex flex-col gap-3">
          {accessCodes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Este centro todavía no tiene códigos activos.
              </CardContent>
            </Card>
          ) : (
            accessCodes.map((accessCode) => (
              <Card key={`${accessCode.code}-${accessCode.created_at}`} className="border-border">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <KeyRound className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold tracking-widest text-foreground">
                        {accessCode.code}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Creado el {formatDate(accessCode.created_at)}
                      </p>
                    </div>
                  </div>

                  <Badge variant={accessCode.is_active ? "secondary" : "outline"}>
                    {accessCode.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Contenido reportado</CardTitle>
              <CardDescription>
                Incidencias asociadas a anuncios del centro.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {reports.length === 0 ? (
                <div className="py-10 text-center">
                  <Flag className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No hay contenido reportado en este momento
                  </p>
                </div>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{report.status}</Badge>
                      <Badge variant="secondary">Anuncio</Badge>
                      <span className="text-sm font-medium text-foreground">
                        {report.reason}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}