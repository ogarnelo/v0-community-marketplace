import RealtimeChatMessages from "@/components/messages/realtime-chat-messages";
import { ConversationsSidebar } from "@/components/messages/conversations-sidebar";
import ConversationListingState from "@/components/messages/conversation-listing-state";
import { HideConversationButton } from "@/components/messages/hide-conversation-button";
import { ReportConversationButton } from "@/components/messages/report-conversation-button";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { SendMessageForm } from "@/components/messages/send-message-form";
import { ConversationOfferCard, type ConversationOfferCardData } from "@/components/messages/conversation-offer-card";
import {
  canSendNewMessageToListing,
  isValidListingStatus,
  type ListingStatus,
} from "@/lib/marketplace/listing-status";
import type { ConversationSummary, ProfileRow } from "@/lib/types/marketplace";

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string | null;
};

type ListingChatRow = {
  id: string;
  title: string | null;
  price: number | null;
  status: string | null;
};

type LatestMessageRow = {
  conversation_id: string;
  body: string | null;
  created_at: string;
  sender_id: string;
  attachment_name?: string | null;
};


type ListingOfferConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offered_price: number;
  status: string | null;
  counter_price: number | null;
  created_at: string | null;
};

type MessageRow = {
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

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function getSafeListingStatus(status: unknown): ListingStatus {
  return isValidListingStatus(status) ? status : "available";
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: conversations }, { data: hiddenRows }] = await Promise.all([
    supabase
      .from("conversations")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false }),
    supabase
      .from("hidden_conversations")
      .select("conversation_id")
      .eq("user_id", user.id),
  ]);

  const hiddenConversationIds = new Set(
    (hiddenRows || []).map((row: { conversation_id: string }) => row.conversation_id)
  );

  const safeConversations = ((conversations || []) as ConversationRow[]).filter(
    (conversation) => !hiddenConversationIds.has(conversation.id)
  );

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const typedConversation = (conversation as ConversationRow | null) ?? null;

  if (
    !typedConversation ||
    hiddenConversationIds.has(typedConversation.id) ||
    (typedConversation.buyer_id !== user.id &&
      typedConversation.seller_id !== user.id)
  ) {
    notFound();
  }

  const { data: unreadBeforeOpen } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", typedConversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const initialUnreadMessageIds = (unreadBeforeOpen || []).map(
    (message: { id: string }) => message.id
  );

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", typedConversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const listingIds = safeConversations.map((c) => c.listing_id);
  const otherUserIds = safeConversations.map((c) =>
    c.buyer_id === user.id ? c.seller_id : c.buyer_id
  );
  const conversationIds = safeConversations.map((c) => c.id);

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, price, status")
    .in("id", listingIds);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, user_type")
    .in("id", otherUserIds);

  const { data: latestMessages } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at, sender_id, attachment_name")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const { data: unreadMessages } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", typedConversation.id)
    .order("created_at", { ascending: true });

  const { data: offers } = await supabase
    .from("listing_offers")
    .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at")
    .eq("listing_id", typedConversation.listing_id)
    .eq("buyer_id", typedConversation.buyer_id)
    .eq("seller_id", typedConversation.seller_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const listingsMap = new Map(
    ((listings || []) as ListingChatRow[]).map((l) => [l.id, l])
  );
  const profilesMap = new Map(
    ((profiles || []) as ProfileRow[]).map((p) => [p.id, p])
  );

  const latestMessageMap = new Map<string, LatestMessageRow>();

  for (const message of (latestMessages || []) as LatestMessageRow[]) {
    if (!latestMessageMap.has(message.conversation_id)) {
      latestMessageMap.set(message.conversation_id, message);
    }
  }

  const unreadCountMap = new Map<string, number>();

  for (const message of unreadMessages || []) {
    unreadCountMap.set(
      message.conversation_id,
      (unreadCountMap.get(message.conversation_id) || 0) + 1
    );
  }

  const conversationSummaries: ConversationSummary[] = safeConversations.map(
    (item) => {
      const otherUserId =
        item.buyer_id === user.id ? item.seller_id : item.buyer_id;

      const otherProfile = profilesMap.get(otherUserId);
      const listing = listingsMap.get(item.listing_id);
      const latestMessage = latestMessageMap.get(item.id);
      const unreadCount = unreadCountMap.get(item.id) || 0;

      const latestMessageBody =
        latestMessage?.body?.trim() ||
        (latestMessage?.attachment_name
          ? `📎 ${latestMessage.attachment_name}`
          : "Sin mensajes todavía");

      return {
        id: item.id,
        otherName:
          otherProfile?.full_name && otherProfile.full_name.trim().length > 0
            ? otherProfile.full_name.trim()
            : "Usuario",
        listingTitle: listing?.title || "Anuncio",
        latestMessageBody,
        latestMessageCreatedAt: latestMessage?.created_at || null,
        unreadCount,
      };
    }
  );

  const otherUserId =
    typedConversation.buyer_id === user.id
      ? typedConversation.seller_id
      : typedConversation.buyer_id;

  const otherProfile = profilesMap.get(otherUserId);
  const listing = listingsMap.get(typedConversation.listing_id);

  const otherName =
    otherProfile?.full_name && otherProfile.full_name.trim().length > 0
      ? otherProfile.full_name.trim()
      : "Usuario";

  const otherRole =
    otherProfile?.user_type === "parent"
      ? "Familia / Tutor legal"
      : otherProfile?.user_type === "student"
        ? "Estudiante"
        : "Miembro de Wetudy";

  const listingStatus = getSafeListingStatus(listing?.status);
  const canSendMessages = canSendNewMessageToListing(listingStatus);
  const activeOffer = ((offers || []) as ListingOfferConversationRow[])[0] || null;
  const conversationOffer: ConversationOfferCardData | null = activeOffer
    ? {
      id: activeOffer.id,
      listingId: activeOffer.listing_id,
      buyerId: activeOffer.buyer_id,
      sellerId: activeOffer.seller_id,
      offeredPrice: activeOffer.offered_price,
      counterPrice: activeOffer.counter_price,
      status: activeOffer.status,
      createdAt: activeOffer.created_at,
    }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationsSidebar
          conversations={conversationSummaries}
          selectedConversationId={typedConversation.id}
          currentUserId={user.id}
        />

        <Card className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-white">
          <div className="border-b px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <Link
                href={`/profile/${otherUserId}`}
                className="min-w-0 flex-1 rounded-xl transition hover:bg-muted/40"
              >
                <div className="flex items-center gap-3 rounded-xl p-2">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{otherName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {otherRole}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {listing?.title || "Anuncio"}
                    </p>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <ReportConversationButton conversationId={typedConversation.id} />

                <HideConversationButton
                  conversationId={typedConversation.id}
                  variant="outline"
                  size="sm"
                />

                <Link href={`/profile/${otherUserId}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    Ver perfil
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="flex-1 px-5 py-5">
            {conversationOffer ? (
              <ConversationOfferCard offer={conversationOffer} currentUserId={user.id} />
            ) : null}

            <RealtimeChatMessages
              conversationId={typedConversation.id}
              currentUserId={user.id}
              initialMessages={(messages || []) as MessageRow[]}
              initialUnreadMessageIds={initialUnreadMessageIds}
            />
          </div>

          <div className="border-t px-5 py-4">
            <ConversationListingState
              listingId={typedConversation.listing_id}
              initialStatus={listingStatus}
              title={listing?.title || "Anuncio"}
              price={typeof listing?.price === "number" ? listing.price : null}
            >
              <SendMessageForm
                conversationId={typedConversation.id}
                disabled={!canSendMessages}
              />
            </ConversationListingState>
          </div>
        </Card>
      </div>
    </div>
  );
}