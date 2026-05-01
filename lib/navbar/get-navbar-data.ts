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

    const [profileResult, rolesResult, conversationsResult, notificationsResult, unreadNotificationsResult] =
      await Promise.all([
        safeQuery(supabase.from("profiles").select("full_name, business_name").eq("id", user.id).maybeSingle(), null),
        safeQuery(supabase.from("user_roles").select("role, school_id").eq("user_id", user.id), [] as AdminRoleRow[]),
        safeQuery(supabase.from("conversations").select("id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`), [] as { id: string }[]),
        safeQuery(
          supabase
            .from("notifications")
            .select("id, user_id, kind, title, body, href, metadata, read_at, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          [] as AppNotificationRow[]
        ),
        safeQuery(
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null),
          [] as unknown[]
        ),
      ]);

    const conversationIds = Array.isArray(conversationsResult.data)
      ? conversationsResult.data.map((conversation) => conversation.id).filter(Boolean)
      : [];

    let unreadMessagesCount = 0;
    if (conversationIds.length > 0) {
      const unreadMessagesResult = await safeQuery(
        supabase
          .from("messages")
          .select("id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", user.id)
          .is("read_at", null),
        [] as { id: string }[]
      );
      unreadMessagesCount = Array.isArray(unreadMessagesResult.data) ? unreadMessagesResult.data.length : 0;
    }

    const profile = profileResult.data as { full_name?: string | null; business_name?: string | null } | null;
    const typedNotifications = Array.isArray(notificationsResult.data)
      ? (notificationsResult.data as AppNotificationRow[])
      : [];
    const roles = Array.isArray(rolesResult.data) ? (rolesResult.data as AdminRoleRow[]) : [];
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
      unreadMessagesCount,
      unreadNotificationsCount: unreadNotificationsResult.count || 0,
      notifications: typedNotifications,
      currentUserId: user.id as string,
    };
  } catch (error) {
    console.error("getNavbarData failed:", error);
    return EMPTY_NAVBAR_DATA;
  }
}
