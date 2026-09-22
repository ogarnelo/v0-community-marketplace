import { getAdminFlags, type AdminRoleRow } from "@/lib/admin/roles";
import type { AppNotificationRow } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/auth/server-user";

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
  const user = await getCurrentUser();

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

  const [{ data: profile }, { data: roles }, { data: conversations }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, school_id").eq("user_id", user.id).returns<AdminRoleRow[]>(),
    supabase.from("conversations").select("id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
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

  const typedNotifications: AppNotificationRow[] = [];
  const adminFlags = getAdminFlags({ email: user.email, roles: (roles || []) as AdminRoleRow[] });

  return {
    isLoggedIn: true,
    userName: profile?.full_name?.trim() || user.user_metadata?.full_name || user.email || "Mi cuenta",
    isAdmin: adminFlags.canAccessAdmin,
    isSuperAdmin: adminFlags.isSuperAdmin,
    adminHref: adminFlags.isSuperAdmin ? "/admin/super" : adminFlags.canAccessAdmin ? "/admin/school" : undefined,
    unreadMessagesCount,
    unreadNotificationsCount: 0,
    notifications: typedNotifications,
    currentUserId: user.id as string,
  };
}
