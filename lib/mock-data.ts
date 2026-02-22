// Mock data for Wetudy MVP - prepared for future Supabase integration

export type UserRole = "parent" | "student" | "school_admin" | "super_admin"
export type ListingType = "sale" | "donation"
export type ListingStatus = "active" | "reserved" | "completed" | "archived"
export type ItemCondition = "new_with_tags" | "new_without_tags" | "very_good" | "good" | "satisfactory"

export interface ConditionOption {
  value: ItemCondition
  label: string
  description: string
}
export type DonationRequestStatus = "pending" | "approved" | "rejected" | "reassigned"

export interface School {
  id: string
  name: string
  code: string
  type: "colegio" | "instituto" | "universidad"
  city: string
  lat: number
  lng: number
  memberCount: number
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  schoolId: string
  avatarUrl?: string
  rating: number
  reviewCount: number
  createdAt: string
}

export interface Listing {
  id: string
  title: string
  description: string
  category: string
  gradeLevel: string
  condition: ItemCondition
  type: ListingType
  price?: number
  originalPrice?: number
  photos: string[]
  sellerId: string
  schoolId: string
  status: ListingStatus
  createdAt: string
  distance?: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  text: string
  timestamp: string
}

export interface Conversation {
  id: string
  listingId: string
  participants: string[]
  lastMessage: string
  lastMessageAt: string
  unread: number
}

export interface Review {
  id: string
  listingId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
  createdAt: string
}

export interface DonationRequest {
  id: string
  listingId: string
  requesterId: string
  status: DonationRequestStatus
  message: string
  createdAt: string
}

// --- Mock Schools ---
export const schools: School[] = [
  { id: "s1", name: "CEIP San Miguel", code: "SANMIGUEL23", type: "colegio", city: "Madrid", lat: 40.4168, lng: -3.7038, memberCount: 234 },
  { id: "s2", name: "IES Cervantes", code: "CERVANTES24", type: "instituto", city: "Madrid", lat: 40.42, lng: -3.71, memberCount: 189 },
  { id: "s3", name: "Universidad Complutense", code: "UCM2024", type: "universidad", city: "Madrid", lat: 40.45, lng: -3.73, memberCount: 1205 },
  { id: "s4", name: "Colegio La Salle", code: "LASALLE24", type: "colegio", city: "Barcelona", lat: 41.39, lng: 2.17, memberCount: 312 },
]

// --- Mock Users ---
export const users: User[] = [
  { id: "u1", name: "Ana Garcia", email: "ana@example.com", role: "parent", schoolId: "s1", rating: 4.8, reviewCount: 12, createdAt: "2025-09-01" },
  { id: "u2", name: "Carlos Lopez", email: "carlos@example.com", role: "parent", schoolId: "s1", rating: 4.5, reviewCount: 8, createdAt: "2025-09-15" },
  { id: "u3", name: "Maria Fernandez", email: "maria@example.com", role: "student", schoolId: "s3", rating: 4.9, reviewCount: 5, createdAt: "2025-10-01" },
  { id: "u4", name: "Pedro Martinez", email: "pedro@example.com", role: "school_admin", schoolId: "s1", rating: 5.0, reviewCount: 3, createdAt: "2025-08-20" },
  { id: "u5", name: "Laura Ruiz", email: "laura@example.com", role: "parent", schoolId: "s2", rating: 4.2, reviewCount: 6, createdAt: "2025-10-10" },
  { id: "u6", name: "Admin Wetudy", email: "admin@wetudy.com", role: "super_admin", schoolId: "s1", rating: 5.0, reviewCount: 0, createdAt: "2025-01-01" },
]

// --- Mock Categories ---
export const categories = [
  "Libros de texto",
  "Material escolar",
  "Mochilas y estuches",
  "Uniformes",
  "Tecnologia",
  "Instrumentos musicales",
  "Material deportivo",
  "Otros",
]

export const gradeLevels = [
  "Infantil",
  "1o Primaria",
  "2o Primaria",
  "3o Primaria",
  "4o Primaria",
  "5o Primaria",
  "6o Primaria",
  "1o ESO",
  "2o ESO",
  "3o ESO",
  "4o ESO",
  "1o Bachillerato",
  "2o Bachillerato",
  "Universidad",
]

export const conditions: ConditionOption[] = [
  { value: "new_with_tags", label: "Nuevo con etiquetas", description: "Articulo sin estrenar que todavia tiene las etiquetas o esta en su embalaje original." },
  { value: "new_without_tags", label: "Nuevo sin etiquetas", description: "Articulo sin estrenar que no tiene las etiquetas o el embalaje original." },
  { value: "very_good", label: "Muy bueno", description: "Articulo poco usado que puede tener algun defecto menor." },
  { value: "good", label: "Bueno", description: "Articulo usado que puede tener defectos o estar desgastado." },
  { value: "satisfactory", label: "Satisfactorio", description: "Articulo bastante usado con defectos o desgaste." },
]

