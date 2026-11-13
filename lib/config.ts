export const BRAND = "Tarifa Vigía";

/** Ahorro mínimo (%) para mandar una alerta. El Obligatorio 2 fija 5%. */
export const ALERT_MIN_PCT = Number(process.env.ALERT_MIN_PCT ?? 5);

/** Cada cuántas horas se vuelve a chequear una reserva. Admite fracciones (0.5 = cada 30 min). */
export const CHECK_EVERY_HOURS = Number(process.env.CHECK_EVERY_HOURS ?? 2);

/** Días antes del vencimiento de la cancelación gratis en que se manda un recordatorio. */
export const REMINDER_DAYS = 2;

/**
 * Descuento de Genius de Booking por nivel, como lo publica Booking: nivel 1 da 10%,
 * nivel 2 entre 10% y 15%, nivel 3 entre 10% y 20%. Solo en hoteles que participan.
 */
export const GENIUS_RANGO_PCT: Record<number, [number, number]> = { 1: [10, 10], 2: [10, 15], 3: [10, 20] };

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const TZ = "America/Montevideo";
