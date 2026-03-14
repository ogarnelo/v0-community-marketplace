import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U"

  return name
    .trim()
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("")
}

export default async function MessagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false })

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
    )
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
    )
  }

  const listingIds = conversations.map((c: any) => c.listing_id)
  const otherUserIds = conversations.map((c: any) =>
    c.buyer_id === user.id ? c.seller_id : c.buyer_id
  )

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title")
    .in("id", listingIds)

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", otherUserIds)

  const conversationIds = conversations.map((c: any) => c.id)

  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })

  const listingsMap = new Map((listings || []).map((l: any) => [l.id, l]))
  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))

  const latestMessageMap = new Map<string, { body: string; created_at: string }>()
  for (const message of messages || []) {
    if (!latestMessageMap.has(message.conversation_id)) {
      latestMessageMap.set(message.conversation_id, message)
    }
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
              : conversation.buyer_id

          const otherProfile = profilesMap.get(otherUserId)
          const listing = listingsMap.get(conversation.listing_id)
          const latestMessage = latestMessageMap.get(conversation.id)

          const otherName = otherProfile?.full_name || "Usuario"
          const listingTitle = listing?.title || "Anuncio"

          return (
            <Link key={conversation.id} href={`/messages/${conversation.id}`}>
              <Card className="transition hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar>
                    <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="truncate font-semibold">{otherName}</p>
                      {latestMessage?.created_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(latestMessage.created_at).toLocaleString("es-ES")}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-sm text-muted-foreground">
                      {listingTitle}
                    </p>

                    <p className="truncate text-sm text-muted-foreground mt-1">
                      {latestMessage?.body || "Sin mensajes todavía"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
