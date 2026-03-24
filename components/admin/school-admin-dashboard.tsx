"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Eye,
  Flag,
  Heart,
  KeyRound,
  Package,
  Shield,
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
  price: number | null;
  type: string | null;
  status: string | null;
  seller_id: string | null;
  school_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  school_id: string | null;
  user_type: string | null;
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

type SchoolAdminDashboardProps = {
  school: SchoolRow | null;
  listings: ListingRow[];
  members: ProfileRow[];
  schoolAdmins: ProfileRow[];
  reports: ReportRow[];
  accessCodes: SchoolAccessCodeRow[];
};

const listingStatusChartConfig = {
  total: { label: "Anuncios" },
  available: { label: "Disponibles", color: "hsl(var(--chart-2))" },
  reserved: { label: "Reservados", color: "hsl(var(--chart-4))" },
  sold: { label: "Vendidos", color: "hsl(var(--chart-1))" },
  archived: { label: "Archivados", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const listingTypeChartConfig = {
  total: { label: "Tipos" },
  sale: { label: "Venta", color: "hsl(var(--chart-1))" },
  donation: { label: "Donación", color: "hsl(var(--chart-2))" },
  exchange: { label: "Intercambio", color: "hsl(var(--chart-4))" },
  other: { label: "Otros", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const memberTypeChartConfig = {
  total: { label: "Miembros" },
  parent: { label: "Familias / AMPA", color: "hsl(var(--chart-2))" },
  student: { label: "Estudiantes", color: "hsl(var(--chart-1))" },
  other: { label: "Otros", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const schoolGrowthChartConfig = {
  listings: { label: "Anuncios", color: "hsl(var(--chart-1))" },
  reports: { label: "Reports", color: "hsl(var(--chart-5))" },
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

export default function SchoolAdminDashboard({
  school,
  listings,
  members,
  schoolAdmins,
  reports,
  accessCodes,
}: SchoolAdminDashboardProps) {
  const donationListings = listings.filter((listing) => listing.type === "donation");
  const totalEstimatedVolume = listings.reduce(
    (sum, listing) => sum + (typeof listing.price === "number" ? listing.price : 0),
    0
  );

  const listingStatusData = useMemo(
    () =>
      ["available", "reserved", "sold", "archived"].map((status) => ({
        status,
        total: listings.filter((listing) => listing.status === status).length,
        fill: `var(--color-${status})`,
      })),
    [listings]
  );

  const listingTypeData = useMemo(() => {
    const knownTypes = ["sale", "donation", "exchange"] as const;

    const values = knownTypes.map((type) => ({
      type,
      total: listings.filter((listing) => listing.type === type).length,
      fill: `var(--color-${type})`,
    }));

    const knownTotal = values.reduce((sum, item) => sum + item.total, 0);
    const otherTotal = listings.length - knownTotal;

    return [
      ...values,
      {
        type: "other",
        total: Math.max(otherTotal, 0),
        fill: "var(--color-other)",
      },
    ];
  }, [listings]);

  const memberTypeData = useMemo(() => {
    const values = ["parent", "student"].map((type) => ({
      type,
      total: members.filter((member) => member.user_type === type).length,
      fill: `var(--color-${type})`,
    }));

    const knownTotal = values.reduce((sum, item) => sum + item.total, 0);
    const otherTotal = members.length - knownTotal;

    return [
      ...values,
      {
        type: "other",
        total: Math.max(otherTotal, 0),
        fill: "var(--color-other)",
      },
    ];
  }, [members]);

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

    listings.forEach((listing) => add(listing.created_at, "listings"));
    reports.forEach((report) => add(report.created_at, "reports"));

    return Array.from(buckets.values()).slice(-6);
  }, [listings, reports]);

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();

    listings.forEach((listing) => {
      const key = listing.category?.trim() || "Sin categoría";
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [listings]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{school?.city || "Ciudad no indicada"}</span>
        {school?.region ? <span>· {school.region}</span> : null}
        {school?.school_type ? (
          <Badge variant="outline">{getSchoolTypeLabel(school.school_type)}</Badge>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{listings.length}</p>
              <p className="text-xs text-muted-foreground">Anuncios</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
              <Heart className="h-5 w-5 text-secondary" />
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
              <p className="text-2xl font-bold text-foreground">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Reports</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
              <TrendingUp className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(totalEstimatedVolume)}€
              </p>
              <p className="text-xs text-muted-foreground">Volumen visible</p>
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
                <ChartContainer config={schoolGrowthChartConfig} className="h-[280px] w-full">
                  <LineChart data={monthlyActivityData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="listings"
                      stroke="var(--color-listings)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="reports"
                      stroke="var(--color-reports)"
                      strokeWidth={2}
                      dot={false}
                    />
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
                    {listings.filter((listing) => listing.status === "available").length}
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

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Estado de anuncios</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={listingStatusChartConfig} className="mx-auto h-[220px]">
                  <BarChart data={listingStatusData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={8}>
                      {listingStatusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Tipo de anuncios</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={listingTypeChartConfig} className="mx-auto h-[220px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="type" hideLabel />} />
                    <Pie
                      data={listingTypeData}
                      dataKey="total"
                      nameKey="type"
                      innerRadius={55}
                      outerRadius={85}
                    >
                      {listingTypeData.map((entry) => (
                        <Cell key={entry.type} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="type" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Perfil de comunidad</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={memberTypeChartConfig} className="mx-auto h-[220px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="type" hideLabel />} />
                    <Pie
                      data={memberTypeData}
                      dataKey="total"
                      nameKey="type"
                      innerRadius={55}
                      outerRadius={85}
                    >
                      {memberTypeData.map((entry) => (
                        <Cell key={entry.type} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="type" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Categorías top</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay categorías para analizar.
                  </p>
                ) : (
                  topCategories.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{item.category}</span>
                      <Badge variant="outline">{item.total}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
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