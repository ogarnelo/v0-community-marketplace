"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Lock, MessageCircleMore } from "lucide-react";
import ListingStatusBanner from "@/components/messages/listing-status-banner";
import { createClient } from "@/lib/supabase/client";
import {
  canSendNewMessageToListing,
  isValidListingStatus,
  type ListingStatus,
} from "@/lib/marketplace/listing-status";

type ConversationListingStateProps = {
  listingId: string;
  listingHref?: string;
  initialStatus: ListingStatus;
  title?: string | null;
  price?: number | null;
  children?: React.ReactNode;
  lockChildrenWhenUnavailable?: boolean;
  allowConversationMessagingWhenUnavailable?: boolean;
  className?: string;
};

export default function ConversationListingState({
  listingId,
  listingHref,
  initialStatus,
  title,
  price,
  children,
  lockChildrenWhenUnavailable = true,
  allowConversationMessagingWhenUnavailable = false,
  className,
}: ConversationListingStateProps) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<ListingStatus>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const refreshStatus = async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("status")
        .eq("id", listingId)
        .maybeSingle();

      if (!error && isValidListingStatus(data?.status)) {
        setStatus(data.status);
      }
    };

    void refreshStatus();

    const channel = supabase
      .channel(`listing-status-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `id=eq.${listingId}`,
        },
        (payload) => {
          const nextStatus = payload.new?.status;
          if (isValidListingStatus(nextStatus)) {
            setStatus(nextStatus);
          } else {
            void refreshStatus();
          }
        }
      )
      .subscribe();

    const pollTimeout = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        void refreshStatus();
      }, 2000);

      window.setTimeout(() => {
        window.clearInterval(interval);
      }, 15000);
    }, 300);

    const onFocus = () => {
      void refreshStatus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearTimeout(pollTimeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [listingId, supabase]);

  const isUnavailable = !canSendNewMessageToListing(status);
  const isLocked = lockChildrenWhenUnavailable && isUnavailable && !allowConversationMessagingWhenUnavailable;

  return (
    <div className={className}>
      <ListingStatusBanner status={status} title={title} titleHref={listingHref} price={price} />

      {children ? (
        <div className="mt-3">
          {isLocked ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Mensajes desactivados para este anuncio</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Puedes seguir viendo la conversación, pero ya no se pueden enviar mensajes nuevos porque el anuncio ya no está disponible.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none opacity-50">{children}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {isUnavailable && allowConversationMessagingWhenUnavailable ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                  <div className="flex items-start gap-2">
                    <MessageCircleMore className="mt-0.5 h-4 w-4 text-sky-700" />
                    <div>
                      <p className="text-sm font-medium text-sky-900">Puedes seguir usando este chat</p>
                      <p className="mt-1 text-sm text-sky-800">
                        Aunque el anuncio ya no admite contactos nuevos, esta conversación sigue activa para concretar la entrega, resolver dudas o cerrar la operación.
                        {listingHref ? (
                          <>
                            {" "}
                            <Link href={listingHref} className="font-medium underline underline-offset-2">
                              Abrir anuncio
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {children}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
