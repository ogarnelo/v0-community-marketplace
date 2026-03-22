"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  ImagePlus,
  ArrowLeft,
  X,
  HelpCircle,
  BookOpen,
  Upload,
  School,
  AlertCircle,
} from "lucide-react";

type NewListingFormProps = {
  initialSchoolId: string;
  initialSchoolName: string;
  initialSchoolCity: string;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

type PreviewFile = {
  file: File;
  previewUrl: string;
};

type ListingInsertPayload = {
  title: string;
  description: string;
  category: string;
  grade_level: string;
  condition: string;
  type: string;
  price: number | null;
  original_price: number | null;
  seller_id: string;
  school_id: string | null;
  status: "available";
};

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
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [bookFormat, setBookFormat] = useState("");
  const [bookLanguage, setBookLanguage] = useState("");

  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const isTextbook = selectedCategory === "Libros de texto";

  const schoolLabel = useMemo(() => {
    if (!initialSchoolId) return "Sin centro asignado";
    if (initialSchoolCity?.trim()) {
      return `${initialSchoolName}, ${initialSchoolCity}`;
    }
    return initialSchoolName;
  }, [initialSchoolCity, initialSchoolId, initialSchoolName]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
    };
  }, [photos]);

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    setPhotoError("");

    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - photos.length;

    if (availableSlots <= 0) {
      setPhotoError("Solo puedes subir un máximo de 5 fotos.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const nextFiles = incomingFiles.slice(0, availableSlots);
    const accepted: PreviewFile[] = [];

    for (const file of nextFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setPhotoError("Solo se permiten imágenes JPG, PNG, WEBP o GIF.");
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
      setPhotos((prev) => [...prev, ...accepted]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = () => {
    if (!title.trim()) return "Debes indicar un título.";
    if (!description.trim()) return "Debes añadir una descripción.";
    if (!selectedCategory) return "Debes seleccionar una categoría.";
    if (!selectedGradeLevel) return "Debes seleccionar un curso o etapa.";
    if (!selectedCondition) return "Debes seleccionar el estado del material.";

    if (!isDonation) {
      if (!price.trim()) return "Debes indicar un precio para la venta.";

      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return "El precio debe ser un número válido.";
      }

      if (originalPrice.trim()) {
        const numericOriginalPrice = Number(originalPrice);
        if (Number.isNaN(numericOriginalPrice) || numericOriginalPrice < 0) {
          return "El precio original debe ser un número válido.";
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      if (profileError) {
        throw profileError;
      }

      const effectiveSchoolId =
        currentProfile?.school_id && currentProfile.school_id.trim().length > 0
          ? currentProfile.school_id
          : initialSchoolId || null;

      const payload: ListingInsertPayload = {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        grade_level: selectedGradeLevel,
        condition: selectedCondition,
        type: isDonation ? "donation" : "sale",
        price: isDonation ? null : Number(price),
        original_price:
          isDonation || !originalPrice.trim() ? null : Number(originalPrice),
        seller_id: user.id,
        school_id: effectiveSchoolId,
        status: "available",
      };

      const { data: insertedListing, error: insertError } = await supabase
        .from("listings")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const listingId = insertedListing?.id;

      if (!listingId) {
        router.push("/marketplace");
        router.refresh();
        return;
      }

      router.push(`/marketplace/listing/${listingId}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error publicando anuncio:", error);

      setSubmitError(
        error?.message ||
        error?.details ||
        error?.error_description ||
        "No se pudo publicar el anuncio."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <Link
          href="/marketplace"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al marketplace
        </Link>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              Publicar anuncio
            </CardTitle>
            <CardDescription>
              Publica material escolar para vender o donar a tu comunidad en{" "}
              {initialSchoolId ? initialSchoolName : "tu comunidad educativa"}.
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
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Libro Matemáticas 3º ESO"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el estado, editorial, edición..."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Categoría *</Label>
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
                      {gradeLevels.map((g) => (
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
                      Campos opcionales para libros de texto
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
                              <span className="sr-only">Qué es el ISBN</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm" side="top">
                            <p className="font-semibold text-foreground">
                              ¿Qué es el ISBN?
                            </p>
                            <p className="mt-1 leading-relaxed text-muted-foreground">
                              ISBN son las siglas de International Standard Book Number
                              y consiste en un código que sirve para identificar de
                              manera única cada producto editorial.
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
                    {isDonation ? "Donación" : "Venta"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDonation
                      ? "El admin de tu centro gestionará las solicitudes"
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
                        placeholder="0"
                        className="pr-8"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
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
                        placeholder="0"
                        className="pr-8"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        &euro;
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label>Fotos (máx. 5)</Label>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {photos.map((photo, i) => (
                    <div
                      key={`${photo.file.name}-${i}`}
                      className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {photos.length < MAX_FILES ? (
                    <button
                      type="button"
                      onClick={handlePickPhoto}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <span className="mt-2 text-[11px] text-muted-foreground">
                        Añadir
                      </span>
                    </button>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  Puedes preparar hasta 5 imágenes. La persistencia definitiva de
                  fotos se conectará a <code>listing_photos</code> cuando confirmemos
                  su esquema.
                </p>

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
                  Ubicación:{" "}
                  <span className="font-medium text-foreground">{schoolLabel}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se usará el centro asociado a tu perfil en este momento.
                </p>
              </div>

              {submitError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              ) : null}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Publicar anuncio
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
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