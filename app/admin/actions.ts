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
