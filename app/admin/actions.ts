"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { store } from "@/lib/store";
import { chequearReserva, chequearTodas } from "@/lib/vigia";

const COOKIE = "tv_admin";
const huella = (s: string) => createHash("sha256").update("tarifa-vigia:" + s).digest("hex");

export async function esAdmin(): Promise<boolean> {
  const clave = process.env.ADMIN_PASSWORD;
  if (!clave) return false;
  return (await cookies()).get(COOKIE)?.value === huella(clave);
}

export async function entrar(_: { error: string | null }, f: FormData) {
  const clave = process.env.ADMIN_PASSWORD;
  if (!clave) return { error: "Falta configurar ADMIN_PASSWORD." };
  if (String(f.get("clave") ?? "") !== clave) return { error: "Clave incorrecta." };
  (await cookies()).set(COOKIE, huella(clave), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: 60 * 60 * 24 * 14 });
  revalidatePath("/admin");
  return { error: null };
}

export async function salir() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
  revalidatePath("/admin");
}

export async function chequearUna(id: string) {
  if (!(await esAdmin())) return;
  const r = await store().reservaPorId(id);
  if (r) await chequearReserva(r, true);
  revalidatePath("/admin");
}

export async function chequearTodo() {
  if (!(await esAdmin())) return;
  await chequearTodas();
  revalidatePath("/admin");
}

/** El equipo pega el link de TripAdvisor del hotel para tener sus precios en Agoda, Booking, etc. */
export async function guardarTripadvisor(id: string, f: FormData) {
  if (!(await esAdmin())) return;
  const link = String(f.get("tripadvisor") ?? "").trim();
  const clave = link.match(/-(g\d+-d\d+)-/)?.[1] ?? (/^g\d+-d\d+$/.test(link) ? link : null);
  if (!clave && link) return;
  // Se aplica a todas las reservas del mismo hotel.
  const r = await store().reservaPorId(id);
  if (!r) return;
  const mismas = (await store().reservas()).filter((x) => x.id === id || (r.hotel_id && x.hotel_id === r.hotel_id));
  for (const x of mismas) {
    await store().actualizarReserva(x.id, { xotelo_key: clave });
    if (clave && x.estado === "activa") await chequearReserva({ ...x, xotelo_key: clave }, true);
  }
  if (r.hotel_id) {
    for (const b of (await store().busquedas()).filter((x) => x.hotel_id === r.hotel_id)) {
      await store().actualizarBusqueda(b.id, { xotelo_key: clave });
    }
  }
  revalidatePath("/admin");
}
