"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AppNotificationRow } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarNotificationsBellProps {
  currentUserId: string;
  initialNotifications?: AppNotificationRow[];
  initialUnreadCount?: number;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}


function getNotificationLabel(kind: string) {
  switch (kind) {
    case "new_follower":
      return "Seguimiento";
    case "offer_created":
    case "offer_countered":
    case "offer_accepted":
    case "offer_rejected":
      return "Oferta";
    case "payment_succeeded":
    case "payment_failed":
      return "Pago";
    case "shipment_created":
    case "shipment_updated":
    case "shipment_delivered":
      return "Envío";
    default:
      return "Actividad";
  }
}

export function NavbarNotificationsBell({
  currentUserId,
  initialNotifications = [],
  initialUnreadCount = 0,
}: NavbarNotificationsBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<AppNotificationRow[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, user_id, kind, title, body, href, metadata, read_at, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;

      const nextItems = (data || []) as AppNotificationRow[];
      setNotifications(nextItems);
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .is("read_at", null);
      if (!isMounted) return;
      setUnreadCount(count || 0);
    };

    void loadNotifications();

    const channel = supabase
      .channel(`navbar-notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        async () => {
          await loadNotifications();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  const markAllRead = async () => {
    if (markingAllRead || unreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const openNotification = async (notification: AppNotificationRow) => {
    if (!notification.read_at) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      });

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    window.location.assign(notification.href || "/account/activity");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={unreadCount > 0 ? "secondary" : "ghost"} size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[26rem]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div><DropdownMenuLabel className="p-0">Notificaciones</DropdownMenuLabel><p className="text-xs text-muted-foreground">{unreadCount > 0 ? `Tienes ${unreadCount} sin leer` : "Todo al día"}</p></div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            onClick={markAllRead}
            disabled={markingAllRead || unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todo
          </Button>
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">
            Aún no tienes notificaciones.
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="block cursor-pointer space-y-1 py-3"
              onSelect={(event) => {
                event.preventDefault();
                void openNotification(notification);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {getNotificationLabel(notification.kind)}
                    </span>
                    {!notification.read_at ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    ) : null}
                  </div>
                  <p className="truncate text-sm font-medium">{notification.title}</p>
                  {notification.body ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{formatRelativeDate(notification.created_at)}</p>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/activity">Ver toda la actividad</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
