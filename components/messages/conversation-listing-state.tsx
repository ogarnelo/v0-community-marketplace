"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import ListingStatusBanner from "@/components/messages/listing-status-banner";
import { createClient } from "@/lib/supabase/client";
import {
  canSendNewMessageToListing,
  isValidListingStatus,
  type ListingStatus,
} from "@/lib/marketplace/listing-status";

type ConversationListingStateProps = {
  listingId: string;
  initialStatus: ListingStatus;
  title?: string | null;
  price?: number | null;
  children?: React.ReactNode;
  lockChildrenWhenUnavailable?: boolean;
  className?: string;
};

export default function ConversationListingState({
  listingId,
  initialStatus,
  title,
  price,
  children,
  lockChildrenWhenUnavailable = true,
  className,
}: ConversationListingStateProps) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<ListingStatus>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
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
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listingId, supabase]);

  const isLocked =
    lockChildrenWhenUnavailable && !canSendNewMessageToListing(status);

  return (
    <div className={className}>
      <ListingStatusBanner status={status} title={title} price={price} />

      {children ? (
        <div className="mt-3">
          {isLocked ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Mensajes desactivados para este anuncio
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Puedes seguir viendo la conversación, pero ya no se pueden
                      enviar mensajes nuevos porque el anuncio ya no está
                      disponible.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none opacity-50">{children}</div>
            </div>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}