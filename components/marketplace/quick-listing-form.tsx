'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { categories, gradeLevels, conditions } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, X } from 'lucide-react';

export type QuickListingInitialValues = {
  title?: string;
  description?: string;
  category?: string;
  grade_level?: string;
  condition?: string;
  listing_type?: string;
  price?: string;
  original_price?: string;
  isbn?: string;
  source?: string;
};

type PhotoFile = {
  file: File;
  previewUrl: string;
};

const STORAGE_BUCKET = 'listing-photos';
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9xX]/g, '').toUpperCase();
}

function isValidIsbn(value: string) {
  if (!value) return true;
  return /^(?:\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(value));
}

export default function QuickListingForm({
  initialSchoolId,
  initialValues,
}: {
  initialSchoolId: string | null;
  initialValues: QuickListingInitialValues;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [values, setValues] = useState({
    title: initialValues.title || '',
    description: initialValues.description || '',
    category: initialValues.category || '',
    grade_level: initialValues.grade_level || '',
    condition: initialValues.condition || 'good',
    listing_type: initialValues.listing_type === 'donation' ? 'donation' : 'sale',
    price: initialValues.price || '',
    original_price: initialValues.original_price || '',
    isbn: initialValues.isbn || '',
  });

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  const isDonation = values.listing_type === 'donation';

  function setField(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validateSelectedFiles(files: File[]) {
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return 'Solo puedes subir imágenes JPG, PNG, WEBP o GIF.';
      }

      if (file.size > MAX_FILE_SIZE) {
        return 'Cada imagen debe pesar menos de 10 MB.';
      }
    }

    return null;
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    setPhotoError(null);

    if (selectedFiles.length === 0) return;

    const availableSlots = MAX_FILES - photos.length;
    if (availableSlots <= 0) {
      setPhotoError('Solo puedes subir hasta 5 fotos.');
      event.target.value = '';
      return;
    }

    const validationError = validateSelectedFiles(selectedFiles);
    if (validationError) {
      setPhotoError(validationError);
      event.target.value = '';
      return;
    }

    const nextFiles = selectedFiles.slice(0, availableSlots).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...current, ...nextFiles]);

    if (selectedFiles.length > availableSlots) {
      setPhotoError(`Se han añadido ${availableSlots} fotos. El máximo es ${MAX_FILES}.`);
    }

    event.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function uploadPhotos(userId: string) {
    const supabase = createClient();
    const uploadedPhotos: { url: string; sort_order: number }[] = [];
    const uploadPrefix = `quick/${userId}/${Date.now()}`;

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const fileExt = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeName = sanitizeFileName(photo.file.name) || `image.${fileExt}`;
      const filePath = `${uploadPrefix}/${index}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, photo.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        throw new Error('No se pudo obtener la URL pública de una de las fotos.');
      }

      uploadedPhotos.push({
        url: publicUrl,
        sort_order: index,
      });
    }

    return uploadedPhotos;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPhotoError(null);
    setLoading(true);

    try {
      if (!values.title.trim()) throw new Error('Indica un título.');
      if (!values.description.trim()) throw new Error('Añade una descripción.');
      if (!values.category) throw new Error('Selecciona una categoría.');
      if (!values.grade_level) throw new Error('Selecciona curso o etapa.');
      if (!values.condition) throw new Error('Selecciona estado.');
      if (!isDonation && !values.price.trim()) throw new Error('Indica precio.');
      if (values.isbn.trim() && !isValidIsbn(values.isbn)) throw new Error('El ISBN debe tener 10 o 13 caracteres válidos.');
      if (photos.length === 0) throw new Error('Añade al menos una foto real del producto. Es obligatorio para generar confianza.');

      const numericPrice = Number(values.price);
      const numericOriginalPrice = values.original_price.trim() ? Number(values.original_price) : null;

      if (!isDonation && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
        throw new Error('El precio debe ser un número válido.');
      }

      if (!isDonation && numericOriginalPrice !== null && (!Number.isFinite(numericOriginalPrice) || numericOriginalPrice < 0)) {
        throw new Error('El precio original debe ser un número válido.');
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign('/auth?next=/marketplace/new/quick');
        return;
      }

      await fetch('/api/seller/velocity/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'quick_publish_started',
          metadata: {
            source: initialValues.source || 'quick_form',
            photos_count: photos.length,
          },
        }),
      }).catch(() => null);

      const uploadedPhotos = await uploadPhotos(user.id);

      if (uploadedPhotos.length === 0) {
        throw new Error('No se pudo subir la foto. Inténtalo de nuevo.');
      }

      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        grade_level: values.grade_level,
        condition: values.condition,
        type: isDonation ? 'donation' : 'sale',
        listing_type: isDonation ? 'donation' : 'sale',
        isbn: values.isbn.trim() ? normalizeIsbn(values.isbn) : null,
        price: isDonation ? null : numericPrice,
        original_price: isDonation || numericOriginalPrice === null ? null : numericOriginalPrice,
        seller_id: user.id,
        school_id: initialSchoolId,
        status: 'available',
      };

      const { data, error: insertError } = await supabase
        .from('listings')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!data?.id) throw new Error('No se pudo crear el anuncio.');

      const { error: photosInsertError } = await supabase
        .from('listing_photos')
        .insert(
          uploadedPhotos.map((photo) => ({
            listing_id: data.id,
            url: photo.url,
            sort_order: photo.sort_order,
          }))
        );

      if (photosInsertError) {
        await supabase.from('listings').delete().eq('id', data.id).catch(() => null);
        throw photosInsertError;
      }

      await fetch('/api/listings/notify-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: data.id }),
      }).catch(() => null);

      await fetch('/api/seller/velocity/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'quick_publish_completed',
          metadata: {
            listing_id: data.id,
            source: initialValues.source || 'quick_form',
            photos_count: uploadedPhotos.length,
          },
        }),
      }).catch(() => null);

      router.push(`/marketplace/listing/${data.id}?published=1&quick=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-card p-5 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      <div className="mb-5 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Label>Fotos obligatorias</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Añade al menos una foto real. En móvil puedes abrir la cámara directamente. Los anuncios sin foto no se publican.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Añadir fotos
          </Button>
        </div>

        {photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={photo.previewUrl} className="relative overflow-hidden rounded-2xl border bg-background">
                <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="h-32 w-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full"
                  onClick={() => removePhoto(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                {index === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium">
                    Principal
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {photoError ? <p className="mt-3 text-sm text-amber-700">{photoError}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Título</Label>
          <Input value={values.title} onChange={(e) => setField('title', e.target.value)} placeholder="Ej. Libro Matemáticas 3 ESO" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Descripción</Label>
          <Textarea value={values.description} onChange={(e) => setField('description', e.target.value)} rows={4} />
        </div>

        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={values.category} onValueChange={(value) => setField('category', value)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Curso / etapa</Label>
          <Select value={values.grade_level} onValueChange={(value) => setField('grade_level', value)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {Array.from(new Set(gradeLevels)).filter(Boolean).map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={values.condition} onValueChange={(value) => setField('condition', value)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {conditions.map((condition) => (
                <SelectItem key={condition.value} value={condition.value}>{condition.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={values.listing_type} onValueChange={(value) => setField('listing_type', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">Venta</SelectItem>
              <SelectItem value="donation">Donación</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isDonation ? (
          <>
            <div className="space-y-2">
              <Label>Precio</Label>
              <Input value={values.price} onChange={(e) => setField('price', e.target.value)} placeholder="10" inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Precio original</Label>
              <Input value={values.original_price} onChange={(e) => setField('original_price', e.target.value)} placeholder="35" inputMode="decimal" />
            </div>
          </>
        ) : null}

        <div className="space-y-2 sm:col-span-2">
          <Label>ISBN opcional</Label>
          <Input value={values.isbn} onChange={(e) => setField('isbn', e.target.value)} placeholder="978..." />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Publicando con fotos...' : 'Publicar rápido'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/marketplace/new')}>
          Usar formulario completo
        </Button>
      </div>
    </form>
  );
}
