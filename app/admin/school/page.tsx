import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import SchoolAdminDashboard from "@/components/admin/school-admin-dashboard";
import { Shield } from "lucide-react";

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
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, city, region, postal_code, school_type")
      .eq("id", effectiveSchoolId)
      .maybeSingle<SchoolRow>(),
    supabase
      .from("listings")
      .select("id, title, category, price, type, status, seller_id, school_id, created_at")
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
    supabase
      .from("school_access_codes")
      .select("code, is_active, created_at")
      .eq("school_id", effectiveSchoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<SchoolAccessCodeRow[]>(),
    supabase
      .from("user_roles")
      .select("user_id, role, school_id")
      .eq("school_id", effectiveSchoolId)
      .eq("role", "school_admin")
      .returns<SchoolAdminRoleRow[]>(),
  ]);

  const safeListings = (listings || []) as ListingRow[];
  const safeMembers = (members || []) as ProfileRow[];
  const safeAccessCodes = (accessCodes || []) as SchoolAccessCodeRow[];
  const safeSchoolAdminRoles = (schoolAdminRoles || []) as SchoolAdminRoleRow[];
  const safeReports = (reports || []) as ReportRow[];

  const safeListingReports = safeReports.filter((report) =>
    safeListings.some((listing) => listing.id === report.listing_id)
  );

  const schoolAdminIds = safeSchoolAdminRoles.map((role) => role.user_id);
  const schoolAdmins = safeMembers.filter((member) => schoolAdminIds.includes(member.id));

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) || user.email || "Admin centro";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin currentUserId={user.id} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Panel Admin - {school?.name || "Centro"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Dashboard del centro con KPIs reales de comunidad y marketplace.
              </p>
            </div>
          </div>

          <SchoolAdminDashboard
            school={school || null}
            listings={safeListings}
            members={safeMembers}
            schoolAdmins={schoolAdmins}
            reports={safeListingReports}
            accessCodes={safeAccessCodes}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}