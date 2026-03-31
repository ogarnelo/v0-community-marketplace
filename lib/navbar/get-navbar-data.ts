import { getAdminFlags, type AdminRoleRow } from "@/lib/admin/roles";

interface SupabaseLike {
  auth: {
    getUser: () => Promise<{ data: { user: any } }>;
  };
  from: (table: string) => any;
}

export async function getNavbarData(supabase: SupabaseLike) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isLoggedIn: false,
      userName: "Mi cuenta",
      isAdmin: false,
      unreadMessagesCount: 0,
      currentUserId: undefined as string | undefined,
    };
  }

  const [{ data: profile }, { data: roles }, { data: conversations }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .returns<AdminRoleRow[]>(),
    supabase
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
  ]);

  const conversationIds = Array.isArray(conversations)
    ? conversations.map((conversation: { id: string }) => conversation.id)
    : [];

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

  const adminFlags = getAdminFlags({
    email: user.email,
    roles: (roles || []) as AdminRoleRow[],
  });

  return {
    isLoggedIn: true,
    userName:
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name ||
      user.email ||
      "Mi cuenta",
    isAdmin: adminFlags.canAccessAdmin,
    unreadMessagesCount,
    currentUserId: user.id as string,
  };
}
