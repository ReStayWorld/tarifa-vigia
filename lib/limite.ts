import "server-only";

// Límite simple por IP para los buscadores públicos (por instancia del servidor).
const visitas = new Map<string, number[]>();

export function permitido(req: Request, porMinuto = 40): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ahora = Date.now();
  const lista = (visitas.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  lista.push(ahora);
  visitas.set(ip, lista);
  if (visitas.size > 5000) visitas.clear();
  return lista.length <= porMinuto;
}
