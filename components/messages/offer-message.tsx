
"use client";

export function OfferMessage({ body }: { body: string }) {
  if (!body.includes("Oferta")) return <span>{body}</span>;

  return (
    <div className="p-3 border rounded-lg bg-yellow-50">
      <p className="font-medium">{body}</p>
      <p className="text-xs text-gray-500">
        Esta oferta puede gestionarse desde el panel de anuncios.
      </p>
    </div>
  );
}
