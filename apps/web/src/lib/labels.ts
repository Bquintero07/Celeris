export const EVENT_STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  planificacion: "Planificación",
  confirmado: "Confirmado",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  concierto: "Concierto",
  charla: "Charla",
  exposicion: "Exposición",
  privado: "Privado",
  publico: "Público",
  corporativo: "Corporativo",
  boda: "Boda",
  otro: "Otro",
};

export const CATEGORY_LABELS: Record<string, string> = {
  personal: "Personal",
  catering: "Catering",
  equipo: "Equipo",
  mobiliario: "Mobiliario",
  audio_video: "Audio / Video",
  iluminacion: "Iluminación",
  transporte: "Transporte",
  seguridad: "Seguridad",
  permisos: "Permisos",
  marketing: "Marketing",
  extras: "Extras",
  // AI-suggested lines arrive with English categories before being applied/mapped.
  equipment: "Equipo",
  crew: "Personal",
  supplier: "Extras",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  review: "En revisión",
  approved: "Aprobado",
  sent: "Enviado",
  rejected: "Rechazado",
};

export function label<T extends Record<string, string>>(map: T, key: string): string {
  return map[key] ?? key;
}
