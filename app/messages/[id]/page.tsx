import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SendMessageForm } from "@/components/messages/send-message-form"

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U"

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("")
}

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
    .select("id, full_name, user_type")
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

  const otherName =
    otherProfile?.full_name?.trim() || "Usuario"

  const otherRole =
    otherProfile?.user_type === "parent"
      ? "Familia / Tutor legal"
      : otherProfile?.user_type === "student"
        ? "Estudiante"
        : "Miembro de Wetudy"

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
