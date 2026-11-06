import { NextResponse } from "next/server";
import { chequearTodas } from "@/lib/vigia";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lo llama el cron de Vercel una vez por día (ver vercel.json). */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const resultados = await chequearTodas();
  const resumen = resultados.reduce<Record<string, number>>((acc, r) => {
    acc[r.accion] = (acc[r.accion] ?? 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ resumen, resultados });
}
