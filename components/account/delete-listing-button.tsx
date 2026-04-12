"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteListingButtonProps {
  listingId: string;
  title?: string | null;
}

export function DeleteListingButton({ listingId, title }: DeleteListingButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    if (loading || isPending) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/listings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar el anuncio.");
      }

      const message =
        payload?.mode === "archived"
          ? "El anuncio tenía historial relacionado y se ha archivado para no romper conversaciones ni operaciones."
          : "El anuncio se ha eliminado correctamente.";

      alert(message);
      startTransition(() => {
        router.refresh();
      });
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo eliminar el anuncio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar anuncio</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? `Vas a eliminar “${title}”.` : "Vas a eliminar este anuncio."} Si ya tiene operaciones o historial relacionado, Wetudy lo archivará en lugar de borrarlo para no romper chats ni pagos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading || isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={loading || isPending} onClick={handleDelete}>
            {loading || isPending ? "Eliminando..." : "Eliminar anuncio"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
