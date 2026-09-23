"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ImagePlus,
  Loader2,
  Package,
  School,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bookFormats, bookLanguages, categories, conditions, gradeLevels } from "@/lib/mock-data";
import { buildListingTypeColumns, getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_BUCKET = "listing-photos";
const MAX_FILES = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const UNIFORM_ITEMS = ["Polo o camiseta", "Pantalón", "Falda o pichi", "Chándal", "Sudadera o jersey", "Abrigo", "Calzado", "Ropa deportiva", "Lote completo", "Otros"];
const UNIFORM_SEASONS = ["Todo el año", "Verano", "Invierno", "Deporte", "No aplica"];
const SCHOOL_SUPPLIES = ["Papelería", "Material de dibujo", "Material de arte", "Geometría", "Archivadores y carpetas", "Calculadoras básicas", "Lote de material", "Otros"];
const TECH_ITEMS = ["Calculadora científica", "Calculadora gráfica", "Tablet", "Portátil", "E-reader", "Auriculares", "Accesorios", "Otros"];
const BAG_ITEMS = ["Mochila", "Estuche", "Bolsa de deporte", "Carrito", "Otros"];
const COURSE_REQUIRED_CATEGORIES = ["Libros de texto", "Lectura y literatura"];

type ExistingPhoto = { id: string; url: string; sortOrder: number };
type NewPhoto = { file: File; previewUrl: string };

export type EditableListing = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  grade_level: string | null;
  condition: string | null;
  type: string | null;
  listing_type: string | null;
  isbn: string | null;
  author: string | null;
  publisher: string | null;
  format: string | null;
  language: string | null;
  subject: string | null;
  specific_type: string | null;
  size_label: string | null;
  brand: string | null;
  model: string | null;
  season: string | null;
  price: number | null;
  original_price: number | null;
  seller_id: string | null;
  school_id: string | null;
  status: string | null;
};

type Props = {
  currentUserId: string;
  initialListing: EditableListing;
  initialSchoolLabel: string;
  initialPhotos: ExistingPhoto[];
};

function normalizedCategory(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isCourseRequired(category: string) {
  return COURSE_REQUIRED_CATEGORIES.some((item) => normalizedCategory(item) === normalizedCategory(category));
}

function isBookCategory(category: string) {
  const normalized = normalizedCategory(category);
  return normalized.includes("libro") || normalized.includes("lectura") || normalized.includes("literatura");
}

function isTextbookCategory(category: string) {
  return normalizedCategory(category).includes("libros de texto");
}

function isUniformCategory(category: string) {
  return normalizedCategory(category).includes("uniform");
}

function isSupplyCategory(category: string) {
  return normalizedCategory(category).includes("material escolar");
}

function isTechCategory(category: string) {
  const normalized = normalizedCategory(category);
  return normalized.includes("tecnologia") || normalized.includes("calculadora");
}

function isBagCategory(category: string) {
  return normalizedCategory(category).includes("mochila");
}

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9xX]/g, "").toUpperCase();
}

function isValidIsbn(value: string) {
  if (!value) return true;
  return /^(?:\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(value));
}

