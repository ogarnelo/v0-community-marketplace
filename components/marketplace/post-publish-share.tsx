
"use client";

export default function PostPublishShare({ url }: { url: string }) {
  const share = () => {
    const text = encodeURIComponent("Mira mi anuncio en Wetudy " + url);
    window.open(`https://wa.me/?text=${text}`);
  };

  return (
    <div className="mt-6 border rounded-xl p-4">
      <p className="text-sm mb-2">Comparte tu anuncio para vender más rápido</p>
      <button onClick={share} className="bg-green-600 text-white px-3 py-2 rounded-lg">
        Compartir en WhatsApp
      </button>
    </div>
  );
}
