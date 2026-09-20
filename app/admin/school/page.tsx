import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SchoolAdminDashboard from "@/components/admin/school-admin-dashboard";
import { buildSchoolDashboardMetrics } from "@/lib/admin/school-dashboard-metrics";

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  school_type: string | null;
  is_active: boolean | null;
};

type ListingMetricRow = {
  id: string;
  title: string | null;
  category: string | null;
  isbn: string | null;
  status: string | null;
  created_at: string | null;
};

type RoleRow = {
  role: "super_admin" | "school_admin";
  school_id: string | null;
};

type SchoolAccessCodeRow = {
  code: string;
  is_active: boolean;
  created_at: string;
};

type ListingViewMetricRow = {
  viewed_at: string | null;
};

type AgreementMetricRow = {
  listing_id: string | null;
  agreement_type: string | null;
  status: string | null;
  amount: number | null;
  confirmed_at: string | null;
  created_at: string | null;
};

type ImpactSubscriptionRow = {
  enabled: boolean;
  email: string;
  day_of_month: number;
  last_sent_month: string | null;
};

type ImpactDeliveryRow = {
  id: string;
  email: string;
  period_key: string;
  period_label: string;
  source: "manual" | "cron";
  sent_at: string;
};

export default async function SchoolAdminPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin/school");
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, school_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, school_id").eq("user_id", user.id).returns<RoleRow[]>(),
  ]);

  const isSuperAdmin = (roles || []).some((role) => role.role === "super_admin");
  const schoolAdminRole = (roles || []).find((role) => role.role === "school_admin");
  const effectiveSchoolId = schoolAdminRole?.school_id || profile?.school_id || null;

  if (!effectiveSchoolId) {
    if (isSuperAdmin) {
      redirect("/admin/super");
    }
    redirect("/");
  }

  const [
    { data: school },
    { data: listings },
    { count: membersCount },
    { data: accessCodes },
    { count: schoolAdminsCount },
    { data: agreements },
    { data: impactSubscription },
    { data: impactDeliveries },
  ] = await Promise.all([
    adminSupabase
      .from("schools")
      .select("id, name, city, region, postal_code, school_type, is_active")
      .eq("id", effectiveSchoolId)
      .maybeSingle<SchoolRow>(),
    adminSupabase
      .from("listings")
      .select("id, title, category, isbn, status, created_at")
      .eq("school_id", effectiveSchoolId)
      .order("created_at", { ascending: false })
      .returns<ListingMetricRow[]>(),
    adminSupabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", effectiveSchoolId),
    adminSupabase
      .from("school_access_codes")
      .select("code, is_active, created_at")
      .eq("school_id", effectiveSchoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<SchoolAccessCodeRow[]>(),
    adminSupabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("school_id", effectiveSchoolId)
      .eq("role", "school_admin"),
    adminSupabase
      .from("agreements")
      .select("listing_id, agreement_type, status, amount, confirmed_at, created_at")
      .eq("school_id", effectiveSchoolId)
      .order("created_at", { ascending: false })
      .returns<AgreementMetricRow[]>(),
    adminSupabase
      .from("school_impact_report_subscriptions")
      .select("enabled, email, day_of_month, last_sent_month")
      .eq("school_id", effectiveSchoolId)
      .eq("user_id", user.id)
      .maybeSingle<ImpactSubscriptionRow>(),
    adminSupabase
      .from("school_impact_report_deliveries")
      .select("id, email, period_key, period_label, source, sent_at")
      .eq("school_id", effectiveSchoolId)
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(12)
      .returns<ImpactDeliveryRow[]>(),
  ]);

  if (school?.is_active === false && !isSuperAdmin) {
    redirect("/");
  }

  const safeListings = (listings || []) as ListingMetricRow[];
  const safeAgreements = (agreements || []) as AgreementMetricRow[];
  const safeAccessCodes = (accessCodes || []) as SchoolAccessCodeRow[];
  const listingIds = safeListings.map((listing) => listing.id);

  let listingViews: ListingViewMetricRow[] = [];
  let openReports = 0;

  if (listingIds.length > 0) {
    const [viewsResult, reportsResult] = await Promise.all([
      adminSupabase
        .from("listing_views")
        .select("viewed_at")
        .in("listing_id", listingIds)
        .order("viewed_at", { ascending: false })
        .returns<ListingViewMetricRow[]>(),
      adminSupabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("target_type", "listing")
        .in("listing_id", listingIds)
        .in("status", ["open", "reviewing"]),
    ]);

    listingViews = (viewsResult.data || []) as ListingViewMetricRow[];
    openReports = reportsResult.count || 0;
  }

  const metrics = buildSchoolDashboardMetrics({
    listings: safeListings,
    agreements: safeAgreements,
    listingViews,
    openReports,
    membersCount: membersCount || 0,
    schoolAdminsCount: schoolAdminsCount || 0,
  });

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) || user.email || "Admin centro";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin adminHref="/admin/school" currentUserId={user.id} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Panel Admin - {school?.name || "Centro"}</h1>
              <p className="text-sm text-muted-foreground">Impacto, sostenibilidad, actividad y comunidad del centro.</p>
            </div>
          </div>

          <SchoolAdminDashboard
            school={school || null}
            metrics={metrics}
            accessCodes={safeAccessCodes}
            reportSubscription={impactSubscription || null}
            currentUserEmail={user.email || ""}
            reportDeliveries={(impactDeliveries || []) as ImpactDeliveryRow[]}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
