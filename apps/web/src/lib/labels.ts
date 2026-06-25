export const EVENT_STATUS_LABELS: Record<string, string> = {
  borrador: "Draft",
  planificacion: "Planning",
  confirmado: "Confirmed",
  en_curso: "In progress",
  finalizado: "Completed",
  cancelado: "Cancelled",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  concierto: "Concert",
  charla: "Talk",
  exposicion: "Exhibition",
  privado: "Private",
  publico: "Public",
  corporativo: "Corporate",
  boda: "Wedding",
  otro: "Other",
};

export const CATEGORY_LABELS: Record<string, string> = {
  personal: "Personnel",
  catering: "Catering",
  equipo: "Equipment",
  mobiliario: "Furniture",
  audio_video: "Audio / Video",
  iluminacion: "Lighting",
  transporte: "Transport",
  seguridad: "Security",
  permisos: "Permits",
  marketing: "Marketing",
  extras: "Extras",
  // AI-suggested lines arrive with English categories before being applied/mapped.
  equipment: "Equipment",
  crew: "Personnel",
  supplier: "Extras",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "Under review",
  approved: "Approved",
  sent: "Sent",
  rejected: "Rejected",
};

export function label<T extends Record<string, string>>(map: T, key: string): string {
  return map[key] ?? key;
}
