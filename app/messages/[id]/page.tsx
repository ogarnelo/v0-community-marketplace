import RealtimeChatMessages from "@/components/messages/realtime-chat-messages";
import { ConversationsSidebar } from "@/components/messages/conversations-sidebar";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SendMessageForm } from "@/components/messages/send-message-form";

export const dynamic = "force-dynamic";

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  const safeConversations = conversations || [];

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (
    !conversation ||
    (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)
  ) {
    notFound();
  }

  const { data: unreadBeforeOpen } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const initialUnreadMessageIds = (unreadBeforeOpen || []).map(
    (message: any) => message.id
  );

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const listingIds = safeConversations.map((c: any) => c.listing_id);
  const otherUserIds = safeConversations.map((c: any) =>
    c.buyer_id === user.id ? c.seller_id : c.buyer_id
  );
  const conversationIds = safeConversations.map((c: any) => c.id);

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title")
    .in("id", listingIds);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, user_type")
    .in("id", otherUserIds);

  const { data: latestMessages } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at, sender_id")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const { data: unreadMessages } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const listingsMap = new Map((listings || []).map((l: any) => [l.id, l]));
  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const latestMessageMap = new Map<
    string,
    {
      conversation_id: string;
      body: string;
      created_at: string;
      sender_id: string;
    }
  >();

  for (const message of latestMessages || []) {
    if (!latestMessageMap.has(message.conversation_id)) {
      latestMessageMap.set(message.conversation_id, message);
    }
  }

  const unreadCountMap = new Map<string, number>();

  for (const message of unreadMessages || []) {
    unreadCountMap.set(
      message.conversation_id,
      (unreadCountMap.get(message.conversation_id) || 0) + 1
    );
  }

  const conversationSummaries = safeConversations.map((item: any) => {
    const otherUserId =
      item.buyer_id === user.id ? item.seller_id : item.buyer_id;

    const otherProfile = profilesMap.get(otherUserId);
    const listing = listingsMap.get(item.listing_id);
    const latestMessage = latestMessageMap.get(item.id);
    const unreadCount = unreadCountMap.get(item.id) || 0;

    return {
      id: item.id,
      otherName:
        otherProfile?.full_name && otherProfile.full_name.trim().length > 0
          ? otherProfile.full_name.trim()
          : "Usuario",
      listingTitle: listing?.title || "Anuncio",
      latestMessageBody: latestMessage?.body || "Sin mensajes todavía",
      latestMessageCreatedAt: latestMessage?.created_at || null,
      unreadCount,
    };
  });

  const otherUserId =
    conversation.buyer_id === user.id
      ? conversation.seller_id
      : conversation.buyer_id;

  const otherProfile = profilesMap.get(otherUserId);

  const listing = listingsMap.get(conversation.listing_id);

  const otherName =
    otherProfile?.full_name && otherProfile.full_name.trim().length > 0
      ? otherProfile.full_name.trim()
      : "Usuario";

  const otherRole =
    otherProfile?.user_type === "parent"
      ? "Familia / Tutor legal"
      : otherProfile?.user_type === "student"
        ? "Estudiante"
        : "Miembro de Wetudy";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationsSidebar
          conversations={conversationSummaries}
          selectedConversationId={conversation.id}
          currentUserId={user.id}
        />


        <Card className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-white">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{otherName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {otherRole}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {listing?.title || "Anuncio"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-5 py-5">
            <RealtimeChatMessages
              conversationId={conversation.id}
              currentUserId={user.id}
              initialMessages={messages || []}
              initialUnreadMessageIds={initialUnreadMessageIds}
            />
          </div>

          <div className="border-t px-5 py-4">
            <SendMessageForm conversationId={conversation.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
