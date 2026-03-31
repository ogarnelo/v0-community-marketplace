"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  categories,
  gradeLevels,
  conditions,
  bookFormats,
  bookLanguages,
} from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  ArrowLeft,
  HelpCircle,
  BookOpen,
  ImagePlus,
  X,
  School,
  AlertCircle,
} from "lucide-react";
import type {
  ListingPhotoRow,
  ListingRow,
  SchoolRow,
} from "@/lib/types/marketplace";
import { buildListingTypeColumns, getListingTypeFromRow } from "@/lib/marketplace/listing-type";

type ExistingPhoto = {
  id: string;
  url: string;
  sortOrder: number;
};

type NewPhoto = {
  file: File;
  previewUrl: string;
};

const STORAGE_BUCKET = "listing-photos";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const listingId = params?.id;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [isDonation, setIsDonation] = useState(false);
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  const [isbn, setIsbn] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [bookFormat, setBookFormat] = useState("");
  const [bookLanguage, setBookLanguage] = useState("");

  const [schoolLabel, setSchoolLabel] = useState("Centro no asignado");
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);

  const isTextbook = selectedCategory === "Libros de texto";

  const normalizedGradeLevels = useMemo(
    () => Array.from(new Set(gradeLevels)).filter(Boolean),
    []
  );

  const visibleExistingPhotos = useMemo(
    () => existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id)),
    [existingPhotos, removedPhotoIds]
  );

  const totalVisiblePhotos = visibleExistingPhotos.length + newPhotos.length;

  useEffect(() => {
    return () => {
      newPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
    };
  }, [newPhotos]);

  useEffect(() => {
    const loadListing = async () => {
      if (!listingId || typeof listingId !== "string") {
        setNotFound(true);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);

      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.assign(`/auth?next=/marketplace/edit/${listingId}`);
          return;
        }

        const { data: listing, error: listingError } = await supabase
          .from("listings")
          .select(
            "id, title, description, category, grade_level, condition, type, listing_type, price, original_price, seller_id, school_id, status"
          )
          .eq("id", listingId)
          .maybeSingle();

        if (listingError) {
          throw listingError;
        }

        const typedListing = listing as ListingRow | null;

        if (!typedListing) {
          setNotFound(true);
          return;
        }

        if (typedListing.seller_id !== user.id) {
          window.location.assign("/account/listings");
          return;
        }

        setTitle(typedListing.title || "");
        setDescription(typedListing.description || "");
        setSelectedCategory(typedListing.category || "");
        setSelectedGradeLevel(typedListing.grade_level || "");
        setSelectedCondition(typedListing.condition || "");
        setIsDonation(getListingTypeFromRow(typedListing) === "donation");
        setPrice(
          typeof typedListing.price === "number" ? String(typedListing.price) : ""
        );
        setOriginalPrice(
          typeof typedListing.original_price === "number"
            ? String(typedListing.original_price)
            : ""
        );

        if (typedListing.school_id) {
          const { data: school } = await supabase
            .from("schools")
            .select("id, name, city")
            .eq("id", typedListing.school_id)
            .maybeSingle();

          const typedSchool = (school as SchoolRow | null) ?? null;

          if (typedSchool) {
            setSchoolLabel(
              typedSchool.city
                ? `${typedSchool.name}, ${typedSchool.city}`
                : typedSchool.name
            );
          }
        }

        const { data: listingPhotos, error: photosError } = await supabase
          .from("listing_photos")
          .select("id, listing_id, url, sort_order")
          .eq("listing_id", typedListing.id)
          .order("sort_order", { ascending: true });

        if (photosError) {
          throw photosError;
        }

        const mappedPhotos = ((listingPhotos || []) as ListingPhotoRow[]).map(
          (photo, index) => ({
            id: photo.id,
            url: photo.url,
            sortOrder:
              typeof photo.sort_order === "number" ? photo.sort_order : index,
          })
        );

        setExistingPhotos(mappedPhotos);
      } catch (error: any) {
        console.error("Error cargando anuncio para editar:", error);
        setSubmitError(
          error?.message ||
          error?.details ||
          "No se pudo cargar el anuncio."
        );
      } finally {
        setPageLoading(false);
      }
    };

    void loadListing();
  }, [listingId]);

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    setPhotoError("");

    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - totalVisiblePhotos;

    if (availableSlots <= 0) {
      setPhotoError("Solo puedes tener un m√°ximo de 5 fotos.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const nextFiles = incomingFiles.slice(0, availableSlots);
    const accepted: NewPhoto[] = [];

    for (const file of nextFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setPhotoError("Solo se permiten im√°genes JPG, PNG, WEBP o GIF.");
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setPhotoError("Cada imagen debe pesar menos de 10 MB.");
        continue;
      }

      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) {
      setNewPhotos((prev) => [...prev, ...accepted]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveExistingPhoto = (photoId: string) => {
    setRemovedPhotoIds((prev) => [...prev, photoId]);
  };

  const handleRestoreExistingPhoto = (photoId: string) => {
    setRemovedPhotoIds((prev) => prev.filter((id) => id !== photoId));
  };

  const handleRemoveNewPhoto = (index: number) => {
    setNewPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = () => {
    if (!title.trim()) return "Debes indicar un t√≠tulo.";
    if (!description.trim()) return "Debes a√±adir una descripci√≥n.";
    if (!selectedCategory) return "Debes seleccionar una categor√≠a.";
    if (!selectedGradeLevel) return "Debes seleccionar un curso o etapa.";
    if (!selectedCondition) return "Debes seleccionar el estado del material.";

    if (!isDonation) {
      if (!price.trim()) return "Debes indicar un precio para la venta.";

      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return "El precio debe ser un n√∫mero v√°lido.";
      }

      if (originalPrice.trim()) {
        const numericOriginalPrice = Number(originalPrice);
        if (Number.isNaN(numericOriginalPrice) || numericOriginalPrice < 0) {
          return "El precio original debe ser un n√∫mero v√°lido.";
        }
      }
    }

    return null;
  };

  const uploadNewPhotos = async (listingIdValue: string) => {
    if (newPhotos.length === 0) return [];

    const supabase = createClient();
    const uploadedRows: { listing_id: string; url: string; sort_order: number }[] =
      [];

    const startingSortOrder = visibleExistingPhotos.length;

    for (let index = 0; index < newPhotos.length; index += 1) {
      const item = newPhotos[index];
      const file = item.file;
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = sanitizeFileName(file.name);
      const filePath = `${listingIdValue}/${Date.now()}-${index}-${safeName || `image.${fileExt}`}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error("No se pudo obtener la URL p√∫blica de una de las im√°genes.");
      }

      uploadedRows.push({
        listing_id: listingIdValue,
        url: publicUrl,
        sort_order: startingSortOrder + index,
      });
    }

    return uploadedRows;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSubmitError("");
    setPhotoError("");

    try {
      const validationError = validateForm();

      if (validationError) {
        setSubmitError(validationError);
        return;
      }

      if (!listingId || typeof listingId !== "string") {
        throw new Error("Identificador de anuncio no v√°lido.");
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign(`/auth?next=/marketplace/edit/${listingId}`);
        return;
      }

      const { data: listingOwner } = await supabase
        .from("listings")
        .select("id, seller_id")
        .eq("id", listingId)
        .maybeSingle();

      if (!listingOwner || listingOwner.seller_id !== user.id) {
        throw new Error("No tienes permisos para editar este anuncio.");
      }

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          description: description.trim(),
          category: selectedCategory,
          grade_level: selectedGradeLevel,
          condition: selectedCondition,
          type: isDonation ? "donation" : "sale",
          price: isDonation ? null : Number(price),
          original_price:
            isDonation || !originalPrice.trim() ? null : Number(originalPrice),
        })
        .eq("id", listingId);

      if (updateError) {
        throw updateError;
      }

      if (removedPhotoIds.length > 0) {
        const { error: deletePhotosError } = await supabase
          .from("listing_photos")
          .delete()
          .in("id", removedPhotoIds);

        if (deletePhotosError) {
          throw deletePhotosError;
        }
      }

      const remainingExistingPhotos = visibleExistingPhotos.map((photo, index) => ({
        id: photo.id,
        sort_order: index,
      }));

      for (const photo of remainingExistingPhotos) {
        const { error: reorderError } = await supabase
          .from("listing_photos")
          .update({ sort_order: photo.sort_order })
          .eq("id", photo.id);

        if (reorderError) {
          throw reorderError;
        }
      }

      const uploadedRows = await uploadNewPhotos(listingId);

      if (uploadedRows.length > 0) {
        const { error: insertPhotosError } = await supabase
          .from("listing_photos")
          .insert(uploadedRows);

        if (insertPhotosError) {
          throw insertPhotosError;
        }
      }

      router.push(`/marketplace/listing/${listingId}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error actualizando anuncio:", error);
      setSubmitError(
        error?.message ||
        error?.details ||
        error?.error_description ||
        "No se pudo actualizar el anuncio."
      );
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando anuncio...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Anuncio no encontrado
          </h2>
          <p className="mt-2 text-muted-foreground">
            Este anuncio no existe o ha sido eliminado.
          </p>
          <Link href="/account/listings">
            <Button className="mt-4">Volver a mis anuncios</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <Link
          href={`/marketplace/listing/${listingId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al anuncio
        </Link>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              Editar anuncio
            </CardTitle>
            <CardDescription>
              Actualiza la informaci√≥n de tu anuncio.
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="title">T√≠tulo *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Libro Matem√°ticas 3.¬∫ ESO"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripci√≥n *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe el estado, editorial, edici√≥n..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Categor√≠a *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Curso / Etapa *</Label>
                  <Select
                    value={selectedGradeLevel}
                    onValueChange={setSelectedGradeLevel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {normalizedGradeLevels.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Estado del material *</Label>
                <Select
                  value={selectedCondition}
                  onValueChange={setSelectedCondition}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-medium">{c.label}</span>
                          <span className="text-xs leading-snug text-muted-foreground">
                            {c.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isTextbook ? (
                <Card className="border-border bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Detalles del libro
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Campos opcionales visuales para libros de texto
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="isbn">ISBN</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 rounded-full"
                              type="button"
                            >
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="sr-only">Qu√© es el ISBN</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm" side="top">
                            <p className="font-semibold text-foreground">
                              ¬¨√∏Qu√© es el ISBN?
                            </p>
                            <p className="mt-1 leading-relaxed text-muted-foreground">
                              ISBN son las siglas de International Standard Book Number
                              y consiste en un c√≥digo que sirve para identificar de
                              manera √∫nica cada producto editorial.
                            </p>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Input
                        id="isbn"
                        value={isbn}
                        onChange={(e) => setIsbn(e.target.value)}
                        placeholder="978-84-XXXXXXXXX"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="author">Autor</Label>
                      <Input
                        id="author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Nombre del autor"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="publisher">Editorial</Label>
                      <Input
                        id="publisher"
                        value={publisher}
                        onChange={(e) => setPublisher(e.target.value)}
                        placeholder="Ej: SM, Anaya, Santillana..."
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label>Formato</Label>
                        <Select value={bookFormat} onValueChange={setBookFormat}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bookFormats.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label>Idioma</Label>
                        <Select value={bookLanguage} onValueChange={setBookLanguage}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bookLanguages.map((lang) => (
                              <SelectItem key={lang} value={lang}>
                                {lang}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex items-center gap-4 rounded-lg border border-border p-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {isDonation ? "Donaci√≥n" : "Venta"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDonation
                      ? "El admin de tu centro gestionar√° las solicitudes"
                      : "Establece un precio para tu material"}
                  </p>
                </div>
                <Switch checked={isDonation} onCheckedChange={setIsDonation} />
              </div>

              {!isDonation ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="price">Precio *</Label>
                    <div className="relative">
                      <Input
                        id="price"
                        type="number"
                        min="0"
                        step="0.5"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        &euro;
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="originalPrice">
                      Precio original (opcional)
                    </Label>
                    <div className="relative">
                      <Input
                        id="originalPrice"
                        type="number"
                        min="0"
                        step="0.5"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        &euro;
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label>Fotos (m√°x. 5)</Label>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {existingPhotos.map((photo) => {
                    const isRemoved = removedPhotoIds.includes(photo.id);

                    return (
                      <div
                        key={photo.id}
                        className={`relative aspect-square overflow-hidden rounded-lg border ${isRemoved ? "opacity-40" : ""
                          }`}
                      >
                        <img
                          src={photo.url}
                          alt="Foto del anuncio"
                          className="h-full w-full object-cover"
                        />

                        {isRemoved ? (
                          <button
                            type="button"
                            onClick={() => handleRestoreExistingPhoto(photo.id)}
                            className="absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium"
                          >
                            Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingPhoto(photo.id)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {newPhotos.map((photo, index) => (
                    <div
                      key={`${photo.file.name}-${index}`}
                      className="relative aspect-square overflow-hidden rounded-lg border"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewPhoto(index)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {totalVisiblePhotos < MAX_FILES ? (
                    <button
                      type="button"
                      onClick={handlePickPhoto}
                      className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    </button>
                  ) : null}
                </div>


                {photoError ? (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{photoError}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <School className="h-4 w-4" />
                  Ubicaci√≥n:{" "}
                  <span className="font-medium text-foreground">{schoolLabel}</span>
                </p>
              </div>

              {submitError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              ) : null}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar cambios
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


