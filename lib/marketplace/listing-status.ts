export type ListingStatus = "available" | "reserved" | "sold" | "archived";

type ListingStatusConfig = {
  label: string;
  description: string;
  canContact: boolean;
  badgeClassName: string;
  containerClassName: string;
};

const STATUS_CONFIG: Record<ListingStatus, ListingStatusConfig> = {
  available: {
    label: "Disponible",
    description: "Este anuncio sigue disponible y permite nuevos mensajes.",
    canContact: true,
    badgeClassName:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    containerClassName:
      "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  },
  reserved: {
    label: "Reservado",
    description:
      "Este anuncio está reservado. El historial sigue visible, pero no se permiten mensajes nuevos.",
    canContact: false,
    badgeClassName:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    containerClassName: "border-amber-200 bg-amber-50/70 text-amber-900",
  },
  sold: {
    label: "Vendido",
    description:
      "Este anuncio ya se ha vendido. El historial sigue visible, pero no se permiten mensajes nuevos.",
    canContact: false,
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
    containerClassName: "border-slate-200 bg-slate-50 text-slate-900",
  },
  archived: {
    label: "Archivado",
    description:
      "Este anuncio ha sido archivado. El historial sigue visible, pero no se permiten mensajes nuevos.",
    canContact: false,
    badgeClassName:
      "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200",
    containerClassName: "border-zinc-200 bg-zinc-50 text-zinc-900",
  },
};

export function isValidListingStatus(value: unknown): value is ListingStatus {
  return (
    value === "available" ||
    value === "reserved" ||
    value === "sold" ||
    value === "archived"
  );
}

export function getListingStatusConfig(status: ListingStatus): ListingStatusConfig {
  return STATUS_CONFIG[status];
}

export function canSendNewMessageToListing(status: ListingStatus): boolean {
  return STATUS_CONFIG[status].canContact;
}