export const conditionLabels: Record<ItemCondition, string> = {
  new_with_tags: "Nuevo con etiquetas",
  new_without_tags: "Nuevo sin etiquetas",
  very_good: "Muy bueno",
  good: "Bueno",
  satisfactory: "Satisfactorio",
}

export const bookFormats = [
  "Tapa blanda",
  "Tapa dura",
  "De bolsillo",
  "Braille",
  "Audiolibro",
  "Otros",
]

export const bookLanguages = [
  "Espanol", "Ingles", "Frances", "Aleman", "Italiano", "Portugues",
  "Catalan", "Euskera", "Gallego", "Valenciano", "Arabe", "Chino", "Japones", "Ruso", "Hindi",
]

// --- Mock Listings ---
export const listings: Listing[] = [
  {
    id: "l1", title: "Matematicas 3o ESO - SM", description: "Libro de matematicas Savia de SM para 3o de la ESO. Buen estado, solo tiene el nombre escrito en la portada.", category: "Libros de texto", gradeLevel: "3o ESO", condition: "good", type: "sale", price: 12, originalPrice: 35, photos: ["/placeholder-book.jpg"], sellerId: "u1", schoolId: "s1", status: "active", createdAt: "2025-11-01",
  },
  {
    id: "l2", title: "Mochila Eastpak azul", description: "Mochila Eastpak en perfecto estado. La vendo porque mi hijo quiere otra.", category: "Mochilas y estuches", gradeLevel: "3o Primaria", condition: "new_without_tags", type: "sale", price: 15, originalPrice: 45, photos: ["/placeholder-bag.jpg"], sellerId: "u2", schoolId: "s1", status: "active", createdAt: "2025-11-05",
  },
  {
    id: "l3", title: "Uniforme completo talla 8", description: "Polo, jersey y pantalon del uniforme del colegio. Talla 8 anos. Donacion para quien lo necesite.", category: "Uniformes", gradeLevel: "2o Primaria", condition: "good", type: "donation", photos: ["/placeholder-uniform.jpg"], sellerId: "u1", schoolId: "s1", status: "active", createdAt: "2025-11-08",
  },
  {
    id: "l4", title: "Calculadora cientifica Casio", description: "Casio FX-991SP X II Iberia. Perfecta para bachillerato y universidad. Como nueva.", category: "Tecnologia", gradeLevel: "1o Bachillerato", condition: "new_with_tags", type: "sale", price: 18, originalPrice: 30, photos: ["/placeholder-calc.jpg"], sellerId: "u3", schoolId: "s3", status: "active", createdAt: "2025-11-10",
  },
  {
    id: "l5", title: "Lote libros 1o Primaria", description: "Lote completo de libros para 1o de Primaria del colegio San Miguel. Incluye lengua, mates, cono y ingles.", category: "Libros de texto", gradeLevel: "1o Primaria", condition: "very_good", type: "sale", price: 45, originalPrice: 120, photos: ["/placeholder-books.jpg"], sellerId: "u2", schoolId: "s1", status: "active", createdAt: "2025-11-12",
  },
  {
    id: "l6", title: "Flauta dulce Yamaha", description: "Flauta dulce soprano Yamaha YRS-24B. Perfecta para clase de musica.", category: "Instrumentos musicales", gradeLevel: "4o Primaria", condition: "new_with_tags", type: "donation", photos: ["/placeholder-flute.jpg"], sellerId: "u5", schoolId: "s2", status: "active", createdAt: "2025-11-14", distance: 3.2,
  },
  {
    id: "l7", title: "Atlas geografico ilustrado", description: "Atlas geografico para ESO. Tapa dura, muchas ilustraciones. Muy buen estado.", category: "Libros de texto", gradeLevel: "1o ESO", condition: "very_good", type: "sale", price: 8, originalPrice: 22, photos: ["/placeholder-atlas.jpg"], sellerId: "u5", schoolId: "s2", status: "active", createdAt: "2025-11-15", distance: 3.2,
  },
  {
    id: "l8", title: "Material de dibujo completo", description: "Set completo: lapices Faber-Castell, acuarelas, compas, reglas, escuadra y cartabon.", category: "Material escolar", gradeLevel: "2o ESO", condition: "satisfactory", type: "sale", price: 20, originalPrice: 55, photos: ["/placeholder-art.jpg"], sellerId: "u1", schoolId: "s1", status: "reserved", createdAt: "2025-10-28",
  },
]

