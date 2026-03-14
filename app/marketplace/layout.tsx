import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName = user?.user_metadata?.full_name || user?.email || "Mi cuenta";

  let unreadMessagesCount = 0;

  if (user) {
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    const conversationIds = (conversations || []).map((c: any) => c.id);

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
        isAdmin={false}
        unreadMessagesCount={unreadMessagesCount}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
