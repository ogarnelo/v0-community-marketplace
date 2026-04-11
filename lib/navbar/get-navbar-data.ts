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

export async function getNavbarData(supabase: SupabaseLike): Promise<NavbarData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
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
  }

  const [{ data: profile }, { data: roles }, { data: conversations }, { data: notifications }, { count: unreadNotificationsCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, school_id").eq("user_id", user.id).returns<AdminRoleRow[]>(),
    supabase.from("conversations").select("id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
    supabase
      .from("notifications")
      .select("id, user_id, kind, title, body, href, metadata, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);

  const conversationIds = Array.isArray(conversations) ? conversations.map((conversation: { id: string }) => conversation.id) : [];
  let unreadMessagesCount = 0;

  if (conversationIds.length > 0) {
    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .is("read_at", null);

    unreadMessagesCount = unreadMessages?.length || 0;
  }

  const typedNotifications = (notifications || []) as AppNotificationRow[];
  const adminFlags = getAdminFlags({ email: user.email, roles: (roles || []) as AdminRoleRow[] });

  return {
    isLoggedIn: true,
    userName: profile?.full_name?.trim() || user.user_metadata?.full_name || user.email || "Mi cuenta",
    isAdmin: adminFlags.canAccessAdmin,
    isSuperAdmin: adminFlags.isSuperAdmin,
    adminHref: adminFlags.isSuperAdmin ? "/admin/super" : adminFlags.canAccessAdmin ? "/admin/school" : undefined,
    unreadMessagesCount,
    unreadNotificationsCount: unreadNotificationsCount || 0,
    notifications: typedNotifications,
    currentUserId: user.id as string,
  };
}
