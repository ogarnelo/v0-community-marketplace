export default function UserBadges({ stats }: any) {
  return (
    <div className="flex gap-2 flex-wrap">
      {stats.sales > 5 && <span>🔥 Top vendedor</span>}
      {stats.sales > 0 && <span>✅ Vendedor activo</span>}
      {stats.donations > 0 && <span>🎁 Donante</span>}
    </div>
  );
}
