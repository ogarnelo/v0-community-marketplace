export function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  }

  if (email && email.length > 0) {
    return email[0].toUpperCase();
  }

  return "U";
}

export function getUserTypeLabel(userType?: string | null) {
  switch (userType) {
    case "parent":
      return "Familia / Tutor legal";
    case "student":
      return "Estudiante";
    default:
      return "Usuario";
  }
}

export function getConditionLabel(value?: string | null) {
  switch (value) {
    case "new_with_tags":
      return "Nuevo con etiquetas";
    case "new_without_tags":
      return "Nuevo sin etiquetas";
    case "very_good":
      return "Muy bueno";
    case "good":
      return "Bueno";
    case "satisfactory":
      return "Satisfactorio";
    default:
      return value || "Sin estado";
  }
}

export function getStatusLabel(status?: string | null) {
  switch (status) {
    case "available":
      return "Disponible";
    case "reserved":
      return "Reservado";
    case "sold":
      return "Vendido";
    case "archived":
      return "Archivado";
    default:
      return status || "Sin estado";
  }
}

export function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "reserved":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "sold":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "archived":
      return "border-slate-200 bg-slate-50 text-slate-500";
    default:
      return "";
  }
}
export function getDiscountPercent(originalPrice?: number | null, price?: number | null) {
  if (typeof originalPrice !== "number" || typeof price !== "number") {
    return 0;
  }

  if (originalPrice <= 0 || price < 0 || originalPrice <= price) {
    return 0;
  }

  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
