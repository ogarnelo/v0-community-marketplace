import { AlertCircle, CheckCircle2, Clock, Lock } from "lucide-react";

function getStatusCopy(status?: string | null) {
  switch (status) {
    case "available":
      return {
        icon: CheckCircle2,
        title: "Disponible",
        description: "Puedes contactar, hacer una oferta o comprar directamente si el vendedor lo permite.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    case "reserved":
      return {
        icon: Clock,
        title: "Reservado",
        description: "Hay una operación en curso. No se pueden iniciar nuevas compras desde el anuncio.",
        className: "border-amber-200 bg-amber-50 text-amber-800",
      };
    case "sold":
      return {
        icon: Lock,
        title: "Vendido",
        description: "Este producto ya se ha vendido. Puedes ver productos relacionados más abajo.",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
    case "archived":
      return {
        icon: Lock,
        title: "Archivado",
        description: "Este anuncio ya no está activo en el marketplace.",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
    default:
      return {
        icon: AlertCircle,
        title: "Estado no disponible",
        description: "No hemos podido determinar el estado actual del anuncio.",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
  }
}

export default function ListingStatusCard({ status }: { status?: string | null }) {
  const copy = getStatusCopy(status);
  const Icon = copy.icon;

  return (
    <div className={`rounded-2xl border p-4 ${copy.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-1 text-sm opacity-90">{copy.description}</p>
        </div>
      </div>
    </div>
  );
}
