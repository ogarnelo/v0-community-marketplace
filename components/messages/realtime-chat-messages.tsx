"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type RealtimeChatMessagesProps = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
};

function formatMessageDate(date: string) {
  return new Date(date).toLocaleString("es-ES");
}

export default function RealtimeChatMessages({
  conversationId,
  currentUserId,
  initialMessages,
}: RealtimeChatMessagesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isMine = message.sender_id === currentUserId;

        return (
          <div
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMine
                  ? "bg-sky-500 text-white"
                  : "bg-slate-100 text-slate-900"
                }`}
            >
              <p className="text-sm">{message.body}</p>
              <p
                className={`mt-2 text-xs ${isMine ? "text-sky-100" : "text-slate-500"
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
