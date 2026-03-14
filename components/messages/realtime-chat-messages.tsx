"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  read_at?: string | null;
  attachment_url?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
};

type RealtimeChatMessagesProps = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialUnreadMessageIds?: string[];
};

function formatMessageDate(date: string) {
  return new Date(date).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatFileSize(size?: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(type?: string | null) {
  return !!type && type.startsWith("image/");
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
    if (highlightedIds.size === 0) return;

    const timeout = setTimeout(() => {
      setHighlightedIds(new Set());
    }, 5000);

    return () => clearTimeout(timeout);
  }, [highlightedIds]);

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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase]);

  const lastOwnMessageId = [...messages]
    .reverse()
    .find((message) => message.sender_id === currentUserId)?.id;

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isMine = message.sender_id === currentUserId;
        const isHighlighted = highlightedIds.has(message.id);
        const hasAttachment = !!message.attachment_url;
        const isImage = isImageAttachment(message.attachment_type);
        const showSeen = isMine && message.id === lastOwnMessageId && !!message.read_at;

        return (
          <div
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMine
                  ? "bg-sky-500 text-white"
                  : isHighlighted
                    ? "border border-emerald-300 bg-emerald-50 text-slate-900 ring-2 ring-emerald-100"
                    : "bg-slate-100 text-slate-900"
                }`}
            >
              {!isMine && isHighlighted && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Nuevo
                </p>
              )}

              {hasAttachment && isImage && message.attachment_url && (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 block overflow-hidden rounded-xl"
                >
                  <Image
                    src={message.attachment_url}
                    alt={message.attachment_name || "Imagen adjunta"}
                    width={500}
                    height={350}
                    className="h-auto w-full rounded-xl object-cover"
                    unoptimized
                  />
                </a>
              )}

              {hasAttachment && !isImage && message.attachment_url && (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition ${isMine
                      ? "border-sky-300 bg-sky-400/30 hover:bg-sky-400/40"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${isMine ? "bg-sky-500/30" : "bg-slate-100"
                        }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {message.attachment_name || "Archivo adjunto"}
                      </p>
                      <p
                        className={`text-xs ${isMine ? "text-sky-100" : "text-muted-foreground"
                          }`}
                      >
                        {formatFileSize(message.attachment_size)}
                      </p>
                    </div>
                  </div>

                  <Download className="h-4 w-4 shrink-0" />
                </a>
              )}

              {message.body && <p className="text-sm">{message.body}</p>}

              <div
                className={`mt-2 flex items-center justify-between gap-3 text-xs ${isMine
                    ? "text-sky-100"
                    : isHighlighted
                      ? "text-emerald-700"
                      : "text-slate-500"
                  }`}
              >
                <span>{formatMessageDate(message.created_at)}</span>

                {showSeen && (
                  <span className="inline-flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Visto
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
