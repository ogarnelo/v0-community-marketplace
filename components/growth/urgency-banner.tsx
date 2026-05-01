export default function UrgencyBanner({ views }: { views?: number }) {
  if (!views) return null;

  return (
    <div className="bg-yellow-100 text-yellow-800 p-2 text-sm rounded-lg">
      {views} personas han visto este producto recientemente
    </div>
  );
}
