import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NationalSchoolDirectory } from "@/components/schools/national-school-directory";

export const dynamic="force-dynamic";
export const metadata: Metadata={
  title:"Directorio informativo de centros educativos",
  description:"Búsqueda informativa de centros educativos incluidos mediante aprobación editorial.",
  robots:{index:false,follow:false},
};

export default function SchoolDirectoryPage() {
  // Listing records are imported but none is authorized for public listing yet.
  // Both the HTML page and its API remain independently gated.
  if(process.env.WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED!=="true")notFound();
  return <NationalSchoolDirectory/>;
}
