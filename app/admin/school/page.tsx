import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SchoolAdminDashboard from "@/components/admin/school-admin-dashboard";
import { DonationRequestsPanel, type DonationRequestAdminItem } from "@/components/admin/donation-requests-panel";

const SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

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

type RoleRow = {
  role: "super_admin" | "school_admin";
  school_id: string | null;
};

type SchoolAccessCodeRow = {
  code: string;
  is_active: boolean;
  created_at: string;
};

type SchoolAdminRoleRow = {
  user_id: string;
  role: string;
  school_id: string | null;
};

type ListingViewRow = {
  listing_id: string;
  viewed_at: string;
};

type DonationRequestRow = {
  id: string;
  listing_id: string | null;
  requester_id: string | null;
  assigned_to_requester_id: string | null;
  approved_by_admin_id: string | null;
  status: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  school_id: string | null;
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

  const email = user.email?.toLowerCase() || "";
  const isSuperAdmin = SUPERADMIN_EMAILS.includes(email);

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, school_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, school_id").eq("user_id", user.id).returns<RoleRow[]>(),
  ]);

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
    { data: members },
    { data: reports },
    { data: accessCodes },
    { data: schoolAdminRoles },
    { data: donationRequests },
  ] = await Promise.all([
    adminSupabase
      .from("schools")
      .select("id, name, city, region, postal_code, school_type")
      .eq("id", effectiveSchoolId)
      .maybeSingle<SchoolRow>(),
    adminSupabase
      .from("listings")
      .select("id, title, category, grade_level, price, type, status, condition, seller_id, school_id, created_at")
      .eq("school_id", effectiveSchoolId)
      .order("created_at", { ascending: false })
      .returns<ListingRow[]>(),
    adminSupabase
      .from("profiles")
      .select("id, full_name, school_id, user_type, grade_level")
      .eq("school_id", effectiveSchoolId)
      .returns<ProfileRow[]>(),
    adminSupabase
      .from("reports")
      .select("id, target_type, listing_id, conversation_id, reason, status, created_at")
      .eq("target_type", "listing")
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
    adminSupabase
      .from("school_access_codes")
      .select("code, is_active, created_at")
      .eq("school_id", effectiveSchoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<SchoolAccessCodeRow[]>(),
    adminSupabase
      .from("user_roles")
      .select("user_id, role, school_id")
      .eq("school_id", effectiveSchoolId)
      .eq("role", "school_admin")
      .returns<SchoolAdminRoleRow[]>(),
    adminSupabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
      .eq("school_id", effectiveSchoolId)
      .order("created_at", { ascending: false })
      .returns<DonationRequestRow[]>(),
  ]);

  const safeListings = (listings || []) as ListingRow[];
  const safeMembers = (members || []) as ProfileRow[];
  const safeAccessCodes = (accessCodes || []) as SchoolAccessCodeRow[];
  const safeSchoolAdminRoles = (schoolAdminRoles || []) as SchoolAdminRoleRow[];
  const safeReports = (reports || []) as ReportRow[];
  const safeDonationRequests = (donationRequests || []) as DonationRequestRow[];

  const listingIds = safeListings.map((item) => item.id);

  const { data: listingViews } =
    listingIds.length > 0
      ? await adminSupabase
        .from("listing_views")
        .select("listing_id, viewed_at")
        .in("listing_id", listingIds)
        .order("viewed_at", { ascending: false })
        .returns<ListingViewRow[]>()
      : { data: [] as ListingViewRow[] };

  const safeListingViews = (listingViews || []) as ListingViewRow[];
  const safeListingReports = safeReports.filter((report) =>
    safeListings.some((listing) => listing.id === report.listing_id)
  );

  const schoolAdminIds = safeSchoolAdminRoles.map((role) => role.user_id);
  const schoolAdmins = safeMembers.filter((member) => schoolAdminIds.includes(member.id));

  const requesterIds = Array.from(
    new Set(
      safeDonationRequests.map((request) => request.requester_id).filter((value): value is string => !!value)
    )
  );

  const requesterNameMap = new Map<string, string>();

  if (requesterIds.length > 0) {
    const { data: requesterProfiles } = await adminSupabase
      .from("profiles")
      .select("id, full_name")
      .in("id", requesterIds);

    for (const profileRow of (requesterProfiles || []) as Array<{ id: string; full_name: string | null }>) {
      requesterNameMap.set(profileRow.id, profileRow.full_name || "Usuario");
    }
  }

  const listingTitleMap = new Map(safeListings.map((listing) => [listing.id, listing.title || "Anuncio sin título"]));

  const pendingDonationRequests: DonationRequestAdminItem[] = safeDonationRequests.map((request) => ({
    id: request.id,
    listingId: request.listing_id || "",
    listingTitle: request.listing_id ? listingTitleMap.get(request.listing_id) || "Anuncio" : "Anuncio",
    requesterName: request.requester_id ? requesterNameMap.get(request.requester_id) || "Usuario" : "Usuario",
    status: request.status,
    note: request.note,
    createdAt: request.created_at,
  }));

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
              <p className="text-sm text-muted-foreground">Dashboard del centro con KPIs, rankings y conversión.</p>
            </div>
          </div>

          <SchoolAdminDashboard
            school={school || null}
            listings={safeListings}
            members={safeMembers}
            schoolAdmins={schoolAdmins}
            reports={safeListingReports}
            accessCodes={safeAccessCodes}
            listingViews={safeListingViews}
          />

          <DonationRequestsPanel requests={pendingDonationRequests} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
