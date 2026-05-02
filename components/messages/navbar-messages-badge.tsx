"use client";

export function NavbarMessagesBadge({ initialCount = 0 }: { currentUserId?: string; initialCount?: number }) {
  if (!initialCount || initialCount <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
      {initialCount > 9 ? "9+" : initialCount}
    </span>
  );
}

export default NavbarMessagesBadge;
