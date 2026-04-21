import { ShieldCheck, Truck, Wallet } from "lucide-react";

interface BuyerProtectionCardProps {
  compact?: boolean;
}

export function BuyerProtectionCard({ compact = false }: BuyerProtectionCardProps) {
  return (
    <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-emerald-950">Compra protegida en Wetudy</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900/80">
            Paga dentro de la plataforma para dejar trazabilidad de la operación y mantener el soporte de Wetudy si surge una incidencia.
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
        <div className="rounded-xl bg-white/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-950">
            <Wallet className="h-4 w-4" />
            Pago trazable
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-900/80">
            La operación queda asociada al anuncio, al chat y al importe acordado.
          </p>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-950">
            <Truck className="h-4 w-4" />
            Envío o entrega en mano
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-900/80">
            Puedes cerrar la operación en persona o preparar envío desde el checkout.
          </p>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-950">
            <ShieldCheck className="h-4 w-4" />
            Soporte y reputación
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-900/80">
            Las operaciones completadas fortalecen reseñas, confianza e historial del perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
