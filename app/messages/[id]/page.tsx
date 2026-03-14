import RealtimeChatMessages from "@/components/messages/realtime-chat-messages";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SendMessageForm } from "@/components/messages/send-message-form";

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

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const otherUserId =
    conversation.buyer_id === user.id
      ? conversation.seller_id
      : conversation.buyer_id;

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, full_name, user_type")
    .eq("id", otherUserId)
    .maybeSingle();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title")
    .eq("id", conversation.listing_id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

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
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
            </Avatar>

            <div>
              <CardTitle>{otherName}</CardTitle>
              <p className="text-sm text-muted-foreground">{otherRole}</p>
              <p className="text-sm text-muted-foreground">
                {listing?.title || "Anuncio"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <RealtimeChatMessages
            conversationId={conversation.id}
            currentUserId={user.id}
            initialMessages={messages || []}
          />

          <SendMessageForm conversationId={conversation.id} />
        </CardContent>
      </Card>
    </div>
  );
}
