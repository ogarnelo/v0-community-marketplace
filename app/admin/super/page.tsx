import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDashboard from "@/components/admin/super-admin-dashboard";
import { Globe } from "lucide-react";

export const dynamic = "force-dynamic";

const PROVISIONAL_SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

type UserRoleRow = {
  role: string;
  school_id: string | null;
};

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
  contact_email: string | null;
  contact_phone: string | null;
  status: "pending" | "approved" | "rejected" | "new" | null;
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

  const normalizedEmail = user.email?.toLowerCase().trim() || "";

  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", user.id)
    .returns<UserRoleRow[]>();

  const safeRoles = (rolesData || []) as UserRoleRow[];
  const hasSuperAdminRole = safeRoles.some((role) => role.role === "super_admin");
  const isProvisionalSuperAdmin = PROVISIONAL_SUPERADMIN_EMAILS.includes(normalizedEmail);
  const isSuperAdmin = hasSuperAdminRole || isProvisionalSuperAdmin;

  if (!isSuperAdmin) {
    redirect("/");
  }

  const loadErrors: string[] = [];

  if (rolesError) {
    loadErrors.push(`user_roles: ${rolesError.message}`);
  }

  const [
    profileResult,
    schoolsResult,
    profilesResult,
    listingsResult,
    supportTicketsResult,
    reportsResult,
    schoolRequestsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
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
        "id, school_name, school_type, address, city, postal_code, region, contact_email, contact_phone, status, review_notes, approved_school_id, created_at, reviewed_at, reviewed_by"
      )
      .order("created_at", { ascending: false })
      .returns<SchoolRequestRow[]>(),
  ]);

  if (profileResult.error) {
    loadErrors.push(`profiles(me): ${profileResult.error.message}`);
  }

  if (schoolsResult.error) {
    loadErrors.push(`schools: ${schoolsResult.error.message}`);
  }

  if (profilesResult.error) {
    loadErrors.push(`profiles(total): ${profilesResult.error.message}`);
  }

  if (listingsResult.error) {
    loadErrors.push(`listings: ${listingsResult.error.message}`);
  }

  if (supportTicketsResult.error) {
    loadErrors.push(`support_tickets: ${supportTicketsResult.error.message}`);
  }

  if (reportsResult.error) {
    loadErrors.push(`reports: ${reportsResult.error.message}`);
  }

  if (schoolRequestsResult.error) {
    loadErrors.push(
      `school_registration_requests: ${schoolRequestsResult.error.message}`
    );
  }

  const safeSchools = ((schoolsResult.data || []) as SchoolSummaryRow[]) ?? [];
  const safeProfiles = ((profilesResult.data || []) as ProfileSummaryRow[]) ?? [];
  const safeListings = ((listingsResult.data || []) as ListingStatsRow[]) ?? [];
  const safeSupportTickets =
    ((supportTicketsResult.data || []) as SupportTicketRow[]) ?? [];
  const safeReports = ((reportsResult.data || []) as ReportRow[]) ?? [];
  const safeSchoolRequests =
    ((schoolRequestsResult.data || []) as SchoolRequestRow[]) ?? [];

  const listingIdsFromReports = safeReports
    .map((report) => report.listing_id)
    .filter((value): value is string => Boolean(value));

  const reporterIds = safeReports
    .map((report) => report.reporter_id)
    .filter((value): value is string => Boolean(value));

  const approvedSchoolIds = safeSchoolRequests
    .map((request) => request.approved_school_id)
    .filter((value): value is string => Boolean(value));

  const [reportedListingsResult, reporterProfilesResult, accessCodesResult] =
    await Promise.all([
      listingIdsFromReports.length > 0
        ? supabase
          .from("listings")
          .select("id, title")
          .in("id", listingIdsFromReports)
          .returns<ListingSummaryRow[]>()
        : Promise.resolve({
          data: [] as ListingSummaryRow[],
          error: null,
        }),
      reporterIds.length > 0
        ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reporterIds)
          .returns<ProfileSummaryRow[]>()
        : Promise.resolve({
          data: [] as ProfileSummaryRow[],
          error: null,
        }),
      approvedSchoolIds.length > 0
        ? supabase
          .from("school_access_codes")
          .select("school_id, code, created_at")
          .in("school_id", approvedSchoolIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .returns<AccessCodeRow[]>()
        : Promise.resolve({
          data: [] as AccessCodeRow[],
          error: null,
        }),
    ]);

  if (reportedListingsResult.error) {
    loadErrors.push(`reported listings: ${reportedListingsResult.error.message}`);
  }

  if (reporterProfilesResult.error) {
    loadErrors.push(`reporter profiles: ${reporterProfilesResult.error.message}`);
  }

  if (accessCodesResult.error) {
    loadErrors.push(`school_access_codes: ${accessCodesResult.error.message}`);
  }

  const listingMap = new Map(
    (((reportedListingsResult.data || []) as ListingSummaryRow[]) ?? []).map((item) => [
      item.id,
      item,
    ])
  );

  const reporterMap = new Map(
    (((reporterProfilesResult.data || []) as ProfileSummaryRow[]) ?? []).map((item) => [
      item.id,
      item,
    ])
  );

  const accessCodeMap = new Map<string, AccessCodeRow>();

  for (const codeRow of ((accessCodesResult.data || []) as AccessCodeRow[]) ?? []) {
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
    (typeof profileResult.data?.full_name === "string" &&
      profileResult.data.full_name.trim().length > 0
      ? profileResult.data.full_name.trim()
      : null) ||
    user.email ||
    "Super Admin";

  const dashboardReports = safeReports.map((report) => ({
    ...report,
    reporter_name:
      reporterMap.get(report.reporter_id)?.full_name?.trim() || "Usuario",
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
      <Navbar
        isLoggedIn
        userName={navbarUserName}
        isAdmin
        currentUserId={user.id}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Super Admin - Wetudy
              </h1>
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
            initialLoadErrors={loadErrors}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}