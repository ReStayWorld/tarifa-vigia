import "server-only";
import { ALERT_MIN_PCT, CHECK_EVERY_HOURS, REMINDER_DAYS, SERPAPI_MONTHLY_LIMIT } from "./config";
import { enviar, mailAlerta, mailRecordatorio } from "./email";
import { ahorroPct, diasHasta } from "./format";
import { cotizar } from "./prices";
import { store } from "./store";
import type { Reserva } from "./types";

export type Resultado = {
  reserva: string;
  hotel: string;
  accion: "salteada" | "chequeada" | "alerta" | "recordatorio" | "finalizada" | "error";
  detalle?: string;
};

/** Chequea una reserva: busca el precio, lo guarda y manda alerta o recordatorio si corresponde. */
export async function chequearReserva(r: Reserva, forzar = false): Promise<Resultado> {
  const db = store();
  const base = { reserva: r.id, hotel: r.hotel };

  if (r.estado !== "activa") return { ...base, accion: "salteada", detalle: r.estado };

  const dias = diasHasta(r.cancelacion_hasta);
  if (dias < 0) {
    await db.actualizarReserva(r.id, { estado: "finalizada" });
    return { ...base, accion: "finalizada", detalle: "Venció la cancelación gratis" };
  }

  const horas = r.ultimo_chequeo ? (Date.now() - Date.parse(r.ultimo_chequeo)) / 3_600_000 : Infinity;
  // Margen de 1 h para que un cron diario no se saltee el chequeo de las 48 h.
  if (!forzar && horas < CHECK_EVERY_HOURS - 1) {
    return { ...base, accion: "salteada", detalle: `Último chequeo hace ${Math.round(horas)} h` };
  }

  if (process.env.PRICE_PROVIDER === "serpapi" && (await busquedasDelMes()) >= SERPAPI_MONTHLY_LIMIT) {
    return { ...base, accion: "salteada", detalle: `Se llegó al tope de ${SERPAPI_MONTHLY_LIMIT} búsquedas del mes` };
  }

  try {
    const c = await cotizar(r);
    const pct = ahorroPct(r.precio_pagado, c.precio);
    const ahora = new Date().toISOString();

    // No repetimos la alerta salvo que el precio baje al menos 2% más que la última avisada.
    const yaAvisado = r.ultima_alerta_precio != null && c.precio != null && c.precio > r.ultima_alerta_precio * 0.98;
    const corresponde = c.precio != null && pct != null && pct >= ALERT_MIN_PCT && c.cancelacionGratis !== false && !yaAvisado;

    await db.agregarChequeo({
      reserva_id: r.id,
      precio: c.precio,
      fuente: c.fuente,
      link: c.link,
      cancelacion_gratis: c.cancelacionGratis,
      ahorro_pct: pct,
      alerta: corresponde,
      nota: c.nota,
      busquedas: c.busquedas,
    });

    const cambios: Partial<Reserva> = {
      ultimo_chequeo: ahora,
      precio_actual: c.precio,
      fuente_actual: c.fuente,
      link_actual: c.link,
      cancelacion_gratis_actual: c.cancelacionGratis,
    };
    if (c.propertyToken && c.propertyToken !== r.property_token) cambios.property_token = c.propertyToken;

    let accion: Resultado["accion"] = "chequeada";
    if (corresponde) {
      await enviar(mailAlerta(r, c.precio!, c.fuente, c.link, c.cancelacionGratis));
      cambios.ultima_alerta_precio = c.precio;
      cambios.ultima_alerta_at = ahora;
      accion = "alerta";
    } else if (dias <= REMINDER_DAYS && !r.recordatorio_enviado && r.ultima_alerta_at == null) {
      await enviar(mailRecordatorio(r, dias));
      cambios.recordatorio_enviado = true;
      accion = "recordatorio";
    }

    await db.actualizarReserva(r.id, cambios);
    return { ...base, accion, detalle: pct == null ? c.nota ?? "Sin precio" : `${pct}% de ahorro` };
  } catch (e) {
    return { ...base, accion: "error", detalle: e instanceof Error ? e.message : String(e) };
  }
}

/** Búsquedas de SerpApi gastadas en el mes calendario actual. */
export async function busquedasDelMes(): Promise<number> {
  const mes = new Date().toISOString().slice(0, 7);
  return (await store().chequeos())
    .filter((c) => c.created_at.slice(0, 7) === mes)
    .reduce((s, c) => s + (c.busquedas ?? 0), 0);
}

/** Corre el chequeo sobre todas las reservas activas, de a una para no saturar la API de precios. */
export async function chequearTodas(): Promise<Resultado[]> {
  const activas = await store().reservas(true);
  const resultados: Resultado[] = [];
  for (const r of activas) resultados.push(await chequearReserva(r));
  return resultados;
}
