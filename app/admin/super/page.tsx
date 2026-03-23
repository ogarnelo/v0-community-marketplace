import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDashboard from "@/components/admin/super-admin-dashboard";
import { getAdminFlags, type AdminRoleRow } from "@/lib/admin/roles";
import { Globe } from "lucide-react";

type SupportTicketRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "listing" | "conversation";
  listing_id: string | null;
  conversation_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
};

type SchoolRequestRow = {
  id: string;
  school_name: string;
  school_type: string | null;
  address: string;
  city: string;
  postal_code: string;
  region: string;
  email: string | null;
  phone: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "new" | "pending" | "approved" | "rejected" | null;
  review_notes: string | null;
  approved_school_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type ListingSummaryRow = {
  id: string;
  title: string | null;
};

type ProfileSummaryRow = {
  id: string;
  full_name: string | null;
};

type SchoolSummaryRow = {
  id: string;
};

type ListingStatsRow = {
  id: string;
  type: string | null;
  price: number | null;
};

type AccessCodeRow = {
  school_id: string;
  code: string;
  created_at: string;
};

type ApprovedRequestMeta = {
  schoolId: string;
  accessCode: string;
};

export default async function SuperAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin/super");
  }

  const [
    { data: profile },
    { data: roles },
    { data: schools },
    { data: profiles },
    { data: listings },
    { data: supportTickets },
    { data: reports },
    { data: schoolRequests },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .returns<AdminRoleRow[]>(),
    supabase.from("schools").select("id"),
    supabase.from("profiles").select("id"),
    supabase.from("listings").select("id, type, price"),
    supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<SupportTicketRow[]>(),
    supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
    supabase
      .from("school_registration_requests")
      .select(
        "id, school_name, school_type, address, city, postal_code, region, email, phone, contact_email, contact_phone, status, review_notes, approved_school_id, created_at, reviewed_at, reviewed_by"
      )
      .order("created_at", { ascending: false })
      .returns<SchoolRequestRow[]>(),
  ]);

  const adminFlags = getAdminFlags({
    email: user.email,
    roles: (roles || []) as AdminRoleRow[],
  });

  if (!adminFlags.isSuperAdmin) {
    redirect("/");
  }

  const safeSchools = (schools || []) as SchoolSummaryRow[];
  const safeProfiles = (profiles || []) as ProfileSummaryRow[];
  const safeListings = (listings || []) as ListingStatsRow[];
  const safeSupportTickets = (supportTickets || []) as SupportTicketRow[];
  const safeReports = (reports || []) as ReportRow[];
  const safeSchoolRequests = (schoolRequests || []) as SchoolRequestRow[];

  const listingIdsFromReports = safeReports
    .map((report) => report.listing_id)
    .filter((value): value is string => Boolean(value));

  const reporterIds = safeReports.map((report) => report.reporter_id).filter(Boolean);

  const approvedSchoolIds = safeSchoolRequests
    .map((request) => request.approved_school_id)
    .filter((value): value is string => Boolean(value));

  const [{ data: reportedListings }, { data: reporterProfiles }, { data: accessCodes }] =
    await Promise.all([
      listingIdsFromReports.length > 0
        ? supabase
          .from("listings")
          .select("id, title")
          .in("id", listingIdsFromReports)
          .returns<ListingSummaryRow[]>()
        : Promise.resolve({ data: [] as ListingSummaryRow[] }),
      reporterIds.length > 0
        ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reporterIds)
          .returns<ProfileSummaryRow[]>()
        : Promise.resolve({ data: [] as ProfileSummaryRow[] }),
      approvedSchoolIds.length > 0
        ? supabase
          .from("school_access_codes")
          .select("school_id, code, created_at")
          .in("school_id", approvedSchoolIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .returns<AccessCodeRow[]>()
        : Promise.resolve({ data: [] as AccessCodeRow[] }),
    ]);

  const listingMap = new Map(
    ((reportedListings || []) as ListingSummaryRow[]).map((item) => [item.id, item])
  );

  const reporterMap = new Map(
    ((reporterProfiles || []) as ProfileSummaryRow[]).map((item) => [item.id, item])
  );

  const accessCodeMap = new Map<string, AccessCodeRow>();

  for (const codeRow of (accessCodes || []) as AccessCodeRow[]) {
    if (!accessCodeMap.has(codeRow.school_id)) {
      accessCodeMap.set(codeRow.school_id, codeRow);
    }
  }

  const initialApprovedRequestMeta = safeSchoolRequests.reduce<
    Record<string, ApprovedRequestMeta>
  >((acc, request) => {
    if (!request.approved_school_id) {
      return acc;
    }

    const accessCode = accessCodeMap.get(request.approved_school_id);

    if (!accessCode) {
      return acc;
    }

    acc[request.id] = {
      schoolId: request.approved_school_id,
      accessCode: accessCode.code,
    };

    return acc;
  }, {});

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) ||
    user.email ||
    "Super Admin";

  const dashboardReports = safeReports.map((report) => ({
    ...report,
    reporter_name: reporterMap.get(report.reporter_id)?.full_name?.trim() || "Usuario",
    listing_title: report.listing_id
      ? listingMap.get(report.listing_id)?.title || "Anuncio"
      : null,
  }));

  const stats = {
    totalSchools: safeSchools.length,
    totalUsers: safeProfiles.length,
    totalListings: safeListings.length,
    totalDonations: safeListings.filter((item) => item.type === "donation").length,
    totalEstimatedVolume: safeListings.reduce(
      (sum, item) => sum + (typeof item.price === "number" ? item.price : 0),
      0
    ),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin currentUserId={user.id} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Super Admin - Wetudy</h1>
              <p className="text-sm text-muted-foreground">
                Panel global de soporte, moderación y altas de centros.
              </p>
            </div>
          </div>

          <SuperAdminDashboard
            stats={stats}
            initialSupportTickets={safeSupportTickets}
            initialReports={dashboardReports}
            initialSchoolRequests={safeSchoolRequests}
            initialApprovedRequestMeta={initialApprovedRequestMeta}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}