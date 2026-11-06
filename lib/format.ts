import { TZ } from "./config";
import type { Moneda } from "./types";

/** Hoy en Montevideo, como YYYY-MM-DD. */
export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Días entre hoy y una fecha YYYY-MM-DD (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  const a = Date.parse(hoy() + "T00:00:00Z");
  const b = Date.parse(fecha + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function noches(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

export function plata(monto: number | null | undefined, moneda: Moneda): string {
  if (monto == null) return "—";
  const n = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(monto);
  return moneda === "USD" ? `US$ ${n}` : `$U ${n}`;
}

export function fecha(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(f.length === 10 ? f + "T12:00:00Z" : f);
  // Sin el punto de la abreviatura ("10 dic", no "10 dic."), para que no quede doble punto al final de una frase.
  return new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", timeZone: TZ }).format(d).replace(/\./g, "");
}

export function fechaHora(f: string | null | undefined): string {
  if (!f) return "—";
  return new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(f));
}

export function ahorroPct(pagado: number, actual: number | null): number | null {
  if (actual == null || pagado <= 0) return null;
  return Math.round(((pagado - actual) / pagado) * 1000) / 10;
}
