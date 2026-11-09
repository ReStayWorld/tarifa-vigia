// Códigos ISO-2. Los nombres salen en español del navegador o del servidor (Intl.DisplayNames).
const CODIGOS =
  "AR BR UY CL PY PE CO MX US ES IT FR PT DE GB NL BE CH AT GR TR HR CZ HU PL IE DK SE NO FI IS MA EG ZA AE QA IL JO IN TH VN ID MY SG PH JP KR CN HK TW AU NZ CA CU DO JM PA CR GT HN NI SV BO EC VE BZ PR BS BB AW CW KE TZ MU MV LK NP AD MC MT CY LU SI SK RO BG RS ME AL EE LV LT GE AM AZ KZ UZ".split(
    " ",
  );

// Primero los destinos más comunes para quien viaja desde Uruguay.
const FRECUENTES = ["UY", "AR", "BR", "CL", "US", "ES", "IT", "FR", "MX", "PE", "CO", "PT"];

export function paises(): { codigo: string; nombre: string }[] {
  const nombres = new Intl.DisplayNames(["es"], { type: "region" });
  const todos = CODIGOS.map((codigo) => ({ codigo, nombre: nombres.of(codigo) ?? codigo }));
  const frecuentes = FRECUENTES.map((c) => todos.find((p) => p.codigo === c)!);
  const resto = todos.filter((p) => !FRECUENTES.includes(p.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return [...frecuentes, ...resto];
}
