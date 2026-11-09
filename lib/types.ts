export type Moneda = "USD" | "UYU";

/** activa: se vigila · cambiada: el viajero cambió la reserva · no_cambia: decidió no cambiar
 *  · baja: pidió dejar de vigilar · finalizada: venció la cancelación gratis */
export type Estado = "activa" | "cambiada" | "no_cambia" | "baja" | "finalizada";

export interface Reserva {
  id: string;
  token: string;
  created_at: string;
  hotel: string;
  hotel_id: string; // id del hotel en LiteAPI
  xotelo_key: string | null; // id del hotel en Xotelo (TripAdvisor), para precios por web
  pais: string; // ISO-2
  ciudad: string;
  check_in: string; // YYYY-MM-DD
  check_out: string;
  huespedes: number;
  habitacion: string; // nombre de la categoría, para mostrar
  categoria: string; // clave de lib/categorias.ts
  plataforma: string;
  precio_pagado: number; // total de la estadía
  moneda: Moneda;
  fecha_reserva: string;
  cancelacion_hasta: string;
  email: string;
  whatsapp: string | null;
  variante: string | null; // test A/B de la landing
  estado: Estado;
  ultimo_chequeo: string | null;
  property_token: string | null; // id del hotel en Google Hotels, para no buscarlo de nuevo
  precio_actual: number | null;
  fuente_actual: string | null;
  link_actual: string | null;
  cancelacion_gratis_actual: boolean | null;
  ultima_alerta_precio: number | null;
  ultima_alerta_at: string | null;
  recordatorio_enviado: boolean;
  respuesta: string | null;
  precio_nuevo: number | null;
  confianza: number | null;
  motivo: string | null;
}

export interface Chequeo {
  id: string;
  reserva_id: string;
  created_at: string;
  precio: number | null;
  fuente: string | null;
  link: string | null;
  cancelacion_gratis: boolean | null;
  ahorro_pct: number | null;
  alerta: boolean;
  nota: string | null;
  busquedas: number;
  detalle: { webs?: { web: string; total: number }[]; habitacion?: string } | null;
}

export type NuevaReserva = Omit<
  Reserva,
  | "id"
  | "created_at"
  | "estado"
  | "ultimo_chequeo"
  | "property_token"
  | "precio_actual"
  | "fuente_actual"
  | "link_actual"
  | "cancelacion_gratis_actual"
  | "ultima_alerta_precio"
  | "ultima_alerta_at"
  | "recordatorio_enviado"
  | "respuesta"
  | "precio_nuevo"
  | "confianza"
  | "motivo"
>;
