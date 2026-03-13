import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SendMessageForm } from "@/components/messages/send-message-form"

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (
    !conversation ||
    (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)
  ) {
    notFound()
  }

  const otherUserId =
    conversation.buyer_id === user.id
      ? conversation.seller_id
      : conversation.buyer_id

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", otherUserId)
    .maybeSingle()

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title")
    .eq("id", conversation.listing_id)
    .maybeSingle()

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>{otherProfile?.full_name || "Usuario"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {listing?.title || "Anuncio"}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            {(messages || []).map((message: any) => {
              const isMine = message.sender_id === user.id

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                      }`}
                  >
                    <p>{message.body}</p>
                    <p
                      className={`mt-2 text-[11px] ${isMine
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                        }`}
                    >
                      {new Date(message.created_at).toLocaleString("es-ES")}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <SendMessageForm conversationId={conversation.id} />
        </CardContent>
      </Card>
    </div>
  )
}