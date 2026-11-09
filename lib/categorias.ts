/**
 * Categorías de habitación. Cada web nombra las habitaciones distinto ("Junior Suite King",
 * "Suite Junior vista al mar", "Jr. Suite"), así que comparamos por categoría y no por nombre exacto.
 */
export const CATEGORIAS = {
  compartida: "Cama en habitación compartida",
  estandar: "Estándar",
  superior: "Superior",
  deluxe: "Deluxe",
  junior_suite: "Junior Suite",
  suite: "Suite",
  familiar: "Familiar",
  apartamento: "Apartamento o estudio",
  villa: "Villa, bungalow o cabaña",
} as const;

export type Categoria = keyof typeof CATEGORIAS;

// El orden importa: la primera regla que coincide gana ("Junior Suite" antes que "Suite").
const REGLAS: [Categoria, RegExp][] = [
  ["compartida", /\b(dorm|dormitorio|shared|compartid[ao]|bed in|cama en)\b/],
  ["junior_suite", /\b(junior suite|suite junior|jr\.? suite|mini suite)\b/],
  ["suite", /\bsuite\b/],
  ["villa", /\b(villa|bungalow|cabin|cabana|chalet|cottage)\b/],
  ["apartamento", /\b(apartment|apartamento|apto|flat|studio|estudio|loft)\b/],
  ["familiar", /\b(family|familiar|quadruple|cuadruple)\b/],
  ["deluxe", /\b(deluxe|de luxe|lujo|luxury)\b/],
  ["superior", /\b(superior|premium|executive|ejecutiv[ao]|club|comfort|confort)\b/],
];

export function categoriaDe(nombreHabitacion: string): Categoria {
  const n = nombreHabitacion
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [cat, re] of REGLAS) if (re.test(n)) return cat;
  return "estandar";
}

export function esCategoria(s: string): s is Categoria {
  return s in CATEGORIAS;
}
