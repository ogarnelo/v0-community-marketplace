"use client";

import Link from "next/link";

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around py-2 text-sm">
      <Link href="/marketplace">Inicio</Link>
      <Link href="/feed">Feed</Link>
      <Link href="/favorites">Favoritos</Link>
      <Link href="/messages">Chats</Link>
      <Link href="/account">Cuenta</Link>
    </nav>
  );
}
