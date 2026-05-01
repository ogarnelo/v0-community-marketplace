"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface NavbarMessagesBadgeProps {
  currentUserId: string;
  initialCount?: number;
  className?: string;
}

export function NavbarMessagesBadge({
  currentUserId,
  initialCount = 0,
  className = "absolute -right-2 -top-2",
}: NavbarMessagesBadgeProps) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (!currentUserId) {
      setCount(0);
      return;
    }

    let isMounted = true;

    async function loadUnreadCount() {
      try {
        const { data: conversations, error: conversationsError } = await supabase
          .from("conversations")
          .select("id")
          .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`);

        if (!isMounted || conversationsError) {
          if (isMounted) setCount(0);
          return;
        }

        const conversationIds = (conversations || []).map((conversation: { id: string }) => conversation.id);

        if (conversationIds.length === 0) {
          setCount(0);
          return;
        }

        const { data: unreadMessages, error: unreadError } = await supabase
          .from("messages")
          .select("id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", currentUserId)
          .is("read_at", null);

        if (!isMounted) return;
        setCount(unreadError ? 0 : unreadMessages?.length || 0);
      } catch {
        if (isMounted) setCount(0);
      }
    }

    void loadUnreadCount();

    const channel = supabase
      .channel(`navbar-messages-badge-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void loadUnreadCount())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  if (count <= 0) return null;

  return (
    <span className={`${className} inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default NavbarMessagesBadge;
