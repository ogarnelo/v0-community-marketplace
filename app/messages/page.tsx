import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsSidebar } from "@/components/messages/conversations-sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Card className="rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">
            Error cargando conversaciones: {error.message}
          </p>
        </Card>
      </div>
    );
  }

  const safeConversations = conversations || [];

  if (safeConversations.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <ConversationsSidebar conversations={[]} />

          <div className="flex min-h-[70vh] items-center justify-center rounded-2xl border bg-white p-8">
            <div className="max-w-md text-center">
              <h2 className="text-2xl font-semibold">Aún no tienes mensajes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Cuando contactes con alguien desde un anuncio, la conversación
                aparecerá aquí.
              </p>

              <div className="mt-6">
                <Link href="/marketplace">
                  <Button>Ir al marketplace</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    .select("id, full_name")
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

  const conversationSummaries = safeConversations.map((conversation: any) => {
    const otherUserId =
      conversation.buyer_id === user.id
        ? conversation.seller_id
        : conversation.buyer_id;

    const otherProfile = profilesMap.get(otherUserId);
    const listing = listingsMap.get(conversation.listing_id);
    const latestMessage = latestMessageMap.get(conversation.id);
    const unreadCount = unreadCountMap.get(conversation.id) || 0;

    return {
      id: conversation.id,
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

  const mostRecentConversation = conversationSummaries[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationsSidebar conversations={conversationSummaries} />

        <div className="flex min-h-[70vh] items-center justify-center rounded-2xl border bg-white p-8">
          <div className="max-w-md text-center">
            <h2 className="text-2xl font-semibold">Selecciona una conversación</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Elige una conversación de la izquierda para ver el chat completo.
            </p>

            {mostRecentConversation && (
              <div className="mt-6">
                <Link href={`/messages/${mostRecentConversation.id}`}>
                  <Button>Abrir la conversación más reciente</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
