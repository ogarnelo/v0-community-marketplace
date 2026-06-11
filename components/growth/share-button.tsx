"use client";

export default function ShareButton({ listingId }: { listingId: string }) {
  const share = async () => {
    const res = await fetch("/api/share/listing", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ listingId }),
    });

    const data = await res.json();

    if (navigator.share) {
      navigator.share({
        title: "Mira este producto en Wetudy",
        url: data.url,
      });
    } else {
      navigator.clipboard.writeText(data.url);
      alert("Link copiado");
    }
  };

  return (
    <button onClick={share} className="border px-3 py-2 rounded-lg">
      Compartir
    </button>
  );
}
