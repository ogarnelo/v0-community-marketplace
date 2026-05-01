"use client";

export default function ShareButton({ listingId }: { listingId: string }) {
  const share = async () => {
    const response = await fetch("/api/share/listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });

    const data = await response.json().catch(() => null);
    const url = data?.url || `${window.location.origin}/marketplace/listing/${listingId}`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: "Mira este producto en Wetudy",
        url,
      });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      alert("Link copiado");
    }
  };

  return (
    <button type="button" onClick={share} className="rounded-lg border px-3 py-2">
      Compartir
    </button>
  );
}
