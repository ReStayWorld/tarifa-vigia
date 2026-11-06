"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { enviar, mailBienvenida } from "@/lib/email";
import { hoy } from "@/lib/format";
import { store } from "@/lib/store";
import type { Moneda } from "@/lib/types";
import { chequearReserva } from "@/lib/vigia";

export type EstadoForm = { error: string | null };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const esFecha = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function registrar(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const d = {
    hotel: texto(f, "hotel"),
    ciudad: texto(f, "ciudad"),
    check_in: texto(f, "check_in"),
    check_out: texto(f, "check_out"),
    huespedes: Number(texto(f, "huespedes") || 2),
    habitacion: texto(f, "habitacion"),
    plataforma: texto(f, "plataforma"),
    precio_pagado: Number(texto(f, "precio_pagado").replace(/\./g, "").replace(",", ".")),
    moneda: (texto(f, "moneda") === "UYU" ? "UYU" : "USD") as Moneda,
    fecha_reserva: texto(f, "fecha_reserva"),
    cancelacion_hasta: texto(f, "cancelacion_hasta"),
    email: texto(f, "email").toLowerCase(),
    whatsapp: texto(f, "whatsapp") || null,
    variante: texto(f, "variante") || null,
  };

  if (!d.hotel || !d.ciudad || !d.habitacion || !d.plataforma) return { error: "Completá el hotel, la ciudad, la habitación y la plataforma." };
  if (![d.check_in, d.check_out, d.fecha_reserva, d.cancelacion_hasta].every(esFecha)) return { error: "Revisá las fechas: falta alguna." };
  if (d.check_out <= d.check_in) return { error: "La fecha de salida tiene que ser después de la de entrada." };
  if (d.fecha_reserva > hoy()) return { error: "La fecha en que reservaste no puede ser futura." };
  if (d.cancelacion_hasta < hoy()) return { error: "Tu cancelación gratis ya venció, así que no podríamos ayudarte a cambiarla." };
  if (d.cancelacion_hasta > d.check_in) return { error: "La cancelación gratis no puede vencer después del día de entrada." };
  if (!(d.precio_pagado > 0)) return { error: "Poné el precio total que pagaste, solo números." };
  if (!(d.huespedes >= 1 && d.huespedes <= 10)) return { error: "La cantidad de huéspedes tiene que estar entre 1 y 10." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: "Revisá tu email: lo necesitamos para mandarte la alerta." };
  if (f.get("acepto") !== "on") return { error: "Necesitamos que aceptes las condiciones del piloto." };

  const token = randomBytes(16).toString("base64url");
  const reserva = await store().crearReserva({ ...d, token });

  try {
    await enviar(mailBienvenida(reserva));
  } catch (e) {
    console.error("No se pudo mandar el mail de bienvenida", e);
  }
  // Primer chequeo apenas se registra, así el viajero ya ve el precio de hoy.
  await chequearReserva(reserva, true);

  redirect(`/r/${token}?nuevo=1`);
}