function parsePrice(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return NaN;
  return Number(normalized);
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function EditListingForm({
  currentUserId,
  initialListing,
  initialSchoolLabel,
  initialPhotos,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const categoryEffectReadyRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [title, setTitle] = useState(initialListing.title || "");
  const [description, setDescription] = useState(initialListing.description || "");
  const [selectedCategory, setSelectedCategory] = useState(initialListing.category || "");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState(initialListing.grade_level || "");
  const [selectedCondition, setSelectedCondition] = useState(initialListing.condition || "");
  const [isDonation, setIsDonation] = useState(getListingTypeFromRow(initialListing as any) === "donation");
  const [price, setPrice] = useState(initialListing.price == null ? "" : String(initialListing.price));
  const [originalPrice, setOriginalPrice] = useState(initialListing.original_price == null ? "" : String(initialListing.original_price));

  const [isbn, setIsbn] = useState(initialListing.isbn || "");
  const [author, setAuthor] = useState(initialListing.author || "");
  const [publisher, setPublisher] = useState(initialListing.publisher || "");
  const [format, setFormat] = useState(initialListing.format || "");
  const [language, setLanguage] = useState(initialListing.language || "");
  const [subject, setSubject] = useState(initialListing.subject || "");
  const [specificType, setSpecificType] = useState(initialListing.specific_type || "");
  const [sizeLabel, setSizeLabel] = useState(initialListing.size_label || "");
  const [brand, setBrand] = useState(initialListing.brand || "");
  const [model, setModel] = useState(initialListing.model || "");
  const [season, setSeason] = useState(initialListing.season || "");

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(initialPhotos);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const showBookFields = isBookCategory(selectedCategory);
  const showTextbookFields = isTextbookCategory(selectedCategory);
  const showUniformFields = isUniformCategory(selectedCategory);
  const showSupplyFields = isSupplyCategory(selectedCategory);
  const showTechFields = isTechCategory(selectedCategory);
  const showBagFields = isBagCategory(selectedCategory);
  const courseRequired = isCourseRequired(selectedCategory);
  const selectedConditionOption = conditions.find((condition) => condition.value === selectedCondition) || null;
  const normalizedGradeLevels = useMemo(() => Array.from(new Set(gradeLevels)).filter(Boolean), []);

  const visibleExistingPhotos = useMemo(
    () => existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id)),
    [existingPhotos, removedPhotoIds]
  );
  const totalVisiblePhotos = visibleExistingPhotos.length + newPhotos.length;

  useEffect(() => {
    if (!categoryEffectReadyRef.current) {
      categoryEffectReadyRef.current = true;
      return;
    }

    setSpecificType("");
    setSizeLabel("");
    setBrand("");
    setModel("");
    setSeason("");

    if (!isBookCategory(selectedCategory)) {
      setIsbn("");
      setAuthor("");
      setPublisher("");
      setFormat("");
      setLanguage("");
      setSubject("");
    }
  }, [selectedCategory]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardOffset = () => {
      const keyboardVisible = viewport.height < window.innerHeight * 0.8;
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(keyboardVisible ? overlap : 0);
    };

    updateKeyboardOffset();
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, []);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    setPhotoError("");
    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - totalVisiblePhotos;
    if (availableSlots <= 0) {
      setPhotoError(`Solo puedes tener un máximo de ${MAX_FILES} fotos.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const accepted: NewPhoto[] = [];
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

    if (accepted.length) setNewPhotos((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateForm = () => {
    if (totalVisiblePhotos === 0) return "Debes mantener al menos una foto real del material.";
    if (!title.trim()) return "Debes indicar un título.";
    if (!description.trim()) return "Debes añadir una descripción.";
    if (!selectedCategory) return "Debes seleccionar una categoría.";
    if (courseRequired && !selectedGradeLevel) return "Debes seleccionar un curso o etapa para libros y lecturas.";
    if (!selectedCondition) return "Debes seleccionar el estado del material.";
    if (showBookFields && !isValidIsbn(isbn)) return "El ISBN debe tener 10 o 13 caracteres válidos.";

    if (!isDonation) {
      const numericPrice = parsePrice(price);
      if (!price.trim() || Number.isNaN(numericPrice) || numericPrice <= 0) {
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

  const uploadNewPhotos = async () => {
    const supabase = createClient();
    const uploadedRows: { listing_id: string; url: string; sort_order: number }[] = [];
    const startingSortOrder = visibleExistingPhotos.length;

    for (let index = 0; index < newPhotos.length; index += 1) {
      const item = newPhotos[index];
      const safeName = sanitizeFileName(item.file.name);
      const fileExt = item.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${currentUserId}/${initialListing.id}/${Date.now()}-${index}-${safeName || `image.${fileExt}`}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, item.file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      if (!data?.publicUrl) throw new Error("No se pudo obtener la URL pública de una imagen.");

      uploadedRows.push({
        listing_id: initialListing.id,
        url: data.publicUrl,
        sort_order: startingSortOrder + index,
      });
    }

    return uploadedRows;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSubmitError("");
    setPhotoError("");

    try {
      const validationError = validateForm();
      if (validationError) {
        setSubmitError(validationError);
        return;
      }

      const supabase = createClient();
      const updatePayload = {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        grade_level: selectedGradeLevel || "Varios cursos",
        condition: selectedCondition,
        ...buildListingTypeColumns(isDonation ? "donation" : "sale"),
        isbn: showBookFields && isbn.trim() ? normalizeIsbn(isbn) : null,
        author: showBookFields && author.trim() ? author.trim() : null,
        publisher: showBookFields && publisher.trim() ? publisher.trim() : null,
        format: showBookFields && format ? format : null,
        language: showBookFields && language ? language : null,
        subject: showTextbookFields && subject.trim() ? subject.trim() : null,
        specific_type:
          (showUniformFields || showSupplyFields || showTechFields || showBagFields) && specificType.trim()
            ? specificType.trim()
            : null,
        size_label: showUniformFields && sizeLabel.trim() ? sizeLabel.trim() : null,
        brand: (showTechFields || showBagFields) && brand.trim() ? brand.trim() : null,
        model: showTechFields && model.trim() ? model.trim() : null,
        season: showUniformFields && season.trim() ? season.trim() : null,
        price: isDonation ? null : parsePrice(price),
        original_price: isDonation || !originalPrice.trim() ? null : parsePrice(originalPrice),
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", initialListing.id)
        .eq("seller_id", currentUserId);
      if (updateError) throw updateError;

      if (removedPhotoIds.length > 0) {
        const { error } = await supabase.from("listing_photos").delete().in("id", removedPhotoIds);
        if (error) throw error;
      }

      for (const [index, photo] of visibleExistingPhotos.entries()) {
        const { error } = await supabase
          .from("listing_photos")
          .update({ sort_order: index })
          .eq("id", photo.id)
          .eq("listing_id", initialListing.id);
        if (error) throw error;
      }

      const uploadedRows = await uploadNewPhotos();
      if (uploadedRows.length > 0) {
        const { error } = await supabase.from("listing_photos").insert(uploadedRows);
        if (error) throw error;
      }

      const photoUrls = [
        ...visibleExistingPhotos.map((photo) => photo.url),
        ...uploadedRows.map((photo) => photo.url),
      ];
      const { error: photoSyncError } = await supabase
        .from("listings")
        .update({ photos: photoUrls, updated_at: new Date().toISOString() })
        .eq("id", initialListing.id)
        .eq("seller_id", currentUserId);
      if (photoSyncError) throw photoSyncError;

      router.push(`/marketplace/listing/${initialListing.id}`);
      router.refresh();
    } catch (error: any) {
      setSubmitError(error?.message || error?.details || "No se pudo actualizar el anuncio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push(`/marketplace/listing/${initialListing.id}`)}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al anuncio
        </button>

        <div className="mb-5 sm:mb-7">
          <p className="text-sm font-medium text-primary">Editar anuncio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">Actualiza tu anuncio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Mantén la información clara y actualizada. Los detalles específicos se guardan como datos del anuncio, no dentro de la descripción.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />

          <SectionCard icon={<ImagePlus className="h-5 w-5" />} title="Fotos" description="Puedes mantener hasta 8 fotos. La primera será la principal.">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background p-5 text-center transition hover:bg-muted/40"
            >
              <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold">Añadir fotos</span>
            </button>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
              {existingPhotos.map((photo) => {
                const removed = removedPhotoIds.includes(photo.id);
                return (
                  <div key={photo.id} className={`relative aspect-square overflow-hidden rounded-2xl border bg-muted ${removed ? "opacity-40" : ""}`}>
                    <img src={photo.url} alt="Foto del anuncio" className="h-full w-full object-cover" />
                    {removed ? (
                      <button
                        type="button"
                        className="absolute inset-x-2 bottom-2 rounded-lg bg-background/95 px-2 py-1 text-xs font-medium"
                        onClick={() => setRemovedPhotoIds((current) => current.filter((id) => id !== photo.id))}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemovedPhotoIds((current) => [...current, photo.id])}
                        className="absolute right-1.5 top-1.5 rounded-full bg-background/95 p-1 shadow"
                        aria-label="Quitar foto"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {newPhotos.map((photo, index) => (
                <div key={photo.previewUrl} className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
                  <img src={photo.previewUrl} alt={photo.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setNewPhotos((current) => {
                        const target = current[index];
                        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                        return current.filter((_, itemIndex) => itemIndex !== index);
                      })
                    }
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/95 p-1 shadow"
                    aria-label="Quitar foto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {totalVisiblePhotos < MAX_FILES ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground"
                  aria-label="Añadir foto"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              ) : null}
            </div>
            {photoError ? <p className="mt-3 text-sm text-destructive">{photoError}</p> : null}
          </SectionCard>

          <SectionCard icon={<Package className="h-5 w-5" />} title="Información básica" description="Explica qué es y el estado real del material.">
            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-description">Descripción *</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  placeholder="Describe el estado, marcas de uso y cualquier detalle útil."
                />
                <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p>La descripción es solo tu texto. Asignatura, editorial, formato y otros datos se muestran aparte.</p>
                  <span className={description.trim().length >= 40 ? "shrink-0 font-medium text-emerald-600" : "shrink-0"}>
                    {Math.min(description.trim().length, 40)} / 40
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<BookOpen className="h-5 w-5" />} title="Categoría y detalles" description="Los campos cambian según el tipo de material.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Categoría *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Curso / Etapa {courseRequired ? "*" : "(opcional)"}</Label>
                <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={courseRequired ? "Seleccionar curso" : "Varios cursos"} /></SelectTrigger>
                  <SelectContent>{normalizedGradeLevels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Estado *</Label>
                <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                  <SelectTrigger className="h-11 w-full min-w-0">
                    <span className="min-w-0 flex-1 truncate text-left">
                      {selectedConditionOption?.label || "Seleccionar estado"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="w-[min(360px,calc(100vw-2rem))]">
                    {conditions.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value} textValue={condition.label}>
                        <div className="flex flex-col gap-0.5 py-0.5">
                          <span className="font-medium">{condition.label}</span>
                          <span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">{condition.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedConditionOption ? <p className="text-xs leading-relaxed text-muted-foreground">{selectedConditionOption.description}</p> : null}
              </div>
            </div>

            {selectedCategory ? (
              <div className="mt-5 rounded-2xl bg-muted/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Detalles recomendados para {selectedCategory}
                </div>

                {showBookFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {showTextbookFields ? (
                      <div className="flex flex-col gap-2"><Label htmlFor="edit-subject">Asignatura</Label><Input id="edit-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11" placeholder="Ej: Lengua, Matemáticas" /></div>
                    ) : null}
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-isbn">ISBN</Label><Input id="edit-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} className="h-11" inputMode="numeric" placeholder="Opcional, 10 o 13 dígitos" /></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-author">Autor</Label><Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} className="h-11" placeholder="Opcional" /></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-publisher">Editorial</Label><Input id="edit-publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} className="h-11" placeholder="Ej: Santillana, SM, Oxford" /></div>
                    <div className="flex flex-col gap-2"><Label>Formato</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{bookFormats.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label>Idioma</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{bookLanguages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                ) : null}

                {showUniformFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Prenda</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{UNIFORM_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-size">Talla</Label><Input id="edit-size" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} className="h-11" /></div>
                    <div className="flex flex-col gap-2 sm:col-span-2"><Label>Temporada</Label><Select value={season} onValueChange={setSeason}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{UNIFORM_SEASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                ) : null}

                {showSupplyFields ? (
                  <div className="flex flex-col gap-2"><Label>Tipo de material</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{SCHOOL_SUPPLIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                ) : null}

                {showTechFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Tipo</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{TECH_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-brand">Marca</Label><Input id="edit-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11" /></div>
                    <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="edit-model">Modelo</Label><Input id="edit-model" value={model} onChange={(e) => setModel(e.target.value)} className="h-11" /></div>
                  </div>
                ) : null}

                {showBagFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Tipo</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{BAG_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="edit-bag-brand">Marca</Label><Input id="edit-bag-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11" /></div>
                  </div>
                ) : null}

                {!showBookFields && !showUniformFields && !showSupplyFields && !showTechFields && !showBagFields ? (
                  <p className="text-sm text-muted-foreground">Usa la descripción para los detalles que no necesitan un campo específico.</p>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard icon={<Tag className="h-5 w-5" />} title="Precio o donación" description="Elige si el material se vende o se dona.">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1.5">
              <button type="button" onClick={() => setIsDonation(false)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${!isDonation ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Venta</button>
              <button type="button" onClick={() => setIsDonation(true)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${isDonation ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Donación</button>
            </div>

            {!isDonation ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-price">Precio de venta *</Label>
                  <div className="relative">
                    <Input id="edit-price" type="text" inputMode="decimal" enterKeyHint="done" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 pr-9" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-original-price">Precio original</Label>
                  <div className="relative">
                    <Input id="edit-original-price" type="text" inputMode="decimal" enterKeyHint="done" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} className="h-11 pr-9" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                Este anuncio aparecerá como donación. La entrega se acuerda directamente por chat.
              </div>
            )}
          </SectionCard>

          <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><School className="h-4 w-4 text-primary" />Centro asociado</div>
            <p>{initialSchoolLabel}</p>
          </div>

          {submitError ? <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{submitError}</div> : null}

          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
            style={keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined}
          >
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" className="min-h-12" disabled={saving} onClick={() => router.push(`/marketplace/listing/${initialListing.id}`)}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-12 sm:px-8" disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
