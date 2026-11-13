import "server-only";
import { BASE_URL, BRAND } from "./config";
import { fecha, plata } from "./format";
import type { Oferta, PrecioWeb } from "./proveedores";
import type { Reserva } from "./types";
import { linkWeb } from "./webs";

type Mail = { to: string; subject: string; html: string; text: string };

/** Manda el mail con Gmail (gratis, a cualquier dirección) o con Resend.
 *  Sin ninguno configurado lo muestra en la consola (modo local). */
export async function enviar(m: Mail): Promise<{ enviado: boolean }> {
  const gmail = process.env.GMAIL_USER;
  const gmailClave = process.env.GMAIL_APP_PASSWORD;
  if (gmail && gmailClave) {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({ service: "gmail", auth: { user: gmail, pass: gmailClave.replace(/\s/g, "") } });
    await t.sendMail({ from: `${BRAND} <${gmail}>`, to: m.to, subject: m.subject, html: m.html, text: m.text });
    return { enviado: true };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n✉️  [mail simulado] Para: ${m.to}\nAsunto: ${m.subject}\n${m.text}\n`);
    return { enviado: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!res.ok) throw new Error("Resend: " + (await res.text()));
  return { enviado: true };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function marco(titulo: string, cuerpo: string) {
  return `<!doctype html><html><body style="margin:0;background:#eef2f1;font-family:Helvetica,Arial,sans-serif;color:#13302b">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4d6b65;margin:0 0 12px">${BRAND}</p>
<div style="background:#ffffff;border-radius:10px;padding:24px">
<h1 style="font-size:22px;line-height:1.25;margin:0 0 16px">${titulo}</h1>
${cuerpo}
</div>
<p style="font-size:12px;color:#4d6b65;margin:16px 0 0">Piloto académico · Universidad ORT Uruguay. La decisión de cambiar tu reserva es siempre tuya.</p>
</div></body></html>`;
}

const boton = (href: string, texto: string) =>
  `<a href="${href}" style="display:inline-block;background:#13302b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">${texto}</a>`;

export function mailBienvenida(r: Reserva): Mail {
  const link = `${BASE_URL}/r/${r.token}`;
  return {
    to: r.email,
    subject: `Ya estamos vigilando tu reserva en ${r.hotel}`,
    text: `Registramos tu reserva en ${r.hotel} (${fecha(r.check_in)} al ${fecha(r.check_out)}), pagaste ${plata(r.precio_pagado, r.moneda)}. Te avisamos si baja el precio antes del ${fecha(r.cancelacion_hasta)}, tu último día de cancelación gratis. Seguila acá: ${link}`,
    html: marco(
      `Ya estamos vigilando tu reserva`,
      `<p style="line-height:1.5">${esc(r.hotel)}, ${fecha(r.check_in)} al ${fecha(r.check_out)}. Pagaste <b>${plata(r.precio_pagado, r.moneda)}</b>.</p>
<p style="line-height:1.5">Revisamos el precio varias veces por día. Si aparece la misma estadía más barata antes del <b>${fecha(r.cancelacion_hasta)}</b> (tu último día de cancelación gratis), te escribimos.</p>
<p>${boton(link, "Ver mi reserva")}</p>
<p style="font-size:13px;color:#4d6b65">Guardá este mail: el botón es tu acceso a la reserva.</p>`,
    ),
  };
}

export function mailAlerta(r: Reserva, o: Oferta, webs: PrecioWeb[]): Mail {
  const precio = o.total;
  const ahorro = r.precio_pagado - precio;
  const pct = Math.round((ahorro / r.precio_pagado) * 100);
  const link = `${BASE_URL}/r/${r.token}`;
  const cancel =
    o.cancelacionGratis === true
      ? o.cancelacionHasta
        ? `Gratis hasta el ${fecha(o.cancelacionHasta)}`
        : "Cancelación gratis"
      : o.cancelacionGratis === false
        ? "Sin cancelación gratis"
        : "La web no la informa";
  const fila = (a: string, b: string, c: string) =>
    `<tr><td style="padding:8px;border-top:1px solid #dfe7e5;color:#4d6b65">${a}</td><td style="padding:8px;border-top:1px solid #dfe7e5">${b}</td><td style="padding:8px;border-top:1px solid #dfe7e5"><b>${c}</b></td></tr>`;
  const enWebs = webs.length
    ? `<p style="line-height:1.5;margin:16px 0 6px"><b>El hotel hoy en cada web</b> <span style="color:#4d6b65;font-size:13px">(habitación más barata, puede no ser tu categoría)</span></p>
<ul style="margin:0 0 16px;padding-left:18px;line-height:1.7">${webs
        .map((w) => `<li><a href="${linkWeb(w.web, r.hotel, r.ciudad, r.check_in, r.check_out, r.huespedes)}" style="color:#13302b">${esc(w.web)}</a>: ${plata(w.total, r.moneda)}</li>`)
        .join("")}</ul>${
        webs.some((w) => w.web.includes("Genius"))
          ? `<p style="font-size:13px;color:#4d6b65;margin:0 0 16px">El precio de Booking.com incluye un descuento Genius estimado del 10%. Vale solo si el hotel participa de Genius.</p>`
          : ""
      }`
    : "";
  const websTexto = webs.length ? ` El hotel hoy en cada web: ${webs.map((w) => `${w.web} ${plata(w.total, r.moneda)}`).join(", ")}.` : "";
  return {
    to: r.email,
    subject: `Bajó tu hotel en ${o.donde}: ahorrá ${plata(ahorro, r.moneda)} en ${r.hotel}`,
    text: `Encontramos tu estadía en ${r.hotel} (${r.habitacion}, del ${fecha(r.check_in)} al ${fecha(r.check_out)}) más barata en ${o.donde}: pagaste ${plata(r.precio_pagado, r.moneda)} y hoy está a ${plata(precio, r.moneda)}${o.habitacion ? ` (${o.habitacion})` : ""}, ahorro de ${plata(ahorro, r.moneda)} (${pct}%). ${cancel}. Podés cancelar tu reserva actual sin costo hasta el ${fecha(r.cancelacion_hasta)}. Cómo cambiar: 1) reservá la nueva opción en ${o.donde}; 2) confirmá que quedó confirmada; 3) cancelá la reserva anterior en ${r.plataforma} antes del ${fecha(r.cancelacion_hasta)}. Ver oferta: ${o.link}.${websTexto} Tu reserva: ${link}. La decisión es tuya.`,
    html: marco(
      `Bajó el precio en ${esc(o.donde)}: podés ahorrar ${plata(ahorro, r.moneda)} (${pct}%)`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">
<tr><td></td><td style="padding:8px;color:#4d6b65">Tu reserva</td><td style="padding:8px;color:#4d6b65">Opción encontrada</td></tr>
${fila("Dónde", esc(r.plataforma), esc(o.donde))}
${fila("Hotel y fechas", `${esc(r.hotel)}, ${fecha(r.check_in)}–${fecha(r.check_out)}`, "Mismas")}
${fila("Habitación", esc(r.habitacion), esc(o.habitacion ?? "La más barata de la web"))}
${o.regimen ? fila("Régimen", "—", esc(o.regimen)) : ""}
${fila("Cancelación", `Gratis hasta el ${fecha(r.cancelacion_hasta)}`, cancel)}
${fila("Precio total", plata(r.precio_pagado, r.moneda), plata(precio, r.moneda))}
</table>
<p>${boton(o.link, `Ver la oferta en ${esc(o.donde)}`)}</p>
<p style="line-height:1.5"><b>Cómo cambiar:</b> (1) reservá la nueva opción en ${esc(o.donde)}; (2) confirmá que la reserva quedó confirmada; (3) cancelá la reserva anterior en ${esc(r.plataforma)} antes del <b>${fecha(r.cancelacion_hasta)}</b>.</p>
<p style="line-height:1.5;font-size:13px;color:#4d6b65">${o.habitacion ? "Es la misma categoría, no necesariamente la misma habitación: revisá vista, camas y desayuno antes de reservar." : "La web no informa la habitación: revisá que sea tu categoría antes de reservar."}</p>
${enWebs}
<p><a href="${link}" style="color:#13302b">Contanos qué hiciste</a></p>`,
    ),
  };
}

export function mailRecordatorio(r: Reserva, dias: number): Mail {
  const link = `${BASE_URL}/r/${r.token}`;
  const cuando = dias <= 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
  return {
    to: r.email,
    subject: `Tu cancelación gratis en ${r.hotel} vence ${cuando}`,
    text: `Tu cancelación gratis en ${r.hotel} vence ${cuando} (${fecha(r.cancelacion_hasta)}). Hasta ahora no encontramos un precio menor que justifique el cambio. Después de esa fecha dejamos de vigilarla. Tu reserva: ${link}`,
    html: marco(
      `Tu cancelación gratis vence ${cuando}`,
      `<p style="line-height:1.5">${esc(r.hotel)}, cancelación gratis hasta el <b>${fecha(r.cancelacion_hasta)}</b>.</p>
<p style="line-height:1.5">Hasta ahora no encontramos un precio que te ahorre lo suficiente. Seguimos mirando hasta esa fecha.</p>
<p>${boton(link, "Ver mi reserva")}</p>`,
    ),
  };
}
