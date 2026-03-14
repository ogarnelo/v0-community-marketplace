"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

type RealtimeChatMessagesProps = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialUnreadMessageIds?: string[];
};

function formatMessageDate(date: string) {
  return new Date(date).toLocaleString("es-ES");
}

export default function RealtimeChatMessages({
  conversationId,
  currentUserId,
  initialMessages,
  initialUnreadMessageIds = [],
}: RealtimeChatMessagesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(
    new Set(initialUnreadMessageIds)
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setHighlightedIds(new Set(initialUnreadMessageIds));
  }, [initialUnreadMessageIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });

          if (newMessage.sender_id !== currentUserId) {
            setHighlightedIds((prev) => {
              const next = new Set(prev);
              next.add(newMessage.id);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase]);

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isMine = message.sender_id === currentUserId;
        const isHighlighted = highlightedIds.has(message.id);

        return (
          <div
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMine
                  ? "bg-sky-500 text-white"
                  : isHighlighted
                    ? "border border-emerald-300 bg-emerald-50 text-slate-900"
                    : "bg-slate-100 text-slate-900"
                }`}
            >
              {!isMine && isHighlighted && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Nuevo
                </p>
              )}

              <p className="text-sm">{message.body}</p>

              <p
                className={`mt-2 text-xs ${isMine
                    ? "text-sky-100"
                    : isHighlighted
                      ? "text-emerald-700"
                      : "text-slate-500"
                  }`}
              >
                {formatMessageDate(message.created_at)}
              </p>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
