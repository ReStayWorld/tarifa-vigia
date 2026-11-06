# Tarifa Vigía

Web del piloto de Nuevos Emprendimientos (ORT). El viajero registra su reserva: hotel, fechas, cuánto pagó, qué día reservó y hasta cuándo tiene cancelación gratis. El sistema revisa el precio cada 48 horas y, si la misma estadía aparece al menos 5% más barata mientras todavía se puede cancelar sin costo, le manda un mail con el paso a paso para cambiar la reserva.

## Qué hay

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Viajeros | Landing y formulario de registro. `/?v=a` muestra el mensaje de ahorro y `/?v=b` el de tranquilidad (test A/B 1). |
| `/r/<código>` | Viajero | Su reserva: precio pagado y precio de hoy, cuántos días le quedan para cancelar gratis, la alerta, el historial y el formulario "¿Qué hiciste con la alerta?" (mide SH4 y SH5). Le llega por mail. |
| `/admin` | Equipo | Métricas del experimento (SH1, SH2, SH4, SH5, test A/B), todas las reservas y botones para chequear a mano. |
| `/api/cron` | Vercel | Lo llama el cron todos los días a las 9:00 de Uruguay. Chequea cada reserva que no se revisó en las últimas 48 h. |

Reglas (se cambian en las variables de entorno):
- Alerta si el ahorro llega al menos a `ALERT_MIN_PCT` (5%) y la oferta no dice que no tiene cancelación gratis.
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

Sin claves configuradas funciona en **modo demo**: los datos se guardan en `.data/db.json`, los precios se simulan (entre −18% y +8% del precio pagado) y los mails se muestran en la terminal. La clave del panel es la de `ADMIN_PASSWORD` en `.env.local`.

## Pasar a producción (todo gratis)

Las cuentas las tiene que crear una persona del equipo: Claude no crea cuentas ni maneja claves. Conviene usar una sola cuenta de Gmail del equipo para todo. Son cinco pasos de unos 5 minutos cada uno:

1. **GitHub** (github.com, gratis). Crear un repositorio privado `tarifa-vigia` y subir esta carpeta.
2. **Supabase** (supabase.com, plan Free). *New project*, región São Paulo. Abrir *SQL Editor*, pegar `supabase/schema.sql` y apretar *Run*. Copiar la *Project URL* y la *service_role key* (en *Project Settings → API*). El plan gratis pausa el proyecto si pasa una semana sin uso; el chequeo diario lo mantiene activo.
3. **SerpApi** (serpapi.com, plan Free: 250 búsquedas por mes). Copiar la *API key*. El sistema guarda el hotel después de la primera búsqueda, así que cada chequeo usa 1 búsqueda. Además corta solo al llegar a 240 en el mes, para no pasarse nunca del plan gratis.
4. **Gmail para los mails** (gratis, hasta 500 por día). En la cuenta de Google: activar la verificación en dos pasos y crear una *contraseña de aplicación* en myaccount.google.com/apppasswords.
5. **Vercel** (vercel.com, plan Hobby, entrar con GitHub). *Add New → Project*, elegir el repositorio y, antes de *Deploy*, cargar estas variables:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key de Supabase |
| `PRICE_PROVIDER` | `serpapi` |
| `SERPAPI_KEY` | API key de SerpApi |
| `GMAIL_USER` | el Gmail que manda las alertas |
| `GMAIL_APP_PASSWORD` | la contraseña de aplicación (16 letras) |
| `ADMIN_PASSWORD` | una clave fuerte para el panel del equipo |
| `CRON_SECRET` | un texto largo al azar |
| `BASE_URL` | la dirección que da Vercel, por ejemplo `https://tarifa-vigia.vercel.app` (cargarla después del primer deploy y redeployar) |

**Cuánto alcanza el plan gratis de SerpApi:** con chequeos cada 48 h, cada reserva gasta unas 15 búsquedas por mes. Las 240 búsquedas alcanzan para unas 15 reservas a la vez, que es el mínimo del piloto. Para llegar a 30 reservas, poner `CHECK_EVERY_HOURS=96` (cada 4 días) o pasar al plan pago.

## Límites conocidos

- Google Hotels da el precio más bajo del hotel para esas fechas y esa cantidad de huéspedes, pero no siempre del mismo tipo de habitación. Por eso la alerta le pide al viajero que confirme la habitación y los servicios antes de reservar. El equipo puede revisar cada caso desde el panel.
- No todas las fuentes informan la política de cancelación. Cuando no la informan, la alerta lo dice.
- Las alertas van por mail (Gmail). Para mandarlas por WhatsApp hace falta la API de WhatsApp Business (por ejemplo, con Twilio), que es paga y requiere aprobar las plantillas de mensaje.
- La integración con SerpApi está escrita pero no se probó con una clave real.
