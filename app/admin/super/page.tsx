import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDashboard from "@/components/admin/super-admin-dashboard";
import { Globe } from "lucide-react";

const SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

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
  school_id: string | null;
  user_type: string | null;
  grade_level: string | null;
};

type SchoolSummaryRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  school_type: string | null;
};

type ListingStatsRow = {
  id: string;
  type: string | null;
  listing_type: string | null;
  price: number | null;
  status: string | null;
  condition: string | null;
  school_id: string | null;
  category: string | null;
  grade_level: string | null;
  created_at: string;
};

type ListingViewRow = {
  listing_id: string;
  viewed_at: string;
};

type ApprovedRequestMeta = {
  schoolId: string;
  accessCode: string;
};

type AccessCodeRow = {
  school_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
};

export default async function SuperAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin/super");
  }

  const email = user.email?.toLowerCase() || "";

  if (!SUPERADMIN_EMAILS.includes(email)) {
    redirect("/");
  }

  const [
    { data: profile },
    { data: schools },
    { data: profiles },
    { data: listings },
    { data: supportTickets },
    { data: reports },
    { data: schoolRequests },
    { data: accessCodes },
    { data: listingViews },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("schools")
      .select("id, name, city, region, school_type")
      .order("name", { ascending: true })
      .returns<SchoolSummaryRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, school_id, user_type, grade_level")
      .returns<ProfileSummaryRow[]>(),
    supabase
      .from("listings")
      .select("id, type, listing_type, price, status, condition, school_id, category, grade_level, created_at")
      .returns<ListingStatsRow[]>(),
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
    supabase
      .from("school_access_codes")
      .select("school_id, code, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<AccessCodeRow[]>(),
    supabase
      .from("listing_views")
      .select("listing_id, viewed_at")
      .order("viewed_at", { ascending: false })
      .returns<ListingViewRow[]>(),
  ]);

  const safeSchools = (schools || []) as SchoolSummaryRow[];
  const safeProfiles = (profiles || []) as ProfileSummaryRow[];
  const safeListings = (listings || []) as ListingStatsRow[];
  const safeSupportTickets = (supportTickets || []) as SupportTicketRow[];
  const safeReports = (reports || []) as ReportRow[];
  const safeSchoolRequests = (schoolRequests || []) as SchoolRequestRow[];
  const safeAccessCodes = (accessCodes || []) as AccessCodeRow[];
  const safeListingViews = (listingViews || []) as ListingViewRow[];

  const listingIdsFromReports = safeReports
    .map((report) => report.listing_id)
    .filter((value): value is string => Boolean(value));

  const reporterIds = safeReports
    .map((report) => report.reporter_id)
    .filter((value): value is string => Boolean(value));

  const [{ data: reportedListings }, { data: reporterProfiles }] = await Promise.all([
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
        .returns<Pick<ProfileSummaryRow, "id" | "full_name">[]>()
      : Promise.resolve({ data: [] as Pick<ProfileSummaryRow, "id" | "full_name">[] }),
  ]);

  const listingMap = new Map(
    ((reportedListings || []) as ListingSummaryRow[]).map((item) => [item.id, item])
  );

  const reporterMap = new Map(
    ((reporterProfiles || []) as Pick<ProfileSummaryRow, "id" | "full_name">[]).map(
      (item) => [item.id, item]
    )
  );

  const latestAccessCodeBySchoolId = new Map<string, string>();

  for (const accessCode of safeAccessCodes) {
    if (!latestAccessCodeBySchoolId.has(accessCode.school_id)) {
      latestAccessCodeBySchoolId.set(accessCode.school_id, accessCode.code);
    }
  }

  const initialApprovedRequestMeta = safeSchoolRequests.reduce<
    Record<string, ApprovedRequestMeta>
  >((acc, request) => {
    if (!request.approved_school_id) {
      return acc;
    }

    const accessCode = latestAccessCodeBySchoolId.get(request.approved_school_id);

    if (!accessCode) {
      return acc;
    }

    acc[request.id] = {
      schoolId: request.approved_school_id,
      accessCode,
    };

    return acc;
  }, {});

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) || user.email || "Super Admin";

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
      (sum, item) =>
        item.status === "available" && typeof item.price === "number" ? sum + item.price : sum,
      0
    ),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin currentUserId={user.id} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Super Admin - Wetudy</h1>
              <p className="text-sm text-muted-foreground">
                Panel global con KPIs, rankings y gestión operativa.
              </p>
            </div>
          </div>

          <SuperAdminDashboard
            stats={stats}
            initialSupportTickets={safeSupportTickets}
            initialReports={dashboardReports}
            initialSchoolRequests={safeSchoolRequests}
            initialApprovedRequestMeta={initialApprovedRequestMeta}
            initialSchools={safeSchools}
            initialProfiles={safeProfiles}
            initialListings={safeListings}
            initialListingViews={safeListingViews}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
