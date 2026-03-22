"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { ConversationSummary } from "@/lib/types/marketplace";

type MessageRealtimePayload = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  attachment_name?: string | null;
  read_at?: string | null;
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

function sortConversations(items: ConversationSummary[]) {
  return [...items].sort((a, b) => {
    const aTime = a.latestMessageCreatedAt
      ? new Date(a.latestMessageCreatedAt).getTime()
      : 0;
    const bTime = b.latestMessageCreatedAt
      ? new Date(b.latestMessageCreatedAt).getTime()
      : 0;

    return bTime - aTime;
  });
}

function buildPreviewText(message: {
  body?: string | null;
  attachment_name?: string | null;
}) {
  return (
    message.body?.trim() ||
    (message.attachment_name ? `📎 ${message.attachment_name}` : "Nuevo mensaje")
  );
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
    setItems(
      conversations.map((item) => ({
        ...item,
        unreadCount:
          item.id === selectedConversationId ? 0 : item.unreadCount || 0,
      }))
    );
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const loadUnreadCounts = async () => {
      if (items.length === 0) return;

      const conversationIds = items.map((item) => item.id);

      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .neq("sender_id", currentUserId)
        .is("read_at", null);

      if (error) {
        console.error("Error cargando unread counts en sidebar:", error);
        return;
      }

      const unreadCountMap = new Map<string, number>();

      for (const message of unreadMessages || []) {
        unreadCountMap.set(
          message.conversation_id,
          (unreadCountMap.get(message.conversation_id) || 0) + 1
        );
      }

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          unreadCount:
            item.id === selectedConversationId
              ? 0
              : unreadCountMap.get(item.id) || 0,
        }))
      );
    };

    void loadUnreadCounts();

    const knownConversationIds = new Set(items.map((item) => item.id));

    const channel = supabase
      .channel(`conversations-sidebar:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as MessageRealtimePayload;

          if (!knownConversationIds.has(newMessage.conversation_id)) return;

          const previewText = buildPreviewText(newMessage);

          setItems((prev) => {
            const updated = prev.map((item) => {
              if (item.id !== newMessage.conversation_id) return item;

              const shouldIncreaseUnread =
                newMessage.sender_id !== currentUserId &&
                item.id !== selectedConversationId;

              return {
                ...item,
                latestMessageBody: previewText,
                latestMessageCreatedAt: newMessage.created_at,
                unreadCount: shouldIncreaseUnread
                  ? item.unreadCount + 1
                  : item.unreadCount,
              };
            });

            return sortConversations(updated);
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
        () => {
          void loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, items, selectedConversationId, supabase]);

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
                        {conversation.latestMessageCreatedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatSidebarDate(
                              conversation.latestMessageCreatedAt
                            )}
                          </span>
                        ) : null}

                        {conversation.unreadCount > 0 ? (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
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