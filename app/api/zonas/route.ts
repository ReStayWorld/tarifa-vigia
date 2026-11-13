import { NextResponse } from "next/server";
import { permitido } from "@/lib/limite";
import { buscarZonas } from "@/lib/zonas";

export const dynamic = "force-dynamic";

/** Barrios o zonas de una ciudad: /api/zonas?pais=UY&ciudad=Montevideo&q=poci */
export async function GET(req: Request) {
  if (!permitido(req)) return NextResponse.json({ error: "Demasiadas búsquedas, esperá un minuto." }, { status: 429 });
  const u = new URL(req.url).searchParams;
  const pais = (u.get("pais") ?? "").toUpperCase();
  const ciudad = u.get("ciudad") ?? "";
  if (!/^[A-Z]{2}$/.test(pais) || !ciudad) return NextResponse.json({ zonas: [] });
  try {
    return NextResponse.json({ zonas: await buscarZonas(u.get("q") ?? "", ciudad, pais) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ zonas: [] });
  }
}
