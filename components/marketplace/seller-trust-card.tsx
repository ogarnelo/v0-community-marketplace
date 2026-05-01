import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function SellerTrustCard({
  sellerId,
  sellerName,
  userType,
  isBusinessVerified,
  averageRating,
  reviewCount,
  activeListingsCount,
}: {
  sellerId?: string | null;
  sellerName: string;
  userType?: string | null;
  isBusinessVerified?: boolean | null;
  averageRating?: number | null;
  reviewCount: number;
  activeListingsCount: number;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vendedor</h2>
          <p className="mt-2 font-medium">{sellerName}</p>
          <p className="text-sm text-muted-foreground">
            {userType === "business" ? "Negocio local" : "Miembro de Wetudy"}
          </p>
        </div>
        {isBusinessVerified ? <Badge className="bg-emerald-600">Verificado</Badge> : null}
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground">Valoración</span>
          <span className="font-medium">
            {averageRating && reviewCount > 0 ? `⭐ ${averageRating.toFixed(1)} (${reviewCount})` : "Sin opiniones"}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground">Anuncios activos</span>
          <span className="font-medium">{activeListingsCount}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {reviewCount >= 3 ? <Badge variant="secondary">Vendedor valorado</Badge> : null}
          {activeListingsCount >= 5 ? <Badge variant="secondary">Catálogo activo</Badge> : null}
          {userType === "business" ? <Badge variant="secondary">Negocio local</Badge> : null}
        </div>
      </div>

      {sellerId ? (
        <Link href={`/profile/${sellerId}`} className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
          Ver perfil completo
        </Link>
      ) : null}
    </div>
  );
}
