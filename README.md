# Leads Scraping

Dashboard local para extraer leads de negocios de Google Maps, filtrarlos, ordenarlos y exportarlos a CSV.
Todo es modular: fuentes, proveedores de scraping, formatos de exportación y almacenamiento se añaden como módulos independientes.

- **Datos por lead:** nombre, categoría, email(s), teléfono, web, dirección, valoración, nº de reseñas, reseñas, horario, coordenadas y enlace a la ficha.
- **Proveedor actual:** [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) (open source y gratuito).
- **Proveedor demo:** genera datos ficticios para probar la app sin levantar nada.
- **Base de datos:** MongoDB (Atlas gratuito o local), o ficheros JSON locales si no configuras ninguna.
- **Coste:** 0 €. No hay APIs de pago ni tarjetas.

---

## Requisitos

| Herramienta | Para qué | Gratis |
|---|---|---|
| Node.js 20+ | La app Next.js | Sí |
| Docker Desktop | Ejecutar gosom | Sí (uso personal) |

> Sin Docker también puedes descargar el binario de gosom para Windows desde sus [releases](https://github.com/gosom/google-maps-scraper/releases) y lanzarlo con `google-maps-scraper.exe -data-folder gmapsdata`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local      # en Windows: copy .env.example .env.local
docker compose up -d            # levanta gosom en http://localhost:8080
npm run dev                     # abre http://localhost:3000
```

### Conectar MongoDB Atlas

1. En `.env.local`, pon tu cadena de conexión sustituyendo `<db_password>` por la contraseña del usuario de base de datos:
   ```
   MONGODB_URI=mongodb+srv://usuario:CONTRASEÑA@cluster.xxxxx.mongodb.net/
   ```
   Si la contraseña tiene caracteres especiales (`@ : / ? # [ ] %`), codifícalos (por ejemplo `@` → `%40`).
2. En Atlas → **Network Access**, añade tu IP (o `0.0.0.0/0` para permitir cualquiera).
3. Reinicia `npm run dev`. En **Ajustes** verás "MongoDB · Conectada". Si tenías datos locales en `data/`, pulsa **Importar datos locales**.

Las colecciones (`searches`, `results`, `leads`, `settings`) y sus índices se crean solos en la base `leads_scraping` (cámbiala con `MONGODB_DB`).

### Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `GOSOM_URL` | REST API de gosom | `http://localhost:8080` |
| `MONGODB_URI` | Conexión a MongoDB. Si existe, se usa MongoDB | — |
| `MONGODB_DB` | Nombre de la base de datos | `leads_scraping` |
| `STORAGE` | Forzar almacenamiento: `mongodb` o `json-file` | MongoDB si hay `MONGODB_URI` |
| `DATA_DIR` | Carpeta del almacenamiento `json-file` | `./data` |
| `DEFAULT_COUNTRY` | País para teléfonos sin prefijo (ISO, 2 letras) | `ES` |
| `TRASH_DAYS` | Días que un lead pasa en la papelera | `30` |

En el formulario, el punto verde junto a "Proveedor" confirma que la app ve a gosom. Si está en rojo, gosom no está levantado.

**Tiempos:** gosom abre un navegador real y recorre Google Maps, así que cada búsqueda tarda **al menos 3 minutos**. Activar "Buscar emails" lo hace más lento porque visita la web de cada negocio. Puedes cerrar la pestaña: la búsqueda sigue, y si reinicias la app se reanuda sola.

## Interfaz

- **Panel:** negocios encontrados, leads guardados, % con email y teléfono, extraídos por día, cobertura de contacto, categorías, valoraciones, búsquedas recientes y mejor valorados.
- **Búsquedas:** formulario de nueva búsqueda e historial guardado, con progreso en vivo y botón para **repetir** cualquier búsqueda.
- **Resultados:** lo que devuelven las búsquedas. Filtra, ordena, exporta y **guarda** una fila (icono de marcador) o **todos los visibles** del filtro actual.
- **Leads:** tus leads guardados (el CRM), en tres vistas: **Tabla**, **Lista** agrupada por etapa y **Tablero** tipo Trello (arrastra tarjetas entre etapas, o usa su menú ⋯). Al pulsar un lead se abre su **ficha**: etapa, color, etiquetas, notas y "no contactar". Separados de los resultados: borrar una búsqueda no borra tus leads, y guardar otra vez el mismo negocio actualiza sus datos sin tocar tu trabajo.
- **Etapas, etiquetas y colores:** etapas configurables (por defecto Desinteresados, Leads, Interesados, Clientes), etiquetas propias con color, y un color por lead. Se gestionan en Ajustes o al vuelo.
- **Etiquetas automáticas:** "Sin web", "Sin contacto" y "Valoración baja" se calculan solas y sirven para filtrar (también en Resultados).
- **Puntuación (0–100):** según datos de contacto, valoración y nº de reseñas. Columna ordenable y filtro "Puntuación 40+/60+/80+". La fórmula está en `src/core/score.ts`.
- **Acciones masivas:** selecciona filas (o "todos los filtrados") y cambia etapa, añade/quita etiquetas, color, "no contactar" o envía a la papelera. En Resultados, guarda la selección.
- **No contactar (RGPD):** marca con motivo a quien pide no ser contactado. Se ocultan por defecto (y por tanto no se exportan) y se avisa en Resultados si vuelve a aparecer.
- **Filtros predeterminados y columnas:** "Fijar como predeterminados" guarda los filtros y el orden actuales; "Restablecer" vuelve a ellos. El orden y la visibilidad de columnas se guardan solos (menú Columnas).
- **Papelera:** los leads borrados se pueden restaurar; se eliminan solos a los 30 días (`TRASH_DAYS`).
- **Ajustes:** estado de la base de datos, **copia de seguridad** (descargar / restaurar JSON), importación de datos locales y módulos conectados.
- **Teléfonos normalizados:** se guardan en formato internacional (`+34 963 00 00 00`) y E.164 (`+34963000000`) para WhatsApp. El país se elige en cada búsqueda.
- **Tema claro, oscuro o del sistema:** monocromo (blanco, grises y negro). Selector en la barra lateral (en móvil, botón de la cabecera). Se recuerda entre visitas.
- **Skeletons de carga:** cada sección muestra su silueta mientras llegan los datos (`Skeleton`, `StatCardSkeleton`, `ChartSkeleton`, `RowsSkeleton`… en `src/components/ui`).

### Personalizar el tema

Todos los colores están en variables al principio de `src/app/globals.css` (un bloque para claro y otro para oscuro). Los componentes usan clases de Tailwind basadas en esas variables (`bg-surface`, `text-fg`, `border-line`, `text-primary`…), así que cambiar cualquier color (o volver a añadir un acento de color en `--primary` y `--chart`) se hace en un solo sitio.

## Uso

1. Escribe una búsqueda por línea, como en Google Maps (`dentistas en Valencia`).
2. En "Opciones avanzadas" ajusta idioma, país de los teléfonos, límite de resultados, profundidad, tiempo máximo, emails y reseñas ampliadas.
3. Al terminar, en **Resultados** filtra (texto, categoría, valoración, nº de reseñas, con email/teléfono/web), ordena por cualquier columna haciendo clic en su cabecera y despliega una fila para ver el horario y las reseñas.
4. Guarda los que te interesen (uno a uno o "Guardar N visibles") y trabájalos en **Leads**.
5. **Exportar** descarga exactamente lo que ves filtrado y en el mismo orden: CSV (con coma, o con punto y coma para Excel en español) o JSON. Funciona igual en Resultados y en Leads.

**Copias de seguridad:** en Ajustes → "Descargar copia" obtienes un JSON con todo (búsquedas, resultados y leads, incluida la papelera). "Restaurar desde archivo" solo añade lo que falte, nunca sobrescribe. El formato es el mismo con MongoDB o con ficheros locales, así que también sirve para migrar entre ellos.

> **Email:** Google Maps no publica emails. Solo aparecen si gosom los encuentra en la web del negocio.

---

## Arquitectura

```
src/
├── core/                    Contratos y lógica pura (no dependen de ningún módulo)
│   ├── lead.ts              Modelo Lead normalizado
│   ├── fields.ts            Catálogo de campos → columnas de la tabla y de la exportación
│   ├── query.ts             Filtros y orden (compartidos por la tabla y la exportación)
│   ├── provider.ts          Interfaces SourceDefinition, LeadProvider, RunContext
│   ├── exporter.ts          Interfaz Exporter
│   ├── storage.ts           Interfaz LeadStore
│   ├── options.ts           Esquema declarativo de opciones → formularios automáticos
│   ├── stats.ts             Métricas del panel
│   ├── crm.ts               Etapas, etiquetas, colores, notas, no contactar, preferencias
│   ├── score.ts             Puntuación y etiquetas automáticas
│   ├── phone.ts             Normalización de teléfonos (libphonenumber)
│   └── search.ts            Búsqueda (trabajo) y sus estados
├── modules/                 Implementaciones intercambiables
│   ├── index.ts             ⭐ REGISTRO: el único sitio donde se conectan los módulos
│   ├── sources/             google-maps
│   ├── providers/           gosom/, demo/
│   ├── exporters/           csv, json
│   └── storage/             json-file, mongodb
├── server/
│   ├── registry.ts          Búsqueda de módulos e instancia del almacenamiento
│   ├── crm.ts               Guardar resultados como leads, papelera
│   └── runner.ts            Ejecuta búsquedas en segundo plano, guarda, cancela y reanuda
├── app/api/                 REST: modules, searches, results, leads, export, stats, backup, settings
├── components/
│   ├── shell/               Barra lateral, cabecera móvil y selector de tema
│   ├── pages/               Panel, Búsquedas, Resultados, Leads, Papelera, Ajustes
│   ├── leads/               Tabla, lista, tablero, ficha, barra de acciones y filtros
│   ├── settings/            Gestión de etapas y etiquetas
│   ├── charts/              Gráficos ligeros en HTML/CSS (sin librerías)
│   ├── ui/                  Tarjetas, métricas, insignias de estado…
│   └── data/                Estado compartido (módulos y búsquedas)
└── lib/theme.ts             Lógica del tema claro/oscuro
```

**Fuente y proveedor no son lo mismo.** Una *fuente* es de dónde salen los datos (Google Maps, Yelp, Páginas Amarillas…). Un *proveedor* es la herramienta que los extrae (gosom, Apify, la API oficial de Google…). Una fuente puede tener varios proveedores, y todos devuelven el mismo `Lead`.

### Flujo

```
Formulario ─► POST /api/searches ─► runner ─► provider.run(params, ctx)
                                                │  ctx.emit(leads)    → deduplica y guarda (LeadStore)
                                                │  ctx.progress(...)  → barra de progreso
                                                │  ctx.saveCheckpoint → permite reanudar
Tabla ◄── GET /api/leads ◄──────────────────────┘
Exportar ─► GET /api/export?format=csv&<filtros> ─► Exporter
```

## Cómo ampliar

En todos los casos son dos pasos: crear el módulo y añadir una línea en `src/modules/index.ts`. La API, el formulario y la tabla se adaptan solos.

### Nuevo proveedor (p. ej. Apify o la API de Google Places)

```ts
// src/modules/providers/mi-proveedor/index.ts
import { defineProvider } from "@/core/provider";

export default defineProvider({
  id: "mi-proveedor",
  name: "Mi proveedor",
  description: "Qué hace y qué necesita.",
  sourceId: "google-maps",                    // o una fuente nueva
  options: [                                  // se convierten en campos del formulario
    { key: "maxResults", label: "Máx. resultados", type: "number", default: 100, min: 1 },
  ],
  async health() {
    return process.env.MI_API_KEY
      ? { ok: true, message: "Listo" }
      : { ok: false, message: "Falta MI_API_KEY en .env.local" };
  },
  async run(params, ctx) {
    for (const query of params.queries) {
      if (ctx.signal.aborted) return;
      const results = await buscarEnMiApi(query, params.options.maxResults);
      await ctx.emit(results.map(r => ({ name: r.title, phone: r.tel /* … */ })));
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

El proveedor `demo` (`src/modules/providers/demo`) sirve de plantilla mínima.

### Nueva fuente (p. ej. Páginas Amarillas)

Crea `src/modules/sources/paginas-amarillas.ts` con `defineSource({ id, name, description })`, regístrala y apunta a ella con `sourceId` desde su proveedor.

### Nuevo formato de exportación (p. ej. Excel)

Crea `src/modules/exporters/xlsx.ts` con `defineExporter({ id, label, extension, mimeType, options, export(leads, fields, opts) })` y regístralo. Aparece solo en el menú Exportar.

### Nuevo campo del lead

1. Añádelo (opcional) a `Lead` en `src/core/lead.ts`.
2. Añade su entrada en `LEAD_FIELDS` (`src/core/fields.ts`). Así aparece como columna y en las exportaciones.
3. Rellénalo en el mapper de los proveedores que lo tengan. Mientras tanto, cualquier dato extra del proveedor se guarda en `lead.extra` y no se pierde (gosom ya guarda ahí estado, precio, plus code, etc.).

### Otro almacenamiento (SQLite, Postgres, Supabase…)

Implementa `LeadStore` (`src/core/storage.ts`) en `src/modules/storage/`, regístralo en `storages` y selecciónalo con `STORAGE=<id>` en `.env.local`. Hay dos implementaciones de referencia: `mongodb.ts` y `json-file.ts`. La copia de seguridad y la importación funcionan entre cualquiera de ellas.

## Despliegue futuro

La app está pensada para uso local. Para desplegarla habría que cambiar dos piezas, sin tocar los proveedores:

- **Almacenamiento:** ya está resuelto con MongoDB Atlas (en serverless el disco no persiste, así que `json-file` no sirve ahí).
- **Ejecución en segundo plano:** el `runner` vive en el proceso de Next.js, lo que funciona en un servidor tradicional (VPS, Railway, Fly.io, Docker) pero no en serverless. En ese caso habría que moverlo a una cola o worker.
- **gosom** necesita una máquina con Docker: el mismo VPS o un servicio aparte.

## Aviso

Hacer scraping de Google Maps va en contra de sus Términos de Servicio. Úsalo con moderación, para prospección propia, y respeta la normativa de protección de datos (RGPD) al contactar con los leads.


# Pendientes: 

## Fase 1 · Base de datos
- [x] Conectarlo a una base de datos de mongo db y poder guardar un fila o todos los datos visibles de un filtro. 
- [x] Historial de busquedas guardadas
- [x] Normalizar teléfonos: pasarlos a formato internacional (con libphonenumber) para que WhatsApp funcione siempre.
- [x] Papelera para recuperar leads borrados. Que se eliminen por tiempo
- [x] Copia de seguridad / exportar el CRM completo.

## Fase 2 · CRM: organizar leads
- [x] Opcion de recategorizar ejemplo (Desinteresados, Leads, Interesados, Clientes) En una pagina donde pueda cambiar de vistas, a listas, columnas como tablero como trello.
- [x] Poder agregar notas, a cada lead.
- [x] Opcion de crear y agregar tags a leads.
- [x] Opcion de cambiar colores a leads. 
- [x] Tags automaticos: marcar automáticamente “sin web”, “sin contacto” o “valoración baja”.
- [x] Opcion de establecer filtros predeterminados, que al restablecer queden fijos.
- [x] Acciones masivas: seleccionar varios leads y cambiar etapa, tag o borrar a la vez.
- [x] Puntuación de leads según datos de contacto, valoración y reseñas.
- [x] Poder personalizar el orden de las columnas de las tablas de lead.
- [x] Lista de "no contactar" para cumplir RGPD. De personas que piden no volver a contactar

## Fase 3 · Captura de datos
- [ ] En el input de que y donde buscar. poder pegar el url de google maps con el filtro ya hecho y que de ahi me saque los datos
- [ ] Importar CSV
- [ ] Volver a extraer los datos de un lead guardado para refrescarlo.

## Fase 4 · Seguimiento y contacto
- [ ] Opcion de crear tareas por lead, con opcion de notificaciones y agendamiento
- [ ] Plantillas de mensaje: para WhatsApp o email, con variables como {nombre} o {categoria}.
- [ ] Botones de contacto rápido (WhatsApp, llamar, copiar email) que registren el contacto.
- [ ] Vista de mapa: con Leaflet y OpenStreetMap, gratis. Útil para planificar visitas por zona.
- [ ] Embudo de conversión por etapa en el panel.

## Fase 5 · Integración con Claude
- [ ] Crear MCP para manejarlo desde claude
- [ ] Copiar datos de lead para crear con MCP de claude la pag en otrelink

### Futuro:
Login y multiusuario
Chatbot
Busquedas automaticas