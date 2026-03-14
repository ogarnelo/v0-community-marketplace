"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

type ConversationSummary = {
  id: string;
  otherName: string;
  listingTitle: string;
  latestMessageBody: string;
  latestMessageCreatedAt: string | null;
  unreadCount: number;
};

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function formatSidebarDate(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ConversationsSidebarProps {
  conversations: ConversationSummary[];
  selectedConversationId?: string;
  currentUserId: string;
}

export function ConversationsSidebar({
  conversations,
  selectedConversationId,
  currentUserId,
}: ConversationsSidebarProps) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ConversationSummary[]>(conversations);

  useEffect(() => {
    setItems(conversations);
  }, [conversations]);

  useEffect(() => {
    const loadUnreadCounts = async () => {
      if (items.length === 0) return;

      const conversationIds = items.map((item) => item.id);

      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .neq("sender_id", currentUserId)
        .is("read_at", null);

      const unreadCountMap = new Map<string, number>();

      for (const message of unreadMessages || []) {
        unreadCountMap.set(
          message.conversation_id,
          (unreadCountMap.get(message.conversation_id) || 0) + 1
        );
      }

      setItems((prev) =>
        [...prev].map((item) => ({
          ...item,
          unreadCount: unreadCountMap.get(item.id) || 0,
        }))
      );
    };

    loadUnreadCounts();

    const channel = supabase
      .channel(`conversations-sidebar:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMessage = payload.new as {
            conversation_id: string;
            sender_id: string;
            body: string | null;
            created_at: string;
            attachment_name?: string | null;
            read_at?: string | null;
          };

          const previewText =
            newMessage.body?.trim() ||
            (newMessage.attachment_name
              ? `📎 ${newMessage.attachment_name}`
              : "Nuevo mensaje");

          setItems((prev) => {
            const exists = prev.some((item) => item.id === newMessage.conversation_id);
            if (!exists) return prev;

            const updated = prev.map((item) => {
              if (item.id !== newMessage.conversation_id) return item;

              return {
                ...item,
                latestMessageBody: previewText,
                latestMessageCreatedAt: newMessage.created_at,
                unreadCount:
                  newMessage.sender_id !== currentUserId
                    ? item.unreadCount + 1
                    : item.unreadCount,
              };
            });

            updated.sort((a, b) => {
              const aTime = a.latestMessageCreatedAt
                ? new Date(a.latestMessageCreatedAt).getTime()
                : 0;
              const bTime = b.latestMessageCreatedAt
                ? new Date(b.latestMessageCreatedAt).getTime()
                : 0;
              return bTime - aTime;
            });

            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        async () => {
          await loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, items.length, supabase]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="border-b px-5 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Mensajes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} conversaciones
        </p>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Aún no tienes conversaciones.
          </div>
        ) : (
          items.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;

            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className={`block border-b px-4 py-4 transition hover:bg-slate-50 ${isSelected ? "bg-emerald-50" : "bg-white"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>
                      {getInitials(conversation.otherName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {conversation.otherName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {conversation.listingTitle}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {conversation.latestMessageCreatedAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatSidebarDate(
                              conversation.latestMessageCreatedAt
                            )}
                          </span>
                        )}

                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <p
                      className={`mt-2 truncate text-sm ${conversation.unreadCount > 0
                          ? "font-medium text-slate-900"
                          : "text-muted-foreground"
                        }`}
                    >
                      {conversation.latestMessageBody || "Sin mensajes todavía"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
