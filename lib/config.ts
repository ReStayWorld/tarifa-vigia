export const BRAND = "Tarifa Vigía";

/** Ahorro mínimo (%) para mandar una alerta. El Obligatorio 2 fija 5%. */
export const ALERT_MIN_PCT = Number(process.env.ALERT_MIN_PCT ?? 5);

/** Cada cuántas horas se vuelve a chequear una reserva. Admite fracciones (0.5 = cada 30 min). */
export const CHECK_EVERY_HOURS = Number(process.env.CHECK_EVERY_HOURS ?? 2);

/** Días antes del vencimiento de la cancelación gratis en que se manda un recordatorio. */
export const REMINDER_DAYS = 2;

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const TZ = "America/Montevideo";
