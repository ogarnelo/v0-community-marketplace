"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { conversations, messages, getUserById, getListingById, getSchoolById, currentUser, currentSchool } from "@/lib/mock-data"
import { Send, ArrowLeft, MessageCircle, Star, Paperclip } from "lucide-react"
import { toast } from "sonner"

export default function MessagesPage() {
  const [selectedConv, setSelectedConv] = useState<string | null>(conversations[0]?.id || null)
  const [newMessage, setNewMessage] = useState("")
  const [localMessages, setLocalMessages] = useState(messages)

  const userConversations = conversations.filter(c => c.participants.includes(currentUser.id))

  const selectedConversation = userConversations.find(c => c.id === selectedConv)
  const convMessages = selectedConv ? localMessages.filter(m => m.conversationId === selectedConv) : []

  const getOtherUser = (conv: typeof conversations[0]) => {
    const otherId = conv.participants.find(p => p !== currentUser.id)
    return otherId ? getUserById(otherId) : null
  }

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConv) return
    const msg = {
      id: `m_${Date.now()}`,
      conversationId: selectedConv,
      senderId: currentUser.id,
      text: newMessage,
      timestamp: new Date().toISOString(),
    }
    setLocalMessages(prev => [...prev, msg])
    setNewMessage("")
  }

  const handleAttachment = () => {
    toast.info("Funcion de adjuntar archivos disponible proximamente")
  }

  return (
    <div className="flex h-full bg-background">
      {/* Conversation list */}
      <div className={`w-full border-r border-border bg-card md:w-80 md:block ${selectedConv ? "hidden md:block" : ""}`}>
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Mensajes</h2>
          <p className="text-sm text-muted-foreground">{userConversations.length} conversaciones</p>
        </div>
        <ScrollArea className="h-[calc(100vh-10rem)]">
          {userConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No tienes mensajes todavia</p>
            </div>
          ) : (
            userConversations.map(conv => {
              const otherUser = getOtherUser(conv)
              const listing = getListingById(conv.listingId)

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv.id)}
                  className={`flex w-full items-start gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/50 ${
                    selectedConv === conv.id ? "bg-muted" : ""
                  }`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{otherUser?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{otherUser?.name}</p>
                      {conv.unread > 0 && (
                        <Badge className="h-5 w-5 shrink-0 rounded-full p-0 text-[10px]">{conv.unread}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{listing?.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
                  </div>
                </button>
              )
            })
          )}
        </ScrollArea>
      </div>

      {/* Chat panel */}
      <div className={`flex flex-1 flex-col ${!selectedConv ? "hidden md:flex" : "flex"}`}>
        {selectedConv && selectedConversation ? (() => {
          const otherUser = getOtherUser(selectedConversation)
          const listing = getListingById(selectedConversation.listingId)
          const listingSchool = listing ? getSchoolById(listing.schoolId) : null
          const isSameSchool = listing?.schoolId === currentSchool.id

          return (
            <>
              {/* Enhanced chat header */}
              <div className="flex items-center gap-3 border-b border-border bg-card p-4">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedConv(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                {/* Product thumbnail */}
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                  <span className="text-sm text-muted-foreground/40 font-mono">{listing?.category.charAt(0)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {otherUser?.name}
                    </p>
                    {otherUser?.rating && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3 fill-chart-4 text-chart-4" />
                        {otherUser.rating}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="truncate text-xs text-muted-foreground">
                      {listing?.title}
                    </p>
                    {listing && (
                      <span className="text-xs font-semibold text-foreground shrink-0">
                        {listing.type === "donation" ? "Gratis" : `${listing.price}\u20AC`}
                      </span>
                    )}
                  </div>
                </div>

                {isSameSchool ? (
                  <Badge className="shrink-0 text-[10px] bg-primary/10 text-primary border-0">
                    Mi centro
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Otro centro
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-3">
                  {convMessages.map(msg => {
                    const isMe = msg.senderId === currentUser.id
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm">{msg.text}</p>
                          <p className={`mt-1 text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(msg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Input with attachment */}
              <div className="border-t border-border bg-card p-4">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend() }}
                  className="flex items-center gap-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={handleAttachment}
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Adjuntar archivo</span>
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Enviar</span>
                  </Button>
                </form>
              </div>
            </>
          )
        })() : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-foreground">Selecciona una conversacion</h3>
              <p className="mt-1 text-sm text-muted-foreground">Elige un chat de la lista para empezar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
