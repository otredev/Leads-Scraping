# Leads Scraping

CRM local para encontrar negocios en Google Maps, convertirlos en clientes y enseñarles el avance de su proyecto.

Busca negocios, guárdalos como leads, contáctalos por WhatsApp o email, organiza tareas y proyectos, y comparte con cada cliente un portal privado con su progreso. Todo es modular, funciona en tu equipo y cuesta **0 €**.

| | |
|---|---|
| **Scraping** | [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) (open source) o un proveedor demo con datos ficticios |
| **Base de datos** | MongoDB (Atlas gratuito o local) o ficheros JSON si no configuras ninguna |
| **Stack** | Next.js 16, Tailwind CSS, Cloudflare Workers + D1 para el portal |
| **Extras** | Servidor MCP para Claude, notificaciones push, PWA instalable |

---

## Índice

1. [Funciones](#1-funciones)
2. [Puesta en marcha](#2-puesta-en-marcha)
   - [Requisitos](#requisitos)
   - [Instalación](#instalación)
   - [Conectar MongoDB Atlas](#conectar-mongodb-atlas)
   - [Variables de entorno](#variables-de-entorno)
3. [Guía de uso](#3-guía-de-uso)
   - [Búsquedas y resultados](#búsquedas-y-resultados)
   - [Leads (CRM)](#leads-crm)
   - [Contacto y plantillas](#contacto-y-plantillas)
   - [Tareas y calendario](#tareas-y-calendario)
   - [Completar redes y emails](#completar-redes-y-emails)
   - [Clientes y proyectos](#clientes-y-proyectos)
   - [Finanzas](#finanzas)
   - [Portal del cliente](#portal-del-cliente)
   - [Notificaciones push](#notificaciones-push)
   - [Ajustes, copias e instalación](#ajustes-copias-e-instalación)
4. [Claude (MCP)](#4-claude-mcp)
5. [Arquitectura](#5-arquitectura)
6. [Cómo ampliar](#6-cómo-ampliar)
7. [Despliegue](#7-despliegue)
8. [Hoja de ruta](#8-hoja-de-ruta)
9. [Aviso](#9-aviso)

> 💡 Dentro de la app, la página **Ayuda** tiene guías paso a paso de cada parte, con buscador.

---

## 1. Funciones

| Área | Qué puedes hacer |
|---|---|
| **Búsquedas** | Buscar negocios por texto o URL de Google Maps, con progreso en vivo, repetición y reanudación |
| **Resultados** | Filtrar, ordenar, exportar (CSV/JSON) y guardar lo que interesa como lead |
| **Leads** | CRM con tabla, lista, tablero tipo Trello y mapa; etapas, etiquetas, colores, notas y puntuación |
| **Contacto** | WhatsApp, email y llamadas con plantillas; historial de contacto y lista "no contactar" (RGPD) |
| **Tareas** | Seguimientos con fecha opcional, calendario mensual/semanal y avisos push |
| **Enriquecer** | Completar redes sociales, emails y teléfono desde la web de cada negocio |
| **Clientes** | Proyectos con cronograma, tareas, presupuesto, pagos y horas |
| **Finanzas** | Gastos, beneficio neto por cliente, retorno por canal de captación y rentabilidad por sector o ciudad |
| **Portal** | Enlace privado donde el cliente ve el avance, con páginas legales generadas |
| **Claude** | Manejar el CRM hablando, vía MCP, y crear la página del negocio en Otrelink |
| **Ayuda** | Documentación integrada con buscador, sin conexión |

---

## 2. Puesta en marcha

### Requisitos

| Herramienta | Para qué | Gratis |
|---|---|---|
| Node.js 20+ | La app | Sí |
| Docker Desktop | Ejecutar gosom | Sí (uso personal) |

> Sin Docker puedes descargar el binario de gosom para Windows desde sus [releases](https://github.com/gosom/google-maps-scraper/releases) y lanzarlo con `google-maps-scraper.exe -data-folder gmapsdata`.

### Instalación

```bash
npm install
cp .env.example .env.local      # en Windows: copy .env.example .env.local
docker compose up -d            # gosom en http://localhost:8080
npm run dev                     # la app en http://localhost:3000
```

En el formulario de búsqueda, el punto verde junto a "Proveedor" confirma que la app ve a gosom.

### Conectar MongoDB Atlas

1. En `.env.local`, pon tu cadena de conexión con la contraseña del usuario:
   ```
   MONGODB_URI=mongodb+srv://usuario:CONTRASEÑA@cluster.xxxxx.mongodb.net/
   ```
   Si la contraseña tiene caracteres especiales (`@ : / ? # [ ] %`), codifícalos (`@` → `%40`).
2. En Atlas → **Network Access**, añade tu IP (o `0.0.0.0/0`).
3. Reinicia la app. En **Ajustes** verás "MongoDB · Conectada". Si tenías datos en `data/`, pulsa **Importar datos locales**.

Las colecciones y sus índices se crean solos en la base `leads_scraping`.

### Variables de entorno

Todas son opcionales. Van en `.env.local`.

<details>
<summary><b>Ver todas las variables</b></summary>

| Variable | Para qué | Por defecto |
|---|---|---|
| `GOSOM_URL` | API de gosom | `http://localhost:8080` |
| `MONGODB_URI` | Conexión a MongoDB (si existe, se usa MongoDB) | — |
| `MONGODB_DB` | Nombre de la base de datos | `leads_scraping` |
| `STORAGE` | Forzar almacenamiento: `mongodb` o `json-file` | MongoDB si hay `MONGODB_URI` |
| `DATA_DIR` | Carpeta del almacenamiento `json-file` | `./data` |
| `DEFAULT_COUNTRY` | País para teléfonos sin prefijo (ISO, 2 letras) | `ES` |
| `TRASH_DAYS` | Días que un lead pasa en la papelera | `30` |
| `TZ` | Zona horaria de avisos y portal (p. ej. `Europe/Madrid`) | la del sistema |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Claves push (si faltan, se generan solas) | — |
| `VAPID_SUBJECT` | Contacto para los servicios push | `mailto:avisos@leads-scraping.example` |
| `REMINDERS` | `off` desactiva los recordatorios en segundo plano | activados |
| `ENRICH_ALLOW_LOCAL` | `1` deja al enriquecedor visitar direcciones locales (pruebas) | — |
| `PORTAL_URL` / `PORTAL_SECRET` | Dirección y secreto del portal del cliente | — |
| `MCP_TOKEN` | Token del servidor MCP (sin él, solo acepta este equipo) | — |

</details>

---

## 3. Guía de uso

### Búsquedas y resultados

1. Escribe una búsqueda por línea (`dentistas en Valencia`) o **pega una URL de Google Maps** con la zona y filtros que ya tengas (también fichas y enlaces `maps.app.goo.gl`).
2. En **Opciones avanzadas** ajusta idioma, país de los teléfonos, límite, profundidad, tiempo máximo, emails y reseñas.
3. En **Resultados** filtra, ordena por cualquier columna y despliega una fila para ver horario y reseñas.
4. **Guarda** lo que te interese (uno a uno o "Guardar N visibles").
5. **Exportar** descarga lo que ves, en el mismo orden: CSV (coma, o punto y coma para Excel en español) o JSON.

> ⏱️ Cada búsqueda tarda **al menos 3 minutos**: gosom abre un navegador real. "Buscar emails" la hace más lenta. Puedes cerrar la pestaña; si reinicias la app, se reanuda sola.
>
> ✉️ Google Maps no publica emails: solo aparecen si gosom o el enriquecedor los encuentran en la web del negocio.

### Leads (CRM)

Tus leads guardados, separados de los resultados: borrar una búsqueda no borra tus leads, y volver a guardar un negocio actualiza sus datos sin tocar tu trabajo.

- **Vistas:** tabla, lista por etapa, tablero (arrastra entre etapas) y **mapa** (OpenStreetMap, coloreado por etapa).
- **Ficha:** etapa, color, etiquetas, notas, "no contactar", contacto, tareas y página web.
- **Etapas y etiquetas** configurables. Las etiquetas automáticas "Sin web", "Sin contacto" y "Valoración baja" se calculan solas.
- **Puntuación 0–100** según contacto, valoración y reseñas (`src/core/score.ts`).
- **Acciones masivas:** etapa, etiquetas, color, "no contactar", completar datos o papelera.
- **Importar CSV** con detección de columnas; los repetidos se combinan.
- **Actualizar datos:** vuelve a extraer la ficha de Google sin tocar etapa, etiquetas ni notas.
- **Filtros predeterminados** y columnas configurables que se recuerdan.
- **Papelera:** se restaura o se vacía sola a los 30 días.
- **Teléfonos** normalizados en formato internacional y E.164 (para WhatsApp).

### Contacto y plantillas

- Desde la ficha: **WhatsApp** o **email** con plantilla rellenada, **llamar** o copiar. Cada acción queda en el historial y actualiza "Último contacto".
- **Plantillas** en Ajustes, con vista previa y variables: `{nombre}` `{categoria}` `{direccion}` `{telefono}` `{email}` `{web}` `{valoracion}` `{resenas}` `{etapa}`.
- **No contactar (RGPD):** con motivo; se ocultan, no se exportan y tienen los botones desactivados.

### Tareas y calendario

- Tareas de un lead, un cliente o un proyecto. **La fecha es opcional** y se puede poner, cambiar o quitar después.
- La página **Tareas** las agrupa en vencidas, hoy, próximas y sin fecha.
- El **Calendario** las muestra por mes o semana junto a los hitos de proyectos. Arrastra para cambiar de día o para programar las "sin fecha".
- Cada tarea se puede añadir a Google Calendar o descargar como `.ics`.

### Completar redes y emails

Selecciona leads → **Completar redes y emails** (o el botón de la ficha). La app visita la web de cada negocio (portada y hasta 3 páginas de contacto) y añade redes sociales, emails y teléfono. **Nunca borra datos.** Hay columna **Redes** y filtro **Con redes**.

<details>
<summary><b>Otros proveedores que se pueden añadir</b> (condiciones de octubre de 2026)</summary>

| Proveedor | Qué aporta | Coste | Encaje |
|---|---|---|---|
| **Web del negocio** (incluido) | Redes, emails y teléfono | Gratis, sin límites | Cubre la mayoría de negocios con web |
| **Apify** | Emails, teléfonos y redes | $5 gratis al mes | Webs con JavaScript o que bloquean |
| **Outscraper** | Emails y contactos por dominio | 500 registros gratis / 30 días | Lotes grandes |
| **Hunter.io** | Emails de personas, verificados | 50 créditos gratis al mes | Llegar al responsable |
| **Google Places API** | Datos oficiales de Google | Cupos mensuales gratis | Refrescar sin scraper; sin redes |

Ninguna red social ofrece una API gratuita para buscar un negocio por nombre: lo más fiable es leer los enlaces de su propia web.

</details>

### Clientes y proyectos

- **Crea un cliente** a mano o **convierte un lead** ("Convertir en cliente" en su ficha). El lead pasa a tu última etapa.
- **Proyectos** con estado, fechas y descripción.
- **Cronograma** de hitos: al completarlos avanza el %. Los retrasados salen en rojo y aparecen en el Calendario.
- **Presupuesto y pagos**, con lo pendiente de cobro.
- **Horas** (`1:30`, `1,5` o `90m`), con total y coste si indicas precio por hora.
- Cada hito y tarea tiene la marca **visible para el cliente** (el ojo): es lo único que llega a su portal.

### Finanzas

Cuánto ganas de verdad, qué clientes te compensan y dónde invertir para conseguir más.

- **Ingresos:** los pagos registrados en los proyectos (en la fecha de cobro).
- **Gastos** de tres tipos: **de un cliente** (colaboradores, licencias), **generales** (software, gestoría; se reparten entre clientes según lo que paga cada uno) y **de captación** (proxies, anuncios; se reparten entre los clientes de ese canal). Pueden repetirse cada mes o cada año.
- **Tus horas** cuentan como coste al precio que indiques en Finanzas → Ajustes. En proyectos a precio cerrado puedes desactivarlo.
- **Pestañas:** Resumen (ingresos y gastos por mes, cuenta de resultados, recomendaciones), Clientes (beneficio neto, margen y € por hora), Gastos e Inversión (retorno y coste por cliente o lead de cada canal, rentabilidad por sector, ciudad o canal, y peso de los gastos recurrentes).
- Cada cliente tiene **canal de captación** y **sector**; los que vienen de un lead toman "Google Maps" y su categoría.
- La ficha del cliente muestra su **rentabilidad** y sus gastos.

Importes sin IVA, en una sola moneda (la de Finanzas).

### Portal del cliente

Una web aparte en Cloudflare (gratis) donde cada cliente, con su **enlace privado**, ve el avance de sus proyectos: porcentaje, próxima entrega, cronograma, tareas y, si lo activas, presupuesto y pagos.

1. Despliega `portal/` una vez: pasos en [`portal/README.md`](portal/README.md).
2. Añade `PORTAL_URL` y `PORTAL_SECRET` a `.env.local`.
3. En **Ajustes → Portal del cliente** pon tu marca, contacto y **datos legales**.
4. En la ficha del cliente, pulsa **Activar portal** y envíale el enlace.

- **Se actualiza solo** unos segundos después de cada cambio (mientras la app esté encendida).
- Puedes ver cuándo lo abrió, **renovar** el enlace o **desactivarlo**.
- **Páginas legales** (aviso legal, privacidad y cookies) generadas con tus datos y enlazadas en el pie. Son plantillas orientativas para España: revísalas con un profesional.
- Tu CRM, notas y horas **nunca salen de tu equipo**: solo se envía lo marcado como visible.

### Notificaciones push

Actívalas en **Ajustes → Notificaciones push** en cada dispositivo. El servidor revisa las tareas cada minuto y avisa cuando vence una, aunque la app esté cerrada.

- Gratis, con Web Push y claves VAPID que se generan solas.
- **El servidor tiene que estar encendido.** Solo avisa de lo que venció hace menos de una hora.
- En el móvil hace falta la app desplegada con HTTPS (en iPhone, además, instalada en inicio). En Brave, activa "Usar los servicios de Google para mensajería push".

### Ajustes, copias e instalación

- **Copia de seguridad:** descarga un JSON con todo; al restaurar solo se añade lo que falta. Sirve para migrar entre MongoDB y ficheros locales.
- **Instalar como app (PWA):** icono de instalar en Chrome o Edge, o Ajustes → Instalar la app.
- **Tema** claro, oscuro o del sistema. Los colores están en variables al principio de `src/app/globals.css`.
- **Ayuda:** las guías son Markdown en `src/content/docs/`. Crea un `.md` (con `title`, `description` y `order`) y aparece solo en `/ayuda/<nombre>`.

---

## 4. Claude (MCP)

La app incluye un servidor [MCP](https://modelcontextprotocol.io) en `http://localhost:3000/api/mcp` para manejar el CRM hablando:

> *"Busca fisioterapeutas en Sevilla y guarda los que no tienen web"* · *"¿Qué tareas tengo hoy?"* · *"Prepárame un WhatsApp para Óptica Norte"*

En **Ajustes → Claude (MCP)** tienes los comandos listos para copiar.

| Cliente | Cómo conectarlo |
|---|---|
| **Claude Code** | Abre la carpeta del proyecto (trae `.mcp.json`) o: `claude mcp add --transport http leads-scraping http://localhost:3000/api/mcp` |
| **Claude Desktop** | Ajustes → Desarrollador → Editar configuración (ver abajo) |
| **claude.ai** | Necesita la app desplegada con HTTPS y `MCP_TOKEN`: conector con `https://tu-dominio/api/mcp?token=TU_TOKEN` |

```json
{ "mcpServers": { "leads-scraping": { "command": "npx", "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"] } } }
```

<details>
<summary><b>Herramientas disponibles</b></summary>

| Herramienta | Qué hace |
|---|---|
| `get_overview` | Métricas, embudo, etapas, etiquetas, plantillas y tareas |
| `list_leads` / `get_lead` | Buscar leads y ver su ficha |
| `update_lead` / `trash_leads` | Etapa, color, etiquetas, notas, "no contactar"; papelera |
| `enrich_leads` / `get_enrich_job` | Completar redes, emails y teléfono |
| `start_search` / `get_search` / `list_searches` | Lanzar búsquedas y seguir su progreso |
| `list_results` / `save_results` | Ver lo encontrado y guardarlo |
| `list_tasks` / `create_task` / `update_task` / `complete_task` | Tareas de leads, clientes o proyectos |
| `list_clients` / `get_client` / `create_client` | Clientes y resumen de sus proyectos |
| `create_project` / `update_project` | Estado, hitos, pagos y horas |
| `get_finances` / `list_expenses` / `add_expense` | Rentabilidad por cliente, canal y segmento; registrar gastos |
| `draft_message` / `log_contact` | Rellenar una plantilla y registrar el contacto |
| `otrelink_brief` / `set_lead_page` | Preparar la página del negocio en Otrelink |

</details>

- Claude **no envía mensajes**: `draft_message` devuelve el texto y el enlace, y respeta "no contactar".
- **Seguridad:** sin `MCP_TOKEN` solo responde a `localhost` (comprueba `Host` y `Origin`). Con él, exige `Authorization: Bearer <token>` o `?token=`.
- **Otrelink:** en la ficha, **Página web → Copiar para Claude** genera un encargo con los datos del negocio y una plantilla según su categoría. Claude crea la página en borrador y guarda el enlace en el lead.

---

## 5. Arquitectura

```
src/
├── core/               Contratos y lógica pura, sin dependencias de módulos
│   ├── lead.ts         Modelo Lead normalizado
│   ├── fields.ts       Campos → columnas de tabla y exportación
│   ├── query.ts        Filtros y orden
│   ├── provider.ts     Interfaces de fuentes y proveedores
│   ├── exporter.ts     Interfaz de exportadores
│   ├── storage.ts      Interfaz LeadStore
│   ├── enricher.ts     Interfaz de enriquecedores
│   ├── notifier.ts     Interfaz de canales de aviso
│   ├── crm.ts          Etapas, etiquetas, ajustes
│   ├── clients.ts      Clientes, proyectos, hitos, pagos y horas
│   ├── portal.ts       Lo que se publica en el portal
│   ├── finance.ts      Gastos y cálculo de rentabilidad
│   └── …               score, templates, calendar, socials, phone, otrelink, stats
├── modules/            Implementaciones intercambiables
│   ├── index.ts        ⭐ Registro: el único sitio donde se conectan
│   ├── sources/        google-maps
│   ├── providers/      gosom, demo
│   ├── exporters/      csv, json
│   ├── storage/        mongodb, json-file
│   ├── enrichers/      website-contacts
│   └── notifiers/      web-push
├── server/             Lógica de servidor: runner, crm, tasks, clients, finance,
│   │                   portal, enrich, reminders, notifications, docs
│   └── mcp/            Servidor MCP para Claude
├── app/                Páginas y API REST (app/api/*)
├── components/         UI por sección: shell, pages, leads, clients, tasks,
│                       finance, calendar, settings, help, notifications, charts, ui
├── content/docs/       Guías de la página Ayuda (Markdown)
├── lib/                Tema y PWA
└── instrumentation.ts  Arranca los recordatorios
public/sw.js            Service worker (sin conexión y push)
portal/                 Portal del cliente (Cloudflare Workers + D1)
```

**Fuente ≠ proveedor.** La *fuente* es de dónde salen los datos (Google Maps, Páginas Amarillas…); el *proveedor* es la herramienta que los extrae (gosom, Apify…). Todos devuelven el mismo `Lead`.

```
Formulario ─► POST /api/searches ─► runner ─► provider.run(params, ctx)
                                                │  ctx.emit(leads)     → deduplica y guarda
                                                │  ctx.progress(...)   → barra de progreso
                                                │  ctx.saveCheckpoint  → permite reanudar
Tabla ◄── GET /api/leads ◄──────────────────────┘
Exportar ─► GET /api/export?format=csv&<filtros> ─► Exporter
```

---

## 6. Cómo ampliar

Siempre son dos pasos: **crear el módulo** y **registrarlo** en `src/modules/index.ts`. La API, los formularios y la tabla se adaptan solos.

| Quiero añadir… | Dónde | Plantilla |
|---|---|---|
| Un proveedor (Apify, Google Places…) | `src/modules/providers/` con `defineProvider` | `providers/demo` |
| Una fuente (Páginas Amarillas…) | `src/modules/sources/` con `defineSource` | `sources/google-maps.ts` |
| Un formato de exportación (Excel…) | `src/modules/exporters/` con `defineExporter` | `exporters/csv.ts` |
| Un almacenamiento (SQLite, Postgres…) | `src/modules/storage/` implementando `LeadStore`; elígelo con `STORAGE=<id>` | `storage/mongodb.ts` |
| Un enriquecedor (Hunter, Apify…) | `src/modules/enrichers/` con `defineEnricher` | `enrichers/website-contacts` |
| Un canal de aviso (Telegram, email…) | `src/modules/notifiers/` con `defineNotifier` | `notifiers/web-push` |
| Un campo del lead | `Lead` en `core/lead.ts` + `LEAD_FIELDS` en `core/fields.ts` | — |

<details>
<summary><b>Ejemplo: un proveedor nuevo</b></summary>

```ts
// src/modules/providers/mi-proveedor/index.ts
import { defineProvider } from "@/core/provider";

export default defineProvider({
  id: "mi-proveedor",
  name: "Mi proveedor",
  description: "Qué hace y qué necesita.",
  sourceId: "google-maps",
  options: [{ key: "maxResults", label: "Máx. resultados", type: "number", default: 100, min: 1 }],
  async health() {
    return process.env.MI_API_KEY ? { ok: true, message: "Listo" } : { ok: false, message: "Falta MI_API_KEY en .env.local" };
  },
  async run(params, ctx) {
    for (const query of params.queries) {
      if (ctx.signal.aborted) return;
      const results = await buscarEnMiApi(query, params.options.maxResults);
      await ctx.emit(results.map((r) => ({ name: r.title, phone: r.tel })));
      ctx.progress({ message: `Procesada "${query}"` });
    }
  },
});
```

```ts
// src/modules/index.ts
import miProveedor from "./providers/mi-proveedor";
export const providers = [gosom, demo, miProveedor];
```

</details>

<details>
<summary><b>Detalles de cada tipo de módulo</b></summary>

- **Campo nuevo:** mientras no esté en el modelo, cualquier dato extra del proveedor se guarda en `lead.extra` y no se pierde.
- **Enriquecedor:** `canEnrich(lead)` dice si se puede intentar; `enrich(lead)` devuelve `{ emails, socials, phone, website, extra, note }`. La app lo fusiona sin borrar nada y lo muestra en Ajustes, en "Completar redes y emails" y en el MCP.
- **Canal de aviso:** `send(mensaje)`, `subscribe`/`unsubscribe`/`listSubscribers` y `health()`. Recibe `getMeta`/`setMeta` para guardar claves en cualquier almacenamiento.
- **Almacenamiento:** la copia de seguridad y la importación funcionan entre cualquier implementación.

</details>

---

## 7. Despliegue

La app está pensada para uso local. Para desplegarla en un servidor:

| Pieza | Qué tener en cuenta |
|---|---|
| **Almacenamiento** | Usa MongoDB Atlas (`json-file` no sirve en serverless) |
| **Búsquedas y recordatorios** | Viven en el proceso de Next.js: funciona en un servidor tradicional (VPS, Railway, Fly.io, Docker). En serverless habría que usar una cola y un cron |
| **gosom** | Necesita una máquina con Docker |
| **HTTPS** | Necesario para push en el móvil, instalar la PWA y conectar claude.ai |
| **Portal** | Ya va aparte en Cloudflare: ver [`portal/README.md`](portal/README.md) |

---

## 8. Hoja de ruta

- [ ] Login y multiusuario
- [ ] Chatbot
- [ ] Búsquedas automáticas

---

## 9. Aviso

Hacer scraping de Google Maps va en contra de sus Términos de Servicio. Úsalo con moderación y para prospección propia, y respeta el RGPD al contactar con los leads. La página **Ayuda → Buenas prácticas legales** resume lo básico.
