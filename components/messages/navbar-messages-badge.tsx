"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface NavbarMessagesBadgeProps {
  currentUserId: string;
  initialCount?: number;
}

export function NavbarMessagesBadge({
  currentUserId,
  initialCount = 0,
}: NavbarMessagesBadgeProps) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let isMounted = true;

    const loadUnreadCount = async () => {
      try {
        const { data: conversations, error: conversationsError } = await supabase
          .from("conversations")
          .select("id")
          .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`);

        if (conversationsError || !isMounted) {
          if (isMounted) setCount(0);
          return;
        }

        let hiddenConversationIds = new Set<string>();

        try {
          const { data: hiddenRows } = await supabase
            .from("hidden_conversations")
            .select("conversation_id")
            .eq("user_id", currentUserId);

          hiddenConversationIds = new Set(
            (hiddenRows || []).map((row: { conversation_id: string }) => row.conversation_id)
          );
        } catch {
          hiddenConversationIds = new Set();
        }

        const conversationIds = (conversations || [])
          .map((conversation: { id: string }) => conversation.id)
          .filter((id: string) => !hiddenConversationIds.has(id));

        if (!isMounted) return;

        if (conversationIds.length === 0) {
          setCount(0);
          return;
        }

        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", currentUserId)
          .is("read_at", null);

        if (!isMounted) return;
        setCount(unreadMessages?.length || 0);
      } catch {
        if (isMounted) setCount(0);
      }
    };

    void loadUnreadCount();

    const messagesChannel = supabase
      .channel(`navbar-unread-messages-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void loadUnreadCount()
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`navbar-unread-conversations-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void loadUnreadCount()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [currentUserId, supabase]);

  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default NavbarMessagesBadge;
