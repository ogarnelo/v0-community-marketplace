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
      const [{ data: conversations }, { data: hiddenRows }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id")
          .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`),
        supabase
          .from("hidden_conversations")
          .select("conversation_id")
          .eq("user_id", currentUserId),
      ]);

      const hiddenConversationIds = new Set(
        (hiddenRows || []).map((row: { conversation_id: string }) => row.conversation_id)
      );

      const conversationIds = (conversations || [])
        .map((c: any) => c.id)
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
    };

    void loadUnreadCount();

    const messagesChannel = supabase
      .channel(`navbar-unread-messages-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async () => {
          await loadUnreadCount();
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`navbar-unread-conversations-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        async () => {
          await loadUnreadCount();
        }
      )
      .subscribe();

    const hiddenChannel = supabase
      .channel(`navbar-hidden-conversations-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hidden_conversations",
          filter: `user_id=eq.${currentUserId}`,
        },
        async () => {
          await loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(hiddenChannel);
    };
  }, [currentUserId, supabase]);

  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}