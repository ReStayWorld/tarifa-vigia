# Tarifa Vigía

Web del piloto de Nuevos Emprendimientos (ORT). El viajero registra su reserva: hotel, fechas, cuánto pagó, qué día reservó y hasta cuándo tiene cancelación gratis. El sistema revisa el precio cada 48 horas y, si la misma estadía aparece al menos 5% más barata mientras todavía se puede cancelar sin costo, le manda un mail con el paso a paso para cambiar la reserva.

## Qué hay

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Viajeros | Landing y registro. El hotel se elige de una lista (país + buscador) y la habitación de las categorías que ese hotel tiene de verdad para esas fechas. `/?v=a` y `/?v=b` son el test A/B de mensajes. |
| `/r/<código>` | Viajero | Su reserva: lo que pagó, el precio de hoy de su misma categoría, días para cancelar gratis, el hotel en otras webs, historial y "¿Qué hiciste con la alerta?". |
| `/admin` | Equipo | Métricas del experimento y todas las reservas. |
| `/api/cron` | Cron | Chequea las reservas que no se revisaron en las últimas `CHECK_EVERY_HOURS` horas. |
| `/api/hoteles`, `/api/categorias` | Formulario | Buscador de hoteles y categorías de habitación. |

De dónde salen los datos:
- **LiteAPI** (gratis para consultar): catálogo mundial de hoteles y tarifas por habitación con su política de cancelación. Comparamos solo la **misma categoría** (Estándar, Superior, Deluxe, Junior Suite, Suite, Familiar, Apartamento, Villa, Compartida) y solo tarifas con **cancelación gratis**. La categoría sale del nombre de la habitación (`lib/categorias.ts`).
- **Xotelo** (gratis, sin clave): precio más barato del hotel en Agoda, Booking.com, Trip.com, etc. Se muestra como referencia. Para encontrar el hotel en Xotelo hace falta `XOTELO_RAPIDAPI_KEY`; sin ella esa sección no aparece.

Reglas:
- Alerta si la misma categoría con cancelación gratis está al menos `ALERT_MIN_PCT` (5%) más barata que lo pagado.
- No repite la alerta salvo que el precio baje al menos 2% más.
- Dos días antes de que venza la cancelación gratis manda un recordatorio (si nunca hubo alerta).
- Cuando vence la cancelación gratis, deja de vigilar la reserva.

## Probar en tu compu

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Sin claves configuradas funciona en **modo demo**: los datos se guardan en `.data/db.json`, los hoteles y las tarifas se simulan (probá con "Castelmar" en Brasil, que además trae precios reales de Xotelo) y los mails se muestran en la terminal. La clave del panel es la de `ADMIN_PASSWORD` en `.env.local`.

## Producción

Ya está en https://tarifa-vigia.vercel.app (Vercel + Supabase, cuenta ReStayWorld). Para esta versión:

1. **Supabase → SQL Editor:** correr `supabase/migracion-002-categorias.sql` una vez.
2. **LiteAPI** (liteapi.travel, con restayworld@gmail.com): copiar la clave de *API Keys*. La de prueba (*sandbox*) es gratis; la de producción pide cargar una tarjeta, pero consultar precios no se cobra.
3. **Vercel → Environment Variables:** `LITEAPI_KEY` (Secret) y `CHECK_EVERY_HOURS=2` (Config). Opcional: `XOTELO_RAPIDAPI_KEY` (Secret) y `LITEAPI_BOOKING_URL` (Config).
4. **Chequeo cada hora:** Vercel gratis corre el cron una vez por día. Para más seguido, crear una tarea en **cron-job.org** (gratis) que llame cada hora a `https://tarifa-vigia.vercel.app/api/cron` con el encabezado `Authorization: Bearer <CRON_SECRET>`.

## Límites conocidos

- Comparamos la **misma categoría**, no la habitación exacta: dos suites del mismo hotel pueden diferir en vista o camas. La alerta lo avisa.
- El precio de LiteAPI es el de LiteAPI, no el de Agoda o Booking. El de Xotelo sí es el de cada web, pero es la habitación más barata del hotel y no aclara impuestos.
- Las alertas van por mail (Gmail). WhatsApp necesita la API paga de WhatsApp Business.
- LiteAPI y la búsqueda de Xotelo por RapidAPI todavía no se probaron con claves reales.
