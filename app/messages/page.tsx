import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

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
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Mensajes</CardTitle>
            <CardDescription>Error cargando conversaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Mensajes</CardTitle>
            <CardDescription>
              Aquí verás las conversaciones con compradores y vendedores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aún no tienes conversaciones.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const listingIds = conversations.map((c: any) => c.listing_id);
  const otherUserIds = conversations.map((c: any) =>
    c.buyer_id === user.id ? c.seller_id : c.buyer_id
  );
  const conversationIds = conversations.map((c: any) => c.id);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mensajes</h1>
        <p className="mt-2 text-muted-foreground">
          Conversaciones reales de tu marketplace.
        </p>
      </div>

      <div className="space-y-4">
        {conversations.map((conversation: any) => {
          const otherUserId =
            conversation.buyer_id === user.id
              ? conversation.seller_id
              : conversation.buyer_id;

          const otherProfile = profilesMap.get(otherUserId);
          const listing = listingsMap.get(conversation.listing_id);
          const latestMessage = latestMessageMap.get(conversation.id);
          const unreadCount = unreadCountMap.get(conversation.id) || 0;

          const otherName =
            otherProfile?.full_name && otherProfile.full_name.trim().length > 0
              ? otherProfile.full_name.trim()
              : "Usuario";

          const listingTitle = listing?.title || "Anuncio";

          return (
            <Link key={conversation.id} href={`/messages/${conversation.id}`}>
              <Card
                className={`transition hover:shadow-md ${unreadCount > 0
                    ? "border-2 border-emerald-500 bg-emerald-50 shadow-sm"
                    : ""
                  }`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar>
                    <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-semibold">{otherName}</p>

                        {unreadCount > 0 && (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white shadow">
                            {unreadCount}
                          </span>
                        )}
                      </div>

                      {latestMessage?.created_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(latestMessage.created_at).toLocaleString(
                            "es-ES"
                          )}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-sm text-muted-foreground">
                      {listingTitle}
                    </p>

                    <p
                      className={`mt-1 truncate text-sm ${unreadCount > 0
                          ? "font-medium text-slate-900"
                          : "text-muted-foreground"
                        }`}
                    >
                      {latestMessage?.body || "Sin mensajes todavía"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
