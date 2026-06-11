export type MaterialSeoPage = {
  slug: string;
  title: string;
  heading: string;
  description: string;
  category?: string;
  bullets: string[];
};

export const MATERIAL_SEO_PAGES: MaterialSeoPage[] = [
  {
    slug: "libros-texto-segunda-mano",
    title: "Libros de texto de segunda mano | Wetudy",
    heading: "Libros de texto de segunda mano",
    description: "Encuentra y publica libros de texto reutilizados para ahorrar en la vuelta al curso.",
    category: "Libros de texto",
    bullets: ["Busca por curso e ISBN", "Compara precios", "Publica libros que ya no usas"],
  },
  {
    slug: "uniformes-escolares-segunda-mano",
    title: "Uniformes escolares de segunda mano | Wetudy",
    heading: "Uniformes escolares de segunda mano",
    description: "Compra, vende o dona uniformes escolares que todavía pueden tener mucha vida útil.",
    category: "Uniformes",
    bullets: ["Aprovecha prendas en buen estado", "Reduce gasto familiar", "Acuerda entrega por chat"],
  },
  {
    slug: "calculadoras-cientificas-segunda-mano",
    title: "Calculadoras científicas de segunda mano | Wetudy",
    heading: "Calculadoras científicas de segunda mano",
    description: "Encuentra calculadoras científicas y material tecnológico educativo reutilizado.",
    category: "Calculadoras",
    bullets: ["Busca por modelo o curso", "Pregunta antes de comprar", "Publica calculadoras que ya no usas"],
  },
  {
    slug: "material-escolar-segunda-mano",
    title: "Material escolar de segunda mano | Wetudy",
    heading: "Material escolar de segunda mano",
    description: "Compra, vende y dona material escolar reutilizado entre familias, estudiantes y negocios locales.",
    category: "Material escolar",
    bullets: ["Mochilas, estuches y material", "Ahorra antes de comprar nuevo", "Da salida a lo que tienes guardado"],
  },
];
