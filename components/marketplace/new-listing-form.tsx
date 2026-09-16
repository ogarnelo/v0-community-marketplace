"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
const FALLBACK_GRADE_LEVEL = "Varios cursos";

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
  author: string | null;
  publisher: string | null;
  format: string | null;
  language: string | null;
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

function normalizedCategory(category: string) {
  return category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

function parsePrice(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return NaN;
  return Number(normalized);
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

export default function NewListingForm({ initialSchoolId, initialSchoolName, initialSchoolCity }: NewListingFormProps) {
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
  const [format, setFormat] = useState("");
  const [language, setLanguage] = useState("");
  const [subject, setSubject] = useState("");
  const [specificType, setSpecificType] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [season, setSeason] = useState("");
  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const showBookFields = isBookCategory(selectedCategory);
  const showTextbookFields = isTextbookCategory(selectedCategory);
  const showUniformFields = isUniformCategory(selectedCategory);
  const showSupplyFields = isSupplyCategory(selectedCategory);
  const showTechFields = isTechCategory(selectedCategory);
  const showBagFields = isBagCategory(selectedCategory);
  const courseRequired = isCourseRequired(selectedCategory);

  useEffect(() => {
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

  const schoolLabel = useMemo(() => {
    if (!initialSchoolId) return "Sin centro asignado";
    if (initialSchoolCity?.trim()) return `${initialSchoolName}, ${initialSchoolCity}`;
    return initialSchoolName;
  }, [initialSchoolCity, initialSchoolId, initialSchoolName]);

  const normalizedGradeLevels = useMemo(() => Array.from(new Set(gradeLevels)).filter(Boolean), []);

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    setPhotoError("");
    setSubmitError("");
    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - photos.length;
    if (availableSlots <= 0) {
      setPhotoError(`Solo puedes subir un máximo de ${MAX_FILES} fotos.`);
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

    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted]);
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
    if (courseRequired && !selectedGradeLevel) return "Debes seleccionar un curso o etapa para libros y lecturas.";
    if (!selectedCondition) return "Debes seleccionar el estado del material.";
    if (showBookFields && !isValidIsbn(isbn)) return "El ISBN debe tener 10 o 13 caracteres válidos.";

    if (!isDonation) {
      if (!price.trim()) return "Debes indicar un precio para la venta.";
      const numericPrice = parsePrice(price);
      if (Number.isNaN(numericPrice) || numericPrice <= 0) return "El precio debe ser un número válido mayor que 0.";
      if (originalPrice.trim()) {
        const numericOriginalPrice = parsePrice(originalPrice);
        if (Number.isNaN(numericOriginalPrice) || numericOriginalPrice < 0) return "El precio original debe ser un número válido.";
      }
    }

    return null;
  };

  const buildDescription = () => {
    const details: string[] = [];
    if (showTextbookFields && subject.trim()) details.push(`Asignatura: ${subject.trim()}`);
    if ((showUniformFields || showSupplyFields || showTechFields || showBagFields) && specificType.trim()) details.push(`Tipo: ${specificType.trim()}`);
    if (showUniformFields && sizeLabel.trim()) details.push(`Talla: ${sizeLabel.trim()}`);
    if (showUniformFields && season.trim()) details.push(`Temporada: ${season.trim()}`);
    if ((showTechFields || showBagFields) && brand.trim()) details.push(`Marca: ${brand.trim()}`);
    if (showTechFields && model.trim()) details.push(`Modelo: ${model.trim()}`);

    if (details.length === 0) return description.trim();
    return `${description.trim()}\n\nDetalles del material:\n${details.map((detail) => `- ${detail}`).join("\n")}`;
  };

  const uploadListingPhotos = async (listingId: string, files: PreviewFile[]) => {
    const supabase = createClient();
    const uploadedPhotoRows: ListingPhotoInsertPayload[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index].file;
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = sanitizeFileName(file.name);
      const filePath = `${listingId}/${Date.now()}-${index}-${safeName || `image.${fileExt}`}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, { cacheControl: "3600", upsert: false });
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/auth?next=/marketplace/new");
        return;
      }

      const { data: currentProfile, error: profileError } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;

      const effectiveSchoolId = currentProfile?.school_id && currentProfile.school_id.trim().length > 0 ? currentProfile.school_id : initialSchoolId || null;
      const listingId = crypto.randomUUID();
      const uploadedPhotoRows = await uploadListingPhotos(listingId, photos);
      const photoUrls = uploadedPhotoRows.map((photo) => photo.url);
      if (photoUrls.length === 0) throw new Error("Debes añadir al menos una foto real del material.");

      const payload: ListingInsertPayload = {
        id: listingId,
        title: title.trim(),
        description: buildDescription(),
        category: selectedCategory,
        grade_level: selectedGradeLevel || FALLBACK_GRADE_LEVEL,
        condition: selectedCondition,
        type: isDonation ? "donation" : "sale",
        listing_type: isDonation ? "donation" : "sale",
        isbn: showBookFields && isbn.trim() ? normalizeIsbn(isbn) : null,
        author: showBookFields && author.trim() ? author.trim() : null,
        publisher: showBookFields && publisher.trim() ? publisher.trim() : null,
        format: showBookFields && format ? format : null,
        language: showBookFields && language ? language : null,
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

      await fetch("/api/marketplace/listings/match-saved-searches", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ listingId }),
}).catch((matchError) => {
  console.error("No se pudieron procesar los avisos guardados", matchError);
});
      router.push(`/marketplace/listing/${listingId}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error publicando anuncio:", error);
      setSubmitError(error?.message || error?.details || error?.error_description || "No se pudo publicar el anuncio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
        <Link href="/marketplace" className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver al marketplace
        </Link>

        <div className="mb-5 sm:mb-7">
          <p className="text-sm font-medium text-primary">Nuevo anuncio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">Sube tu anuncio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Completa lo imprescindible y Wetudy adaptará los detalles según la categoría. Sin pagos ni envíos integrados por ahora.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" multiple className="hidden" onChange={handleFilesSelected} />

          <SectionCard icon={<ImagePlus className="h-5 w-5" />} title="Fotos" description="Sube hasta 8 fotos. La primera será la principal y es obligatoria.">
            <button type="button" onClick={handlePickPhoto} className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background p-5 text-center transition hover:bg-muted/40 sm:min-h-44">
              <ImagePlus className="mb-2 h-9 w-9 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Añadir fotos del material</span>
              <span className="mt-1 text-xs leading-relaxed text-muted-foreground">JPG, PNG, WEBP o GIF. Máximo 10 MB por imagen.</span>
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
              {Array.from({ length: MAX_FILES }).map((_, index) => {
                const photo = photos[index];
                return photo ? (
                  <div key={photo.previewUrl} className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
                    <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                    {index === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">Principal</span> : null}
                    <button type="button" onClick={() => handleRemovePhoto(index)} className="absolute right-1.5 top-1.5 rounded-full bg-background/95 p-1 shadow" aria-label="Quitar foto"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button key={`empty-${index}`} type="button" onClick={handlePickPhoto} className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground transition hover:bg-muted/40" aria-label={`Añadir foto ${index + 1}`}>
                    <ImagePlus className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            {photoError && <p className="mt-3 text-sm text-destructive">{photoError}</p>}
          </SectionCard>

          <SectionCard icon={<Package className="h-5 w-5" />} title="Información básica" description="Explica qué es y el estado real del material.">
            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Libro Matemáticas 3.º ESO" className="h-11" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el estado, editorial, edición, marcas de uso..." rows={5} />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<BookOpen className="h-5 w-5" />} title="Categoría y detalles" description="Los campos cambian según lo que selecciones.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Categoría *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Curso / Etapa {courseRequired ? "*" : "(opcional)"}</Label>
                <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={courseRequired ? "Seleccionar curso" : "Varios cursos"} /></SelectTrigger>
                  <SelectContent>{normalizedGradeLevels.map((gradeLevel) => <SelectItem key={gradeLevel} value={gradeLevel}>{gradeLevel}</SelectItem>)}</SelectContent>
                </Select>
                {!courseRequired ? <p className="text-xs leading-relaxed text-muted-foreground">Para mochilas, tecnología, uniformes y otros materiales puede servir a varios cursos.</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Estado *</Label>
                <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                  <SelectContent className="w-[min(360px,calc(100vw-2rem))]">
                    {conditions.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value} textValue={condition.label}>
                        <div className="flex flex-col gap-0.5 py-0.5"><span className="font-medium">{condition.label}</span><span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">{condition.description}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCategory ? (
              <div className="mt-5 rounded-2xl bg-muted/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" />Detalles recomendados para {selectedCategory}</div>

                {showBookFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {showTextbookFields ? <div className="flex flex-col gap-2"><Label htmlFor="subject">Asignatura</Label><Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Lengua, Matemáticas" className="h-11" /></div> : null}
                    <div className="flex flex-col gap-2"><Label htmlFor="isbn">ISBN</Label><Input id="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="Opcional, 10 o 13 dígitos" className="h-11" inputMode="numeric" /></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="author">Autor</Label><Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Opcional" className="h-11" /></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="publisher">Editorial</Label><Input id="publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Ej: Santillana, SM, Oxford" className="h-11" /></div>
                    <div className="flex flex-col gap-2"><Label>Formato</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{bookFormats.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label>Idioma</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{bookLanguages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                ) : null}

                {showUniformFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Prenda</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{UNIFORM_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="size-label">Talla</Label><Input id="size-label" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} placeholder="Ej: 8, 10, M" className="h-11" /></div>
                    <div className="flex flex-col gap-2 sm:col-span-2"><Label>Temporada</Label><Select value={season} onValueChange={setSeason}><SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{UNIFORM_SEASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                ) : null}

                {showSupplyFields ? <div className="flex flex-col gap-2"><Label>Tipo de material</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{SCHOOL_SUPPLIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div> : null}

                {showTechFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Tipo</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{TECH_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="brand">Marca</Label><Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej: Casio, Apple" className="h-11" /></div>
                    <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="model">Modelo</Label><Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej: FX-991SP X II" className="h-11" /></div>
                  </div>
                ) : null}

                {showBagFields ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2"><Label>Tipo</Label><Select value={specificType} onValueChange={setSpecificType}><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{BAG_ITEMS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex flex-col gap-2"><Label htmlFor="bag-brand">Marca</Label><Input id="bag-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opcional" className="h-11" /></div>
                  </div>
                ) : null}

                {!showBookFields && !showUniformFields && !showSupplyFields && !showTechFields && !showBagFields ? <p className="text-sm leading-relaxed text-muted-foreground">Usa la descripción para añadir los datos importantes. Evitamos pedir campos innecesarios para publicar más rápido.</p> : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard icon={<Tag className="h-5 w-5" />} title="Precio o donación" description="Elige si quieres vender el material o donarlo. El pago se acuerda directamente por chat.">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1.5">
              <button type="button" onClick={() => setIsDonation(false)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${!isDonation ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Venta</button>
              <button type="button" onClick={() => setIsDonation(true)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${isDonation ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Donación</button>
            </div>

            {!isDonation ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor="price">Precio de venta *</Label><div className="relative"><Input id="price" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej: 12" className="h-11 pr-9" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span></div></div>
                <div className="flex flex-col gap-2"><Label htmlFor="original-price">Precio original</Label><div className="relative"><Input id="original-price" type="text" inputMode="decimal" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="Opcional" className="h-11 pr-9" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span></div></div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">Este anuncio aparecerá como donación. Wetudy facilita el contacto y conserva el historial del acuerdo.</div>
            )}
          </SectionCard>

          <div className="rounded-2xl border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><School className="h-4 w-4 text-primary" />Centro asociado</div>
            <p>{schoolLabel}</p>
            <p className="mt-3">La entrega y el pago se acuerdan directamente entre las partes.</p>
          </div>

          {submitError && <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{submitError}</div>}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-3xl gap-3">
              <Button type="submit" disabled={loading} className="min-h-12 flex-1 text-base sm:flex-none sm:px-8">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publicando...</> : "Publicar anuncio"}
              </Button>
              <Link href="/marketplace" className="hidden sm:block"><Button type="button" variant="outline" className="min-h-12">Cancelar</Button></Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
