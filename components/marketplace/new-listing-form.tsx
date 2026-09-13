"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Loader2, School, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { categories, conditions, gradeLevels } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_BUCKET = "listing-photos";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type NewListingFormProps = {
  initialSchoolId: string;
  initialSchoolName: string;
  initialSchoolCity: string;
};

type PreviewFile = {
  file: File;
  previewUrl: string;
};

type ListingInsertPayload = {
  id: string;
  title: string;
  description: string;
  category: string;
  grade_level: string;
  condition: string;
  type: "sale" | "donation";
  listing_type: "sale" | "donation";
  isbn: string | null;
  price: number | null;
  original_price: number | null;
  seller_id: string;
  school_id: string | null;
  status: "available";
  photos: string[];
};

type ListingPhotoInsertPayload = {
  listing_id: string;
  url: string;
  sort_order: number;
};

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9xX]/g, "").toUpperCase();
}

function isValidIsbn(value: string) {
  if (!value) return true;
  return /^(?:\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(value));
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function isBookCategory(category: string) {
  const normalized = category.toLowerCase();
  return normalized.includes("libro") || normalized.includes("lectura");
}

function parsePrice(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return NaN;
  return Number(normalized);
}

export default function NewListingForm({
  initialSchoolId,
  initialSchoolName,
  initialSchoolCity,
}: NewListingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [isDonation, setIsDonation] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [isbn, setIsbn] = useState("");
  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const showIsbn = isBookCategory(selectedCategory);

  useEffect(() => {
    if (!showIsbn && isbn) {
      setIsbn("");
    }
  }, [isbn, showIsbn]);

  const schoolLabel = useMemo(() => {
    if (!initialSchoolId) return "Sin centro asignado";
    if (initialSchoolCity?.trim()) return `${initialSchoolName}, ${initialSchoolCity}`;
    return initialSchoolName;
  }, [initialSchoolCity, initialSchoolId, initialSchoolName]);

  const normalizedGradeLevels = useMemo(
    () => Array.from(new Set(gradeLevels)).filter(Boolean),
    []
  );

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    setPhotoError("");
    setSubmitError("");

    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - photos.length;
    if (availableSlots <= 0) {
      setPhotoError("Solo puedes subir un máximo de 5 fotos.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const accepted: PreviewFile[] = [];

    for (const file of incomingFiles.slice(0, availableSlots)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setPhotoError("Solo se permiten imágenes JPG, PNG, WEBP o GIF.");
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setPhotoError("Cada imagen debe pesar menos de 10 MB.");
        continue;
      }

      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = () => {
    if (photos.length === 0) return "Debes añadir al menos una foto real del material.";
    if (!title.trim()) return "Debes indicar un título.";
    if (!description.trim()) return "Debes añadir una descripción.";
    if (!selectedCategory) return "Debes seleccionar una categoría.";
    if (!selectedGradeLevel) return "Debes seleccionar un curso o etapa.";
    if (!selectedCondition) return "Debes seleccionar el estado del material.";
    if (showIsbn && !isValidIsbn(isbn)) return "El ISBN debe tener 10 o 13 caracteres válidos.";

    if (!isDonation) {
      if (!price.trim()) return "Debes indicar un precio para la venta.";
      const numericPrice = parsePrice(price);
      if (Number.isNaN(numericPrice) || numericPrice <= 0) {
        return "El precio debe ser un número válido mayor que 0.";
      }
      if (originalPrice.trim()) {
        const numericOriginalPrice = parsePrice(originalPrice);
        if (Number.isNaN(numericOriginalPrice) || numericOriginalPrice < 0) {
          return "El precio original debe ser un número válido.";
        }
      }
    }

    return null;
  };

  const uploadListingPhotos = async (listingId: string, files: PreviewFile[]) => {
    const supabase = createClient();
    const uploadedPhotoRows: ListingPhotoInsertPayload[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index].file;
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = sanitizeFileName(file.name);
      const filePath = `${listingId}/${Date.now()}-${index}-${safeName || `image.${fileExt}`}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) throw new Error("No se pudo obtener la URL pública de una imagen.");

      uploadedPhotoRows.push({ listing_id: listingId, url: publicUrl, sort_order: index });
    }

    return uploadedPhotoRows;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSubmitError("");
    setPhotoError("");

    try {
      const validationError = validateForm();
      if (validationError) {
        setSubmitError(validationError);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth?next=/marketplace/new");
        return;
      }

      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const effectiveSchoolId =
        currentProfile?.school_id && currentProfile.school_id.trim().length > 0
          ? currentProfile.school_id
          : initialSchoolId || null;

      const listingId = crypto.randomUUID();
      const uploadedPhotoRows = await uploadListingPhotos(listingId, photos);
      const photoUrls = uploadedPhotoRows.map((photo) => photo.url);

      if (photoUrls.length === 0) {
        throw new Error("Debes añadir al menos una foto real del material.");
      }

      const payload: ListingInsertPayload = {
        id: listingId,
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        grade_level: selectedGradeLevel,
        condition: selectedCondition,
        type: isDonation ? "donation" : "sale",
        listing_type: isDonation ? "donation" : "sale",
        isbn: showIsbn && isbn.trim() ? normalizeIsbn(isbn) : null,
        price: isDonation ? null : parsePrice(price),
        original_price: isDonation || !originalPrice.trim() ? null : parsePrice(originalPrice),
        seller_id: user.id,
        school_id: effectiveSchoolId,
        status: "available",
        photos: photoUrls,
      };

      const { error: insertError } = await supabase.from("listings").insert(payload);
      if (insertError) throw insertError;

      const { error: listingPhotosError } = await supabase.from("listing_photos").insert(uploadedPhotoRows);
      if (listingPhotosError) throw listingPhotosError;

      router.push(`/marketplace/listing/${listingId}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error publicando anuncio:", error);
      setSubmitError(
        error?.message || error?.details || error?.error_description || "No se pudo publicar el anuncio."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver al marketplace
        </Link>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Publicar anuncio</CardTitle>
            <CardDescription>
              Publica material escolar para vender o donar. La foto es obligatoria para generar confianza.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <School className="h-4 w-4" />
                  Centro asociado
                </div>
                <p className="text-sm text-muted-foreground">{schoolLabel}</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Fotos del material *</Label>
                  <span className="text-xs text-muted-foreground">{photos.length}/{MAX_FILES}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePickPhoto}
                  className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center transition hover:bg-muted/40"
                >
                  <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Añadir al menos una foto real</span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP o GIF. Máximo 10 MB por imagen.</span>
                </button>

                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((photo, index) => (
                      <div key={photo.previewUrl} className="relative overflow-hidden rounded-xl border bg-muted">
                        <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="h-28 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow"
                          aria-label="Quitar foto"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {photoError && <p className="text-sm text-destructive">{photoError}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Libro Matemáticas 3.º ESO" />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el estado, editorial, edición..." rows={4} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Categoría *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Curso / Etapa *</Label>
                  <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {normalizedGradeLevels.map((gradeLevel) => <SelectItem key={gradeLevel} value={gradeLevel}>{gradeLevel}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Estado del material *</Label>
                <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {conditions.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value}>{condition.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="listing-type">Donación</Label>
                    <p className="text-xs text-muted-foreground">Actívalo si quieres regalar el material.</p>
                  </div>
                  <input
                    id="listing-type"
                    type="checkbox"
                    checked={isDonation}
                    onChange={(e) => setIsDonation(e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                {!isDonation && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="price">Precio de venta *</Label>
                      <Input
                        id="price"
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Ej: 12"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="original-price">Precio original</Label>
                      <Input
                        id="original-price"
                        type="text"
                        inputMode="decimal"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                )}
              </div>

              {showIsbn ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="isbn">ISBN</Label>
                  <Input id="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="Opcional para libros" />
                </div>
              ) : null}

              {submitError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{submitError}</div>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publicando...</> : "Publicar anuncio"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
