"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DonationRequestRow, ListingOfferRow } from "@/lib/types/marketplace";
import { parseOfferChatBody } from "@/lib/offers/chat-message";
import { parseDonationChatBody } from "@/lib/donations/chat-message";
import { ConversationOfferCard } from "@/components/messages/conversation-offer-card";
import { ConversationDonationCard } from "@/components/messages/conversation-donation-card";

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
  conversationListingId: string;
  conversationBuyerId: string;
  conversationSellerId: string;
  initialMessages: Message[];
  initialUnreadMessageIds?: string[];
  initialOffers?: ListingOfferRow[];
  initialDonationRequests?: DonationRequestRow[];
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
  conversationListingId,
  conversationBuyerId,
  conversationSellerId,
  initialMessages,
  initialUnreadMessageIds = [],
  initialOffers = [],
  initialDonationRequests = [],
}: RealtimeChatMessagesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set(initialUnreadMessageIds));
  const [offersById, setOffersById] = useState<Record<string, ListingOfferRow>>(
    () => Object.fromEntries(initialOffers.map((offer) => [offer.id, offer]))
  );
  const [donationRequestsById, setDonationRequestsById] = useState<Record<string, DonationRequestRow>>(
    () => Object.fromEntries(initialDonationRequests.map((request) => [request.id, request]))
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setOffersById(Object.fromEntries(initialOffers.map((offer) => [offer.id, offer])));
  }, [initialOffers]);

  useEffect(() => {
    setDonationRequestsById(
      Object.fromEntries(initialDonationRequests.map((request) => [request.id, request]))
    );
  }, [initialDonationRequests]);

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
    const markMessageAsRead = async (messageId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);

      if (error) {
        console.error("Error marcando mensaje como leído:", error);
      }
    };

    const loadOffer = async (offerId: string) => {
      const { data, error } = await supabase
        .from("listing_offers")
        .select(
          "id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at"
        )
        .eq("id", offerId)
        .maybeSingle();

      if (!error && data) {
        setOffersById((prev) => ({ ...prev, [data.id]: data as ListingOfferRow }));
      }
    };

    const loadDonationRequest = async (requestId: string) => {
      const { data, error } = await supabase
        .from("donation_requests")
        .select(
          "id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id"
        )
        .eq("id", requestId)
        .maybeSingle();

      if (!error && data) {
        setDonationRequestsById((prev) => ({ ...prev, [data.id]: data as DonationRequestRow }));
      }
    };

    const ensureStructuredItemLoaded = async (body: string | null | undefined) => {
      const parsedOffer = parseOfferChatBody(body);
      if (parsedOffer?.offerId) {
        await loadOffer(parsedOffer.offerId);
      }

      const parsedDonation = parseDonationChatBody(body);
      if (parsedDonation?.requestId) {
        await loadDonationRequest(parsedDonation.requestId);
      }
    };

    const messagesChannel = supabase
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

          void ensureStructuredItemLoaded(newMessage.body);

          if (newMessage.sender_id !== currentUserId) {
            setHighlightedIds((prev) => {
              const next = new Set(prev);
              next.add(newMessage.id);
              return next;
            });

            void markMessageAsRead(newMessage.id);
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

          void ensureStructuredItemLoaded(updatedMessage.body);
        }
      )
      .subscribe();

    const offersChannel = supabase
      .channel(`offer-updates:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listing_offers",
        },
        (payload) => {
          const row = payload.new as Partial<ListingOfferRow> | null;
          if (!row?.id) return;
          if (
            row.listing_id !== conversationListingId ||
            row.buyer_id !== conversationBuyerId ||
            row.seller_id !== conversationSellerId
          ) {
            return;
          }

          setOffersById((prev) => ({
            ...prev,
            [row.id as string]: {
              ...(prev[row.id as string] || {}),
              ...(row as ListingOfferRow),
            },
          }));
        }
      )
      .subscribe();

    const donationChannel = supabase
      .channel(`donation-updates:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donation_requests",
        },
        (payload) => {
          const row = payload.new as Partial<DonationRequestRow> | null;
          if (!row?.id) return;
          if (
            row.listing_id !== conversationListingId ||
            row.requester_id !== conversationBuyerId
          ) {
            return;
          }

          setDonationRequestsById((prev) => ({
            ...prev,
            [row.id as string]: {
              ...(prev[row.id as string] || {}),
              ...(row as DonationRequestRow),
            },
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messagesChannel);
      void supabase.removeChannel(offersChannel);
      void supabase.removeChannel(donationChannel);
    };
  }, [
    conversationId,
    currentUserId,
    supabase,
    conversationListingId,
    conversationBuyerId,
    conversationSellerId,
  ]);

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
        const parsedOffer = parseOfferChatBody(message.body);
        const parsedDonation = parseDonationChatBody(message.body);
        const relatedOffer = parsedOffer ? offersById[parsedOffer.offerId] : null;
        const relatedDonationRequest = parsedDonation ? donationRequestsById[parsedDonation.requestId] : null;

        const offerCurrentAmount = Number(relatedOffer?.current_amount ?? relatedOffer?.counter_price ?? relatedOffer?.offered_price ?? 0);
        const isActionableOfferCard = !!(
          parsedOffer &&
          relatedOffer &&
          relatedOffer.status === parsedOffer.status &&
          offerCurrentAmount === Number(parsedOffer.amount)
        );

        const isActionableDonationCard = !!(
          parsedDonation &&
          relatedDonationRequest &&
          relatedDonationRequest.status === parsedDonation.status &&
          parsedDonation.status === "pending"
        );

        return (
          <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMine
                  ? "bg-sky-500 text-white"
                  : isHighlighted
                    ? "border border-emerald-300 bg-emerald-50 text-slate-900 ring-2 ring-emerald-100"
                    : "bg-slate-100 text-slate-900"
                }`}
            >
              {!isMine && isHighlighted ? (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Nuevo
                </p>
              ) : null}

              {hasAttachment && isImage && message.attachment_url ? (
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
              ) : null}

              {hasAttachment && !isImage && message.attachment_url ? (
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
                    <div className={`rounded-lg p-2 ${isMine ? "bg-sky-500/30" : "bg-slate-100"}`}>
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {message.attachment_name || "Archivo adjunto"}
                      </p>
                      <p className={`text-xs ${isMine ? "text-sky-100" : "text-muted-foreground"}`}>
                        {formatFileSize(message.attachment_size)}
                      </p>
                    </div>
                  </div>

                  <Download className="h-4 w-4 shrink-0" />
                </a>
              ) : null}

              {parsedOffer ? (
                <ConversationOfferCard
                  offer={
                    relatedOffer || {
                      id: parsedOffer.offerId,
                      listing_id: conversationListingId,
                      buyer_id: conversationBuyerId,
                      seller_id: conversationSellerId,
                      offered_price: parsedOffer.actorRole === "buyer" ? parsedOffer.amount : 0,
                      current_amount: parsedOffer.amount,
                      current_actor: parsedOffer.currentActor,
                      rounds_count: parsedOffer.round,
                      accepted_amount: parsedOffer.status === "accepted" ? parsedOffer.amount : null,
                      status: parsedOffer.status,
                      counter_price: parsedOffer.actorRole === "seller" ? parsedOffer.amount : null,
                      created_at: null,
                      responded_at: null,
                    }
                  }
                  currentUserId={currentUserId}
                  messageStatus={parsedOffer.status}
                  messageAmount={parsedOffer.amount}
                  messageEventType={parsedOffer.eventType}
                  messageActorRole={parsedOffer.actorRole}
                  messageRound={parsedOffer.round}
                  isActionable={isActionableOfferCard}
                />
              ) : parsedDonation ? (
                <ConversationDonationCard
                  request={
                    relatedDonationRequest || {
                      id: parsedDonation.requestId,
                      listing_id: conversationListingId,
                      requester_id: conversationBuyerId,
                      assigned_to_requester_id: null,
                      approved_by_admin_id: null,
                      status: parsedDonation.status,
                      note: parsedDonation.note || null,
                      created_at: null,
                      updated_at: null,
                      school_id: null,
                    }
                  }
                  currentUserId={currentUserId}
                  messageStatus={parsedDonation.status}
                  messageNote={parsedDonation.note}
                  canRespond={isActionableDonationCard}
                />
              ) : message.body ? (
                <p className="text-sm">{message.body}</p>
              ) : null}

              <div
                className={`mt-2 flex items-center justify-between gap-3 text-xs ${isMine
                    ? "text-sky-100"
                    : isHighlighted
                      ? "text-emerald-700"
                      : "text-slate-500"
                  }`}
              >
                <span>{formatMessageDate(message.created_at)}</span>

                {showSeen ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Visto
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
