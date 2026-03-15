import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = user?.user_metadata?.full_name || user?.email || "Mi cuenta";
  let unreadMessagesCount = 0;
  let isAdmin = false;

  if (user) {
    const [{ data: profile }, { data: conversations }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, user_type")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
    ]);

    userName =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name ||
      user.email ||
      "Mi cuenta";

    isAdmin =
      profile?.user_type === "school_admin" ||
      profile?.user_type === "super_admin";

    const conversationIds = (conversations || []).map((conversation: any) => conversation.id);

    if (conversationIds.length > 0) {
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("id")
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .is("read_at", null);

      unreadMessagesCount = unreadMessages?.length || 0;
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        isLoggedIn={!!user}
        userName={userName}
        isAdmin={isAdmin}
        unreadMessagesCount={unreadMessagesCount}
        currentUserId={user?.id}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
