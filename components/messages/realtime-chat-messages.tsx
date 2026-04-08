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

type Props = {
  conversationId: string;
  currentUserId: string;
  conversationListingId: string;
  conversationBuyerId: string;
  conversationSellerId: string;
  initialMessages: Message[];
  initialUnreadMessageIds?: string[];
  initialOffers?: ListingOfferRow[];
  initialDonationRequests?: DonationRequestRow[];
  initialOfferLatestEventIds?: Record<string, string>;
  initialDonationLatestEventIds?: Record<string, string>;
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
  initialOfferLatestEventIds = {},
  initialDonationLatestEventIds = {},
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set(initialUnreadMessageIds));
  const [offersById, setOffersById] = useState<Record<string, ListingOfferRow>>(() => Object.fromEntries(initialOffers.map((offer) => [offer.id, offer])));
  const [requestsById, setRequestsById] = useState<Record<string, DonationRequestRow>>(() => Object.fromEntries(initialDonationRequests.map((request) => [request.id, request])));
  const [offerLatestEventIds, setOfferLatestEventIds] = useState<Record<string, string>>(initialOfferLatestEventIds);
  const [donationLatestEventIds, setDonationLatestEventIds] = useState<Record<string, string>>(initialDonationLatestEventIds);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => setOffersById(Object.fromEntries(initialOffers.map((offer) => [offer.id, offer]))), [initialOffers]);
  useEffect(() => setRequestsById(Object.fromEntries(initialDonationRequests.map((request) => [request.id, request]))), [initialDonationRequests]);
  useEffect(() => setOfferLatestEventIds(initialOfferLatestEventIds), [initialOfferLatestEventIds]);
  useEffect(() => setDonationLatestEventIds(initialDonationLatestEventIds), [initialDonationLatestEventIds]);
  useEffect(() => setHighlightedIds(new Set(initialUnreadMessageIds)), [initialUnreadMessageIds]);

  useEffect(() => {
    if (highlightedIds.size === 0) return;
    const timeout = setTimeout(() => setHighlightedIds(new Set()), 5000);
    return () => clearTimeout(timeout);
  }, [highlightedIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const markMessageAsRead = async (messageId: string) => {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
    };

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => (prev.some((msg) => msg.id === newMessage.id) ? prev : [...prev, newMessage]));

          const parsedOffer = parseOfferChatBody(newMessage.body);
          if (parsedOffer) {
            setOfferLatestEventIds((prev) => ({ ...prev, [parsedOffer.offerId]: parsedOffer.eventId }));
            setOffersById((prev) => ({
              ...prev,
              [parsedOffer.offerId]: {
                id: parsedOffer.offerId,
                listing_id: conversationListingId,
                buyer_id: conversationBuyerId,
                seller_id: conversationSellerId,
                offered_price: parsedOffer.amount,
                current_amount: parsedOffer.amount,
                current_actor: parsedOffer.currentActor === "closed" ? null : parsedOffer.currentActor,
                rounds_count: parsedOffer.round,
                accepted_amount: parsedOffer.status === "accepted" ? parsedOffer.amount : null,
                status: parsedOffer.status,
                counter_price: parsedOffer.actorRole === "seller" ? parsedOffer.amount : null,
                created_at: null,
                responded_at: null,
              },
            }));
          }

          const parsedDonation = parseDonationChatBody(newMessage.body);
          if (parsedDonation) {
            setDonationLatestEventIds((prev) => ({ ...prev, [parsedDonation.requestId]: parsedDonation.eventId }));
            setRequestsById((prev) => ({
              ...prev,
              [parsedDonation.requestId]: {
                id: parsedDonation.requestId,
                listing_id: conversationListingId,
                requester_id: conversationBuyerId,
                assigned_to_requester_id: parsedDonation.status === "approved" ? conversationBuyerId : null,
                approved_by_admin_id: null,
                status: parsedDonation.status,
                note: parsedDonation.note || null,
                created_at: null,
                updated_at: null,
                school_id: null,
              },
            }));
          }

          if (newMessage.sender_id !== currentUserId) {
            setHighlightedIds((prev) => new Set(prev).add(newMessage.id));
            void markMessageAsRead(newMessage.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) => prev.map((msg) => (msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg)));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, conversationListingId, conversationBuyerId, conversationSellerId, currentUserId, supabase]);

  const lastOwnMessageId = [...messages].reverse().find((message) => message.sender_id === currentUserId)?.id;

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
        const relatedRequest = parsedDonation ? requestsById[parsedDonation.requestId] : null;

        return (
          <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMine ? "bg-sky-500 text-white" : isHighlighted ? "border border-emerald-300 bg-emerald-50 text-slate-900 ring-2 ring-emerald-100" : "bg-slate-100 text-slate-900"}`}>
              {!isMine && isHighlighted ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Nuevo</p> : null}

              {hasAttachment && isImage && message.attachment_url ? (
                <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-xl">
                  <Image src={message.attachment_url} alt={message.attachment_name || "Imagen adjunta"} width={500} height={350} className="h-auto w-full rounded-xl object-cover" unoptimized />
                </a>
              ) : null}

              {hasAttachment && !isImage && message.attachment_url ? (
                <a href={message.attachment_url} target="_blank" rel="noreferrer" className={`mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition ${isMine ? "border-sky-300 bg-sky-400/30 hover:bg-sky-400/40" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`rounded-lg p-2 ${isMine ? "bg-sky-500/30" : "bg-slate-100"}`}><FileText className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{message.attachment_name || "Archivo adjunto"}</p>
                      <p className={`text-xs ${isMine ? "text-sky-100" : "text-muted-foreground"}`}>{formatFileSize(message.attachment_size)}</p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 shrink-0" />
                </a>
              ) : null}

              {parsedOffer && relatedOffer ? (
                <ConversationOfferCard
                  offer={relatedOffer}
                  currentUserId={currentUserId}
                  eventId={parsedOffer.eventId}
                  latestEventId={offerLatestEventIds[parsedOffer.offerId] || null}
                  eventType={parsedOffer.eventType}
                  actorRole={parsedOffer.actorRole}
                  amount={parsedOffer.amount}
                  round={parsedOffer.round}
                />
              ) : parsedDonation && relatedRequest ? (
                <ConversationDonationCard
                  request={relatedRequest}
                  currentUserId={currentUserId}
                  ownerUserId={conversationSellerId}
                  eventId={parsedDonation.eventId}
                  latestEventId={donationLatestEventIds[parsedDonation.requestId] || null}
                  eventType={parsedDonation.eventType}
                  note={parsedDonation.note}
                />
              ) : message.body ? (
                <p className="text-sm">{message.body}</p>
              ) : null}

              <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${isMine ? "text-sky-100" : isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>
                <span>{formatMessageDate(message.created_at)}</span>
                {showSeen ? <span className="inline-flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" />Visto</span> : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
