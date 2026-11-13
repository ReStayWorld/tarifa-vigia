"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chequearBusqueda } from "@/lib/busquedas";
import { enviar, mailBusquedaBienvenida } from "@/lib/email";
import { hoy } from "@/lib/format";
import { store } from "@/lib/store";
import type { Moneda } from "@/lib/types";

export type EstadoBusqueda = { error: string | null };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = texto(f, k).replace(/\./g, "").replace(",", ".");
  return v === "" ? null : Number(v);
};

// Las coordenadas llegan con punto decimal: no pasan por num(), que saca los puntos de miles.
const coord = (f: FormData, k: string) => {
  const v = Number(texto(f, k));
  return texto(f, k) === "" || !Number.isFinite(v) ? null : v;
};

export async function crearBusqueda(_: EstadoBusqueda, f: FormData): Promise<EstadoBusqueda> {
  const d = {
    pais: texto(f, "pais").toUpperCase(),
    ciudad: texto(f, "ciudad"),
    zona: texto(f, "zona") || null,
    zona_lat: coord(f, "zona_lat"),
    zona_lon: coord(f, "zona_lon"),
    radio_km: num(f, "radio_km"),
    check_in: texto(f, "check_in"),
    check_out: texto(f, "check_out"),
    huespedes: Number(texto(f, "huespedes") || 2),
    tope_noche: num(f, "tope_noche") ?? 0,
    moneda: (texto(f, "moneda") === "UYU" ? "UYU" : "USD") as Moneda,
    estrellas_min: num(f, "estrellas_min") || null,
    email: texto(f, "email").toLowerCase(),
  };

  if (!/^[A-Z]{2}$/.test(d.pais) || !d.ciudad) return { error: "Elegí el país y la ciudad." };
  if (d.zona && (d.zona_lat == null || d.zona_lon == null)) return { error: "Elegí la zona de la lista que aparece al escribir." };
  if (!d.zona) Object.assign(d, { zona_lat: null, zona_lon: null, radio_km: null });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(d.check_out)) return { error: "Elegí las fechas." };
  if (d.check_in < hoy()) return { error: "La fecha de entrada no puede ser pasada." };
  if (d.check_out <= d.check_in) return { error: "La fecha de salida tiene que ser después de la de entrada." };
  if (!(d.tope_noche > 0)) return { error: "Poné cuánto querés pagar como máximo por noche." };
  if (!(d.huespedes >= 1 && d.huespedes <= 10)) return { error: "La cantidad de adultos tiene que estar entre 1 y 10." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: "Revisá tu email: lo necesitamos para avisarte." };
  if (f.get("acepto") !== "on") return { error: "Necesitamos que aceptes las condiciones del piloto." };

  const b = await store().crearBusqueda({ ...d, token: randomBytes(16).toString("base64url") });
  try {
    await enviar(mailBusquedaBienvenida(b));
  } catch (e) {
    console.error("No se pudo mandar el mail de bienvenida", e);
  }
  await chequearBusqueda(b, true);
  redirect(`/b/${b.token}?nueva=1`);
}

export async function pausarBusqueda(token: string) {
  const b = await store().busquedaPorToken(token);
  if (b) await store().actualizarBusqueda(b.id, { estado: b.estado === "activa" ? "pausada" : "activa" });
  revalidatePath(`/b/${token}`);
}
