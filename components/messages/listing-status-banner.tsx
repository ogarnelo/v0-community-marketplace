import Link from "next/link";
import { Archive, CheckCircle2, Clock3, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { getListingStatusConfig, type ListingStatus } from "@/lib/marketplace/listing-status";

type ListingStatusBannerProps = {
  status: ListingStatus;
  title?: string | null;
  titleHref?: string;
  price?: number | null;
  className?: string;
};

function getStatusIcon(status: ListingStatus) {
  switch (status) {
    case "available":
      return <CheckCircle2 className="h-4 w-4" />;
    case "reserved":
      return <Clock3 className="h-4 w-4" />;
    case "sold":
      return <ShoppingBag className="h-4 w-4" />;
    case "archived":
      return <Archive className="h-4 w-4" />;
    default:
      return <CheckCircle2 className="h-4 w-4" />;
  }
}

export default function ListingStatusBanner({ status, title, titleHref, price, className }: ListingStatusBannerProps) {
  const config = getListingStatusConfig(status);

  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", config.containerClassName, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? (
            titleHref ? (
              <Link href={titleHref} className="block truncate text-sm font-semibold hover:underline underline-offset-2">
                {title}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold">{title}</p>
            )
          ) : null}

          <div className="mt-1 flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", config.badgeClassName)}>
              {getStatusIcon(status)}
              {config.label}
            </span>

            {typeof price === "number" ? (
              <span className="text-xs text-muted-foreground">
                {new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(price)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm leading-5 text-muted-foreground">{config.description}</p>
    </div>
  );
}
