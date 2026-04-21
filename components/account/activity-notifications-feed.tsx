
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AppNotificationRow } from "@/lib/notifications";

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getKindLabel(kind: string) {
  switch (kind) {
    case "new_follower":
      return "Seguimiento";
    case "followed_user_listing_created":
      return "Nuevo anuncio";
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
    case "listing_boosted":
      return "Impulso";
    default:
      return "Actividad";
  }
}

export function ActivityNotificationsFeed({
  notifications,
}: {
  notifications: AppNotificationRow[];
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Notificaciones recientes</h2>
        <p className="text-sm text-muted-foreground">
          Pagos, envíos, seguidores y publicaciones de perfiles que sigues.
        </p>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aún no tienes notificaciones recientes.
          </div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className="rounded-xl border p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getKindLabel(notification.kind)}</Badge>
                    {!notification.read_at ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Nueva
                      </span>
                    ) : null}
                  </div>
                  <p className="font-medium">{notification.title}</p>
                  {notification.body ? (
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {notification.read_at ? "Leída" : "Pendiente de leer"}
                </span>
                <Link
                  href={notification.href || "/account/activity"}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
