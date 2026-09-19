"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNotificationDestination, type AppNotificationRow } from "@/lib/notifications";

type ActivityNotificationsListProps = {
  initialNotifications: AppNotificationRow[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationLabel(kind: string) {
  switch (kind) {
    case "school_registration_requested":
      return "Centro";
    case "agreement_proposed":
    case "agreement_confirmed":
      return "Acuerdo";
    case "report_created":
      return "Moderación";
    case "saved_search_match":
      return "Búsqueda";
    default:
      return "Actividad";
  }
}

export function ActivityNotificationsList({
  initialNotifications,
}: ActivityNotificationsListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  const markAllRead = async () => {
    if (markingAllRead || unreadCount === 0) return;

    setError("");
    setMarkingAllRead(true);

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudieron marcar las notificaciones como leídas.");
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || readAt,
        }))
      );
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message || "No se pudieron actualizar las notificaciones.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const openNotification = async (notification: AppNotificationRow) => {
    setError("");

    if (!notification.read_at) {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: notification.id }),
      });

      if (response.ok) {
        const readAt = new Date().toISOString();
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, read_at: readAt } : item
          )
        );
      }
    }

    router.push(getNotificationDestination(notification));
    router.refresh();
  };

  return (
    <Card className="mb-6 border-border">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
          <CardDescription>
            Aquí aparecen los avisos que generan el contador del header.
          </CardDescription>
        </div>

        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 sm:w-auto"
            disabled={markingAllRead}
            onClick={markAllRead}
          >
            <CheckCheck className="h-4 w-4" />
            {markingAllRead ? "Marcando..." : `Marcar leídas (${unreadCount})`}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes notificaciones recientes.</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <Badge variant={notification.read_at ? "outline" : "secondary"}>
                    {notification.read_at ? getNotificationLabel(notification.kind) : "Nueva"}
                  </Badge>
                </div>

                {notification.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                ) : null}

                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(notification.created_at)}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full shrink-0 gap-2 sm:w-auto"
                onClick={() => openNotification(notification)}
              >
                Abrir
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
