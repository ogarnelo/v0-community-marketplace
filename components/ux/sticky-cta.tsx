"use client";

export default function StickyCTA({
  price,
  onBuy,
  onOffer,
}: {
  price: number;
  onBuy?: () => void;
  onOffer?: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 flex gap-2">
      <button
        onClick={onOffer}
        className="flex-1 border rounded-lg py-3 text-sm font-medium"
      >
        Hacer oferta
      </button>
      <button
        onClick={onBuy}
        className="flex-1 bg-primary text-white rounded-lg py-3 text-sm font-semibold"
      >
        Comprar · {price}€
      </button>
    </div>
  );
}
