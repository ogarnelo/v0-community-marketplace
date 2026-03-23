import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Package,
  Heart,
  TrendingUp,
  Eye,
  Flag,
  Shield,
} from "lucide-react";

const SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
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

type RoleRow = {
  role: "super_admin" | "school_admin";
  school_id: string | null;
};

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default async function SchoolAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin/school");
  }

  const email = user.email?.toLowerCase() || "";
  const isSuperAdmin = SUPERADMIN_EMAILS.includes(email);

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, school_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .returns<RoleRow[]>(),
  ]);

  const schoolAdminRole = (roles || []).find((role) => role.role === "school_admin");
  const effectiveSchoolId =
    schoolAdminRole?.school_id || profile?.school_id || null;

  if (!effectiveSchoolId) {
    if (isSuperAdmin) {
      redirect("/admin/super");
    }
    redirect("/");
  }

  const [{ data: school }, { data: listings }, { data: members }, { data: reports }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("id, name, city")
        .eq("id", effectiveSchoolId)
        .maybeSingle<SchoolRow>(),
      supabase
        .from("listings")
        .select("id, title, category, price, type, status, seller_id, school_id")
        .eq("school_id", effectiveSchoolId)
        .order("created_at", { ascending: false })
        .returns<ListingRow[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, school_id, user_type")
        .eq("school_id", effectiveSchoolId)
        .returns<ProfileRow[]>(),
      supabase
        .from("reports")
        .select("id, target_type, listing_id, conversation_id, reason, status, created_at")
        .eq("target_type", "listing")
        .order("created_at", { ascending: false })
        .returns<ReportRow[]>(),
    ]);

  const safeListings = (listings || []) as ListingRow[];
  const safeMembers = (members || []) as ProfileRow[];
  const safeListingReports = ((reports || []) as ReportRow[]).filter((report) =>
    safeListings.some((listing) => listing.id === report.listing_id)
  );

  const donationListings = safeListings.filter((listing) => listing.type === "donation");
  const totalEstimatedVolume = safeListings.reduce(
    (sum, listing) => sum + (typeof listing.price === "number" ? listing.price : 0),
    0
  );

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) || user.email || "Admin centro";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        isLoggedIn
        userName={navbarUserName}
        isAdmin
        currentUserId={user.id}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Panel Admin - {school?.name || "Centro"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {school?.city || "Ciudad no indicada"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{safeListings.length}</p>
                  <p className="text-xs text-muted-foreground">Anuncios del centro</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Heart className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{donationListings.length}</p>
                  <p className="text-xs text-muted-foreground">Donaciones activas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{safeMembers.length}</p>
                  <p className="text-xs text-muted-foreground">Miembros del centro</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
                  <TrendingUp className="h-5 w-5 text-chart-4" />
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

          <Tabs defaultValue="listings" className="mt-6">
            <TabsList>
              <TabsTrigger value="listings">Anuncios ({safeListings.length})</TabsTrigger>
              <TabsTrigger value="members">Miembros ({safeMembers.length})</TabsTrigger>
              <TabsTrigger value="flagged">Reportados ({safeListingReports.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="listings" className="mt-4 flex flex-col gap-3">
              {safeListings.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Aún no hay anuncios en este centro.
                  </CardContent>
                </Card>
              ) : (
                safeListings.map((listing) => (
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
              {safeMembers.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Aún no hay miembros vinculados a este centro.
                  </CardContent>
                </Card>
              ) : (
                safeMembers.map((member) => (
                  <Card key={member.id} className="border-border">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {member.full_name?.trim() || "Usuario"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.user_type === "parent"
                              ? "Familia"
                              : member.user_type === "student"
                                ? "Estudiante"
                                : "Usuario"}
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

            <TabsContent value="flagged" className="mt-4">
              <Card className="border-border">
                <CardContent className="space-y-3 p-4">
                  {safeListingReports.length === 0 ? (
                    <div className="py-10 text-center">
                      <Flag className="mx-auto h-10 w-10 text-muted-foreground/40" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        No hay contenido reportado en este momento
                      </p>
                    </div>
                  ) : (
                    safeListingReports.map((report) => (
                      <div
                        key={report.id}
                        className="rounded-xl border border-border p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{report.status}</Badge>
                          <Badge variant="secondary">Anuncio</Badge>
                          <span className="text-sm font-medium text-foreground">
                            {report.reason}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString("es-ES", {
                            timeZone: "Europe/Madrid",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}