// --- Mock Conversations ---
export const conversations: Conversation[] = [
  { id: "c1", listingId: "l1", participants: ["u1", "u2"], lastMessage: "Perfecto, quedamos manana a la salida?", lastMessageAt: "2025-11-16T10:30:00", unread: 1 },
  { id: "c2", listingId: "l5", participants: ["u2", "u1"], lastMessage: "Estan todos los libros incluidos?", lastMessageAt: "2025-11-15T18:00:00", unread: 0 },
  { id: "c3", listingId: "l3", participants: ["u1", "u5"], lastMessage: "Me interesa el uniforme para mi hijo", lastMessageAt: "2025-11-14T09:15:00", unread: 2 },
]

// --- Mock Messages ---
export const messages: Message[] = [
  { id: "m1", conversationId: "c1", senderId: "u2", text: "Hola! Me interesa el libro de mates. Sigue disponible?", timestamp: "2025-11-16T09:00:00" },
  { id: "m2", conversationId: "c1", senderId: "u1", text: "Si, lo tengo! Puedes pasar a recogerlo por el cole", timestamp: "2025-11-16T09:15:00" },
  { id: "m3", conversationId: "c1", senderId: "u2", text: "Perfecto, quedamos manana a la salida?", timestamp: "2025-11-16T10:30:00" },
  { id: "m4", conversationId: "c2", senderId: "u1", text: "Hola Carlos, vi el lote de libros. Estan todos los libros incluidos?", timestamp: "2025-11-15T18:00:00" },
  { id: "m5", conversationId: "c3", senderId: "u5", text: "Me interesa el uniforme para mi hijo", timestamp: "2025-11-14T09:15:00" },
]

// --- Mock Reviews ---
export const reviews: Review[] = [
  { id: "r1", listingId: "l1", reviewerId: "u2", revieweeId: "u1", rating: 5, comment: "Todo perfecto, el libro estaba tal como lo describio. Muy amable.", createdAt: "2025-11-17" },
  { id: "r2", listingId: "l5", reviewerId: "u1", revieweeId: "u2", rating: 4, comment: "Buen lote, aunque faltaba el de ingles. Buen precio igualmente.", createdAt: "2025-11-16" },
  { id: "r3", listingId: "l3", reviewerId: "u5", revieweeId: "u1", rating: 5, comment: "Muy generosa con la donacion. El uniforme estaba impecable.", createdAt: "2025-11-15" },
]

// --- Mock Donation Requests ---
export const donationRequests: DonationRequest[] = [
  { id: "d1", listingId: "l3", requesterId: "u5", status: "pending", message: "Hola, me gustaria el uniforme para mi hijo que empieza este ano.", createdAt: "2025-11-14" },
  { id: "d2", listingId: "l6", requesterId: "u2", status: "pending", message: "Mi hija necesita una flauta para clase de musica.", createdAt: "2025-11-15" },
  { id: "d3", listingId: "l3", requesterId: "u2", status: "pending", message: "Tenemos una situacion dificil y nos vendria muy bien el uniforme.", createdAt: "2025-11-13" },
]

// --- Impact Metrics (school-level) ---
export const schoolMetrics = {
  s1: {
    itemsReused: 156,
    donationsCompleted: 34,
    familiesParticipating: 89,
    moneySaved: 2340,
  },
  s2: {
    itemsReused: 78,
    donationsCompleted: 12,
    familiesParticipating: 45,
    moneySaved: 1150,
  },
}

// --- Helper functions ---
export function getUserById(id: string) {
  return users.find(u => u.id === id)
}

export function getSchoolById(id: string) {
  return schools.find(s => s.id === id)
}

export function getListingById(id: string) {
  return listings.find(l => l.id === id)
}

export function getListingsBySchool(schoolId: string) {
  return listings.filter(l => l.schoolId === schoolId && l.status === "active")
}

export function getListingsBySeller(sellerId: string) {
  return listings.filter(l => l.sellerId === sellerId)
}

export function getReviewsForUser(userId: string) {
  return reviews.filter(r => r.revieweeId === userId)
}

export function getConversationsForUser(userId: string) {
  return conversations.filter(c => c.participants.includes(userId))
}

export function getDonationRequestsBySchool(schoolId: string) {
  return donationRequests.filter(dr => {
    const listing = getListingById(dr.listingId)
    return listing?.schoolId === schoolId
  })
}

// Current logged-in user (mock session)
export const currentUser = users[0] // Ana Garcia
export const currentSchool = schools[0] // CEIP San Miguel
