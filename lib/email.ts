import "server-only";
import { BASE_URL, BRAND } from "./config";
import { fecha, plata } from "./format";
import type { Reserva } from "./types";

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
<p style="line-height:1.5">Revisamos el precio cada 48 horas. Si aparece la misma estadía más barata antes del <b>${fecha(r.cancelacion_hasta)}</b> (tu último día de cancelación gratis), te escribimos.</p>
<p>${boton(link, "Ver mi reserva")}</p>
<p style="font-size:13px;color:#4d6b65">Guardá este mail: el botón es tu acceso a la reserva.</p>`,
    ),
  };
}

export function mailAlerta(r: Reserva, precio: number, fuente: string | null, linkOferta: string | null, cancelacionGratis: boolean | null): Mail {
  const ahorro = r.precio_pagado - precio;
  const pct = Math.round((ahorro / r.precio_pagado) * 100);
  const link = `${BASE_URL}/r/${r.token}`;
  const cancel =
    cancelacionGratis === true
      ? `Cancelación gratis`
      : `Verificá la política de cancelación antes de reservar`;
  const fila = (a: string, b: string, c: string) =>
    `<tr><td style="padding:8px;border-top:1px solid #dfe7e5;color:#4d6b65">${a}</td><td style="padding:8px;border-top:1px solid #dfe7e5">${b}</td><td style="padding:8px;border-top:1px solid #dfe7e5"><b>${c}</b></td></tr>`;
  return {
    to: r.email,
    subject: `Bajó tu hotel: ahorrá ${plata(ahorro, r.moneda)} en ${r.hotel}`,
    text: `Encontramos un precio menor para tu reserva en ${r.hotel}, del ${fecha(r.check_in)} al ${fecha(r.check_out)}: pagaste ${plata(r.precio_pagado, r.moneda)} y hoy figura a ${plata(precio, r.moneda)}${fuente ? ` en ${fuente}` : ""} (ahorro de ${plata(ahorro, r.moneda)}, ${pct}%). Podés cancelar sin costo hasta el ${fecha(r.cancelacion_hasta)}. Cómo cambiar: 1) reservá la nueva opción; 2) confirmá que quedó confirmada; 3) cancelá la reserva anterior antes del ${fecha(r.cancelacion_hasta)}. Ver oferta: ${linkOferta ?? link}. Tu reserva: ${link}. La decisión es tuya.`,
    html: marco(
      `Bajó el precio: podés ahorrar ${plata(ahorro, r.moneda)} (${pct}%)`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">
<tr><td></td><td style="padding:8px;color:#4d6b65">Tu reserva</td><td style="padding:8px;color:#4d6b65">Opción encontrada</td></tr>
${fila("Hotel y fechas", `${esc(r.hotel)}, ${fecha(r.check_in)}–${fecha(r.check_out)}`, "Mismas")}
${fila("Habitación", esc(r.habitacion), "Misma búsqueda")}
${fila("Cancelación", `Gratis hasta el ${fecha(r.cancelacion_hasta)}`, cancel)}
${fila("Dónde", esc(r.plataforma), esc(fuente ?? "—"))}
${fila("Precio total", plata(r.precio_pagado, r.moneda), plata(precio, r.moneda))}
</table>
<p style="line-height:1.5"><b>Cómo cambiar:</b> (1) reservá la nueva opción; (2) confirmá que la reserva quedó confirmada; (3) cancelá la reserva anterior antes del <b>${fecha(r.cancelacion_hasta)}</b>.</p>
<p style="line-height:1.5;font-size:13px;color:#4d6b65">Antes de reservar, revisá que sea el mismo tipo de habitación y los mismos servicios.</p>
<p>${linkOferta ? boton(linkOferta, "Ver la oferta") : ""} &nbsp; <a href="${link}" style="color:#13302b">Contanos qué hiciste</a></p>`,
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
