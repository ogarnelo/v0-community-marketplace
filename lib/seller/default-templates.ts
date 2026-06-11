export type SellerTemplate = {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  grade_level?: string;
  condition: string;
  listing_type: 'sale' | 'donation';
  price?: number | null;
  original_price?: number | null;
  isbn?: string | null;
  badge?: string;
};

export const DEFAULT_SELLER_TEMPLATES: SellerTemplate[] = [
  {
    id: 'textbook',
    name: 'Libro de texto',
    title: 'Libro de texto en buen estado',
    description: 'Libro usado en buen estado. Indica editorial, edición, ISBN y si tiene subrayados.',
    category: 'Libros de texto',
    condition: 'good',
    listing_type: 'sale',
    price: 10,
    original_price: 35,
    badge: 'Alta rotación',
  },
  {
    id: 'calculator',
    name: 'Calculadora científica',
    title: 'Calculadora científica',
    description: 'Calculadora científica funcionando correctamente. Incluye modelo, estado y si lleva funda.',
    category: 'Calculadoras',
    condition: 'good',
    listing_type: 'sale',
    price: 15,
    original_price: 30,
    badge: 'Muy buscado',
  },
  {
    id: 'uniform',
    name: 'Uniforme escolar',
    title: 'Uniforme escolar en buen estado',
    description: 'Prenda de uniforme en buen estado. Indica talla, colegio si aplica, medidas y posibles marcas de uso.',
    category: 'Uniformes',
    condition: 'good',
    listing_type: 'sale',
    price: 8,
    original_price: 25,
    badge: 'Ahorro familiar',
  },
  {
    id: 'school-material',
    name: 'Material escolar',
    title: 'Material escolar reutilizable',
    description: 'Material escolar con vida útil. Indica cantidad, estado y si se vende en lote.',
    category: 'Material escolar',
    condition: 'good',
    listing_type: 'sale',
    price: 5,
    original_price: 15,
    badge: 'Rápido de publicar',
  },
  {
    id: 'donation',
    name: 'Donación',
    title: 'Material educativo para donar',
    description: 'Material educativo que puede ayudar a otra familia. Indica estado, curso y condiciones de recogida.',
    category: 'Material escolar',
    condition: 'fair',
    listing_type: 'donation',
    price: null,
    original_price: null,
    badge: 'Impacto social',
  },
];

export function templateToSearchParams(template: Partial<SellerTemplate>) {
  const params = new URLSearchParams();
  if (template.title) params.set('title', template.title);
  if (template.description) params.set('description', template.description);
  if (template.category) params.set('category', template.category);
  if (template.grade_level) params.set('grade_level', template.grade_level);
  if (template.condition) params.set('condition', template.condition);
  if (template.listing_type) params.set('listing_type', template.listing_type);
  if (template.price !== null && template.price !== undefined) params.set('price', String(template.price));
  if (template.original_price !== null && template.original_price !== undefined) params.set('original_price', String(template.original_price));
  if (template.isbn) params.set('isbn', template.isbn);
  params.set('source', 'seller_velocity');
  return params.toString();
}
