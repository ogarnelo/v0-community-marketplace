import { getAdminFlags, type AdminRoleRow } from "@/lib/admin/roles";
import type { AppNotificationRow } from "@/lib/notifications";

interface SupabaseLike {
  auth: {
    getUser: () => Promise<{ data: { user: any } }>;
  };
  from: (table: string) => any;
}

export type NavbarData = {
  isLoggedIn: boolean;
  userName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminHref?: string;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  notifications: AppNotificationRow[];
  currentUserId?: string;
};

const EMPTY_NAVBAR_DATA: NavbarData = {
  isLoggedIn: false,
  userName: "Mi cuenta",
  isAdmin: false,
  isSuperAdmin: false,
  adminHref: undefined,
  unreadMessagesCount: 0,
  unreadNotificationsCount: 0,
  notifications: [],
  currentUserId: undefined,
};

async function safeQuery<T>(query: PromiseLike<{ data?: T; error?: unknown; count?: number | null }>, fallback: T) {
  try {
    const result = await query;
    if (result?.error) return { data: fallback, count: result.count ?? 0 };
    return { data: (result?.data ?? fallback) as T, count: result.count ?? 0 };
  } catch {
    return { data: fallback, count: 0 };
  }
}

export async function getNavbarData(supabase: SupabaseLike): Promise<NavbarData> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return EMPTY_NAVBAR_DATA;

    const [profileResult, rolesResult] = await Promise.all([
      safeQuery(
        supabase
          .from("profiles")
          .select("full_name, business_name")
          .eq("id", user.id)
          .maybeSingle(),
        null as { full_name?: string | null; business_name?: string | null } | null
      ),
      safeQuery(
        supabase.from("user_roles").select("role, school_id").eq("user_id", user.id),
        [] as AdminRoleRow[]
      ),
    ]);

    const profile = profileResult.data;
    const roles = Array.isArray(rolesResult.data) ? rolesResult.data : [];
    const adminFlags = getAdminFlags({ email: user.email, roles });

    return {
      isLoggedIn: true,
      userName:
        profile?.business_name?.trim() ||
        profile?.full_name?.trim() ||
        user.user_metadata?.business_name ||
        user.user_metadata?.full_name ||
        user.email ||
        "Mi cuenta",
      isAdmin: adminFlags.canAccessAdmin,
      isSuperAdmin: adminFlags.isSuperAdmin,
      adminHref: adminFlags.isSuperAdmin ? "/admin/super" : adminFlags.canAccessAdmin ? "/admin/school" : undefined,
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
      notifications: [],
      currentUserId: user.id as string,
    };
  } catch (error) {
    console.error("getNavbarData failed:", error);
    return EMPTY_NAVBAR_DATA;
  }
}
