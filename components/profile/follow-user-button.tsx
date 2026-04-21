
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  targetUserId: string;
  initialFollowing: boolean;
};

export default function FollowUserButton({ targetUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={following ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch("/api/follows/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            alert(result?.error || "No se pudo actualizar el seguimiento");
            return;
          }

          setFollowing(Boolean(result?.following));
        })
      }
    >
      {pending ? "Guardando..." : following ? "Siguiendo" : "Seguir"}
    </Button>
  );
}
