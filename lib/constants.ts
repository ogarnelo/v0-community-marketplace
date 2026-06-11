export type UserRole = "parent" | "student" | "school_admin" | "super_admin" | "business";
export type ListingType = "sale" | "donation";
export type ListingStatus = "available" | "reserved" | "sold" | "archived";
export type ItemCondition = "new_with_tags" | "new_without_tags" | "very_good" | "good" | "satisfactory";

export interface ConditionOption {
  value: ItemCondition;
  label: string;
  description: string;
}

export const categories = [
  "Libros de texto",
  "Material escolar",
  "Mochilas y estuches",
  "Uniformes",
  "Tecnología",
  "Instrumentos musicales",
  "Material deportivo",
  "Otros",
] as const;

export const gradeLevels = [
  "Infantil",
  "1º Primaria",
  "2º Primaria",
  "3º Primaria",
  "4º Primaria",
  "5º Primaria",
  "6º Primaria",
  "1º ESO",
  "2º ESO",
  "3º ESO",
  "4º ESO",
  "1º Bachillerato",
  "2º Bachillerato",
  "Universidad",
  "Otros",
] as const;

export const conditions: ConditionOption[] = [
  {
    value: "new_with_tags",
    label: "Nuevo con etiquetas",
    description: "Articulo sin estrenar que todavia tiene las etiquetas o esta en su embalaje original.",
  },
  {
    value: "new_without_tags",
    label: "Nuevo sin etiquetas",
    description: "Articulo sin estrenar que no tiene las etiquetas o el embalaje original.",
  },
  {
    value: "very_good",
    label: "Muy bueno",
    description: "Articulo poco usado que puede tener algun defecto menor.",
  },
  {
    value: "good",
    label: "Bueno",
    description: "Articulo usado que puede tener defectos o estar desgastado.",
  },
  {
    value: "satisfactory",
    label: "Satisfactorio",
    description: "Articulo bastante usado con defectos o desgaste.",
  },
];

export const conditionLabels: Record<ItemCondition, string> = {
  new_with_tags: "Nuevo con etiquetas",
  new_without_tags: "Nuevo sin etiquetas",
  very_good: "Muy bueno",
  good: "Bueno",
  satisfactory: "Satisfactorio",
};

export const bookFormats = [
  "Tapa blanda",
  "Tapa dura",
  "De bolsillo",
  "Braille",
  "Audiolibro",
  "Otros",
] as const;

export const bookLanguages = [
  "Espanol",
  "Ingles",
  "Frances",
  "Aleman",
  "Italiano",
  "Portugues",
  "Catalan",
  "Euskera",
  "Gallego",
  "Valenciano",
  "Arabe",
  "Chino",
  "Japones",
  "Ruso",
  "Hindi",
] as const;
