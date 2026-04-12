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


type PaymentIntentRow = {
  id: string;
  offer_id?: string | null;
  listing_id?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  amount?: number | null;
  status: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

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
  initialPaymentIntents?: PaymentIntentRow[];
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

function buildOfferSnapshot(params: {
  parsed: NonNullable<ReturnType<typeof parseOfferChatBody>>;
  relatedOffer?: ListingOfferRow | null;
  listingId: string;
  buyerId: string;
  sellerId: string;
}): ListingOfferRow {
  const { parsed, relatedOffer, listingId, buyerId, sellerId } = params;
  const currentActor = parsed.currentActor === "closed" ? null : parsed.currentActor;

  return {
    id: parsed.offerId,
    listing_id: relatedOffer?.listing_id || listingId,
    buyer_id: relatedOffer?.buyer_id || buyerId,
    seller_id: relatedOffer?.seller_id || sellerId,
    offered_price:
      parsed.eventType === "offer_created" || (parsed.eventType === "counter_sent" && parsed.actorRole === "buyer")
        ? parsed.amount
        : Number(relatedOffer?.offered_price ?? parsed.amount),
    current_amount: parsed.amount,
    current_actor: currentActor,
    rounds_count: parsed.round,
    accepted_amount:
      parsed.status === "accepted"
        ? parsed.amount
        : relatedOffer?.accepted_amount ?? null,
    status: parsed.status,
    counter_price:
      parsed.eventType === "counter_sent" && parsed.actorRole === "seller"
        ? parsed.amount
        : relatedOffer?.counter_price ?? null,
    created_at: relatedOffer?.created_at ?? null,
    responded_at: relatedOffer?.responded_at ?? null,
  };
}

function buildDonationSnapshot(params: {
  parsed: NonNullable<ReturnType<typeof parseDonationChatBody>>;
  relatedRequest?: DonationRequestRow | null;
  listingId: string;
  requesterId: string;
}): DonationRequestRow {
  const { parsed, relatedRequest, listingId, requesterId } = params;

  return {
    id: parsed.requestId,
    listing_id: relatedRequest?.listing_id || listingId,
    requester_id: relatedRequest?.requester_id || requesterId,
    assigned_to_requester_id:
      parsed.status === "approved"
        ? relatedRequest?.assigned_to_requester_id || requesterId
        : relatedRequest?.assigned_to_requester_id ?? null,
    approved_by_admin_id: relatedRequest?.approved_by_admin_id ?? null,
    status: parsed.status,
    note: parsed.note || relatedRequest?.note || null,
    created_at: relatedRequest?.created_at ?? null,
    updated_at: relatedRequest?.updated_at ?? null,
    school_id: relatedRequest?.school_id ?? null,
  };
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
  initialPaymentIntents = [],
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
  const [paymentIntentsByOfferId, setPaymentIntentsByOfferId] = useState<Record<string, PaymentIntentRow>>(
    () => Object.fromEntries(initialPaymentIntents.filter((row) => !!row.offer_id).map((row) => [row.offer_id as string, row]))
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
    setPaymentIntentsByOfferId(
      Object.fromEntries(initialPaymentIntents.filter((row) => !!row.offer_id).map((row) => [row.offer_id as string, row]))
    );
  }, [initialPaymentIntents]);

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
            prev.map((msg) => (msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messagesChannel);
    };
  }, [conversationId, currentUserId, supabase]);

  const lastOwnMessageId = [...messages]
    .reverse()
    .find((message) => message.sender_id === currentUserId)?.id;

  const latestOfferMessageIdByOfferId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const message of messages) {
      const parsed = parseOfferChatBody(message.body);
      if (parsed?.offerId) {
        map[parsed.offerId] = message.id;
      }
    }
    return map;
  }, [messages]);

  const latestDonationMessageIdByRequestId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const message of messages) {
      const parsed = parseDonationChatBody(message.body);
      if (parsed?.requestId) {
        map[parsed.requestId] = message.id;
      }
    }
    return map;
  }, [messages]);

  return (
    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-24rem)]">
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
        const relatedPaymentIntent = parsedOffer ? paymentIntentsByOfferId[parsedOffer.offerId] : null;
        const isLatestOfferMessage = !!parsedOffer && latestOfferMessageIdByOfferId[parsedOffer.offerId] === message.id;
        const isLatestDonationMessage =
          !!parsedDonation && latestDonationMessageIdByRequestId[parsedDonation.requestId] === message.id;

        const resolvedOffer = parsedOffer
          ? buildOfferSnapshot({
            parsed: parsedOffer,
            relatedOffer,
            listingId: conversationListingId,
            buyerId: conversationBuyerId,
            sellerId: conversationSellerId,
          })
          : null;

        const resolvedDonationRequest = parsedDonation
          ? buildDonationSnapshot({
            parsed: parsedDonation,
            relatedRequest: relatedDonationRequest,
            listingId: conversationListingId,
            requesterId: conversationBuyerId,
          })
          : null;

        const isActionableOfferCard = !!(
          parsedOffer &&
          isLatestOfferMessage &&
          ["pending", "countered"].includes(parsedOffer.status) &&
          ((parsedOffer.currentActor === "seller" && currentUserId === conversationSellerId) ||
            (parsedOffer.currentActor === "buyer" && currentUserId === conversationBuyerId))
        );

        const isActionableDonationCard = !!(
          parsedDonation &&
          isLatestDonationMessage &&
          parsedDonation.status === "pending" &&
          currentUserId === conversationSellerId
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
                  className={`mb-3 flex items-center gap-3 rounded-xl border px-3 py-2 ${isMine ? "border-sky-300 bg-sky-400/40" : "border-slate-200 bg-white"
                    }`}
                >
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {message.attachment_name || "Archivo adjunto"}
                    </p>
                    <p className="text-xs text-slate-500">{formatFileSize(message.attachment_size)}</p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-slate-500" />
                </a>
              ) : null}

              {resolvedOffer && parsedOffer ? (
                <ConversationOfferCard
                  offer={resolvedOffer}
                  currentUserId={currentUserId}
                  messageStatus={parsedOffer.status}
                  messageAmount={parsedOffer.amount}
                  messageEventType={parsedOffer.eventType}
                  messageActorRole={parsedOffer.actorRole}
                  messageRound={parsedOffer.round}
                  isActionable={isActionableOfferCard}
                />
              ) : resolvedDonationRequest && parsedDonation ? (
                <ConversationDonationCard
                  request={resolvedDonationRequest}
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
