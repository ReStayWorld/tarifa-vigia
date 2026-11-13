import "server-only";
import { ALERT_MIN_PCT, CHECK_EVERY_HOURS, GENIUS_DESCUENTO_PCT, REMINDER_DAYS } from "./config";
import { enviar, mailAlerta, mailRecordatorio } from "./email";
import { ahorroPct, diasHasta } from "./format";
import { modoDemo, preciosPorWeb, tarifas, type Oferta } from "./proveedores";
import { store } from "./store";
import type { Reserva } from "./types";
import { conGenius, linkWeb } from "./webs";

export type Resultado = {
  reserva: string;
  hotel: string;
  accion: "salteada" | "chequeada" | "alerta" | "recordatorio" | "finalizada" | "error";
  detalle?: string;
};

/** Link para que el viajero vea la oferta. Con LITEAPI_BOOKING_URL (sitio de reservas de LiteAPI) va directo al hotel. */
export function linkOferta(r: Reserva): string {
  const base = process.env.LITEAPI_BOOKING_URL?.replace(/\/$/, "");
  if (base && r.hotel_id) {
    const p = new URLSearchParams({ checkin: r.check_in, checkout: r.check_out, adults: String(r.huespedes) });
    return `${base}/hotels/${r.hotel_id}?${p}`;
  }
  return "https://www.google.com/travel/search?q=" + encodeURIComponent(`${r.hotel} ${r.ciudad}`);
}

/** Chequea una reserva: busca la misma categoría más barata, la guarda y avisa si corresponde. */
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
  // Margen (10% del intervalo) para que un cron que corre justo a la hora no se saltee un chequeo.
  if (!forzar && horas < CHECK_EVERY_HOURS * 0.9) {
    return { ...base, accion: "salteada", detalle: `Último chequeo hace ${horas.toFixed(1)} h` };
  }
  if (!r.hotel_id || !r.categoria) {
    return { ...base, accion: "salteada", detalle: "Reserva anterior al cambio: falta el hotel o la categoría" };
  }

  try {
    const consulta = { checkIn: r.check_in, checkOut: r.check_out, adultos: r.huespedes, moneda: r.moneda };
    const [todas, websPublicos] = await Promise.all([tarifas({ ...consulta, hotelId: r.hotel_id }), preciosPorWeb(r.xotelo_key, consulta)]);
    const webs = conGenius(websPublicos, r.genius, GENIUS_DESCUENTO_PCT);

    // Misma categoría, con cualquier política de cancelación: lo que importa es que sea más barata.
    const ofertas: Oferta[] = todas
      .filter((t) => t.categoria === r.categoria)
      .map((t) => ({
        total: t.total,
        donde: process.env.LITEAPI_BOOKING_URL ? "Nuestro sitio de reservas" : "Proveedor mayorista de hoteles (LiteAPI)",
        link: linkOferta(r),
        habitacion: t.nombre,
        regimen: t.regimen,
        cancelacionGratis: t.cancelacionGratis,
        cancelacionHasta: t.cancelacionHasta,
      }));
    // Las webs (Agoda, Booking...) informan solo la habitación más barata del hotel:
    // sirven para comparar únicamente si la reserva es de categoría estándar.
    if (r.categoria === "estandar") {
      for (const w of webs) {
        ofertas.push({
          total: w.total,
          donde: w.web,
          link: linkWeb(w.web, r.hotel, r.ciudad, r.check_in, r.check_out, r.huespedes),
          habitacion: null,
          regimen: null,
          cancelacionGratis: null,
          cancelacionHasta: null,
        });
      }
    }
    const mejor = ofertas.sort((a, b) => a.total - b.total)[0] ?? null;
    const precio = mejor?.total ?? null;
    const pct = ahorroPct(r.precio_pagado, precio);
    const ahora = new Date().toISOString();

    // No repetimos la alerta salvo que el precio baje al menos 2% más que la última avisada.
    const yaAvisado = r.ultima_alerta_precio != null && precio != null && precio > r.ultima_alerta_precio * 0.98;
    const corresponde = precio != null && pct != null && pct >= ALERT_MIN_PCT && !yaAvisado;

    const nota = !mejor
      ? todas.length
        ? `No hay ${r.habitacion} disponible`
        : "Hoy no conseguimos precios de este hotel"
      : mejor.habitacion === null
        ? "Habitación más barata de la web: verificá que sea tu categoría"
        : modoDemo()
          ? "Precio simulado (modo demo)"
          : null;

    await db.agregarChequeo({
      reserva_id: r.id,
      precio,
      fuente: mejor ? [mejor.donde, mejor.habitacion].filter(Boolean).join(" · ") : null,
      link: mejor?.link ?? null,
      cancelacion_gratis: mejor?.cancelacionGratis ?? null,
      ahorro_pct: pct,
      alerta: corresponde,
      nota,
      busquedas: 0,
      detalle: { webs, habitacion: mejor?.habitacion ?? undefined },
    });

    const cambios: Partial<Reserva> = {
      ultimo_chequeo: ahora,
      precio_actual: precio,
      fuente_actual: mejor ? [mejor.donde, mejor.habitacion, mejor.regimen].filter(Boolean).join(" · ") : null,
      link_actual: mejor?.link ?? null,
      cancelacion_gratis_actual: mejor?.cancelacionGratis ?? null,
    };

    let accion: Resultado["accion"] = "chequeada";
    if (corresponde) {
      await enviar(mailAlerta(r, mejor!, webs));
      cambios.ultima_alerta_precio = precio;
      cambios.ultima_alerta_at = ahora;
      accion = "alerta";
    } else if (dias <= REMINDER_DAYS && !r.recordatorio_enviado && r.ultima_alerta_at == null) {
      await enviar(mailRecordatorio(r, dias));
      cambios.recordatorio_enviado = true;
      accion = "recordatorio";
    }

    await db.actualizarReserva(r.id, cambios);
    return { ...base, accion, detalle: pct == null ? nota ?? "Sin precio" : `${pct}% de ahorro` };
  } catch (e) {
    return { ...base, accion: "error", detalle: e instanceof Error ? e.message : String(e) };
  }
}

/** Corre el chequeo sobre todas las reservas activas, de a una para no saturar a los proveedores. */
export async function chequearTodas(): Promise<Resultado[]> {
  const activas = await store().reservas(true);
  const resultados: Resultado[] = [];
  for (const r of activas) resultados.push(await chequearReserva(r));
  return resultados;
}
