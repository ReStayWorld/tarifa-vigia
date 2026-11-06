"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";

/** El viajero cuenta qué hizo con la alerta (mide SH4 y SH5). */
export async function responder(token: string, f: FormData) {
  const db = store();
  const r = await db.reservaPorToken(token);
  if (!r) return;

  const respuesta = String(f.get("respuesta") ?? "");
  const confianza = Number(f.get("confianza") ?? 0);
  const precioNuevo = Number(String(f.get("precio_nuevo") ?? "").replace(/\./g, "").replace(",", "."));
  const motivo = String(f.get("motivo") ?? "").trim().slice(0, 500) || null;

  await db.actualizarReserva(r.id, {
    respuesta: respuesta === "cambie" || respuesta === "no_cambio" ? respuesta : null,
    estado: respuesta === "cambie" ? "cambiada" : respuesta === "no_cambio" ? "no_cambia" : r.estado,
    precio_nuevo: respuesta === "cambie" && precioNuevo > 0 ? precioNuevo : null,
    confianza: confianza >= 1 && confianza <= 5 ? confianza : r.confianza,
    motivo,
  });
  revalidatePath(`/r/${token}`);
  redirect(`/r/${token}?gracias=1`);
}

export async function darDeBaja(token: string) {
  const db = store();
  const r = await db.reservaPorToken(token);
  if (!r) return;
  await db.actualizarReserva(r.id, { estado: "baja" });
  revalidatePath(`/r/${token}`);
}

export async function reactivar(token: string) {
  const db = store();
  const r = await db.reservaPorToken(token);
  if (!r) return;
  await db.actualizarReserva(r.id, { estado: "activa" });
  revalidatePath(`/r/${token}`);
}
