"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  canSendNewMessageToListing,
  isValidListingStatus,
  type ListingStatus,
} from "@/lib/marketplace/listing-status";

interface SendMessageFormProps {
  conversationId: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function getSafeListingStatus(status: unknown): ListingStatus {
  return isValidListingStatus(status) ? status : "available";
}

export function SendMessageForm({
  conversationId,
  disabled = false,
}: SendMessageFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [body, setBody] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = !disabled && (body.trim().length > 0 || !!selectedFile);

  const handlePickFile = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setFileError(
        "Tipo de archivo no permitido. Usa imágenes, PDF o documentos Word."
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setFileError("El archivo supera el límite de 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    if (disabled) return;
    setSelectedFile(null);
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (disabled || !canSend || loading) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("id, listing_id, buyer_id, seller_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (!conversation) {
        throw new Error("La conversación ya no existe.");
      }

      if (
        conversation.buyer_id !== user.id &&
        conversation.seller_id !== user.id
      ) {
        throw new Error("No tienes permisos para enviar mensajes aquí.");
      }

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", conversation.listing_id)
        .maybeSingle();

      if (listingError) {
        throw listingError;
      }

      if (!listing) {
        throw new Error("El anuncio asociado ya no existe.");
      }

      const safeStatus = getSafeListingStatus(listing.status);

      if (!canSendNewMessageToListing(safeStatus)) {
        throw new Error(
          "Este anuncio ya no permite enviar mensajes nuevos."
        );
      }

      const messageText = body.trim();

      let attachmentUrl: string | null = null;
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;
      let attachmentSize: number | null = null;

      if (selectedFile) {
        const fileExt =
          selectedFile.name.split(".").pop()?.toLowerCase() || "file";
        const safeFileName = selectedFile.name.replace(/\s+/g, "-");
        const filePath = `${conversationId}/${user.id}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("chat-attachments")
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        if (signedUrlError) {
          throw signedUrlError;
        }

        attachmentUrl = signedUrlData.signedUrl;
        attachmentPath = filePath;
        attachmentName = selectedFile.name;
        attachmentType = selectedFile.type || `application/${fileExt}`;
        attachmentSize = selectedFile.size;
      }

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: messageText || null,
        read_at: null,
        attachment_url: attachmentUrl,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
        attachment_size: attachmentSize,
      });

      if (insertError) {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      if (updateError) {
        throw updateError;
      }

      setBody("");
      clearSelectedFile();
      router.refresh();
    } catch (error: any) {
      console.error("Error enviando mensaje:", error);

      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        "No se pudo enviar el mensaje.";

      alert(`Error enviando mensaje: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx"
        disabled={disabled}
      />

      {selectedFile ? (
        <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-white p-2 shadow-sm">
              {isImageFile(selectedFile) ? (
                <ImageIcon className="h-4 w-4 text-emerald-600" />
              ) : (
                <FileText className="h-4 w-4 text-emerald-600" />
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSelectedFile}
            disabled={disabled}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-slate-200 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {fileError ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <span>{fileError}</span>
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        <button
          type="button"
          onClick={handlePickFile}
          disabled={disabled}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white text-slate-600 transition hover:border-emerald-500 hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Adjuntar archivo"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              disabled
                ? "No se pueden enviar más mensajes en este anuncio"
                : "Escribe tu mensaje..."
            }
            rows={2}
            className="min-h-[52px] resize-none rounded-2xl"
            disabled={disabled}
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !canSend}
          className="rounded-full bg-emerald-600 px-5 hover:bg-emerald-700"
        >
          {loading ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}