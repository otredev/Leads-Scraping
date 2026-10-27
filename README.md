# Leads Scraping

Dashboard local para extraer leads de negocios de Google Maps, filtrarlos, ordenarlos y exportarlos a CSV.
Todo es modular: fuentes, proveedores de scraping, formatos de exportación y almacenamiento se añaden como módulos independientes.

- **Datos por lead:** nombre, categoría, email(s), teléfono, web, dirección, valoración, nº de reseñas, reseñas, horario, coordenadas y enlace a la ficha.
- **Proveedor actual:** [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) (open source y gratuito).
- **Proveedor demo:** genera datos ficticios para probar la app sin levantar nada.
- **Coste:** 0 €. No hay APIs de pago, cuentas ni tarjetas.

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

En el formulario, el punto verde junto a "Proveedor" confirma que la app ve a gosom. Si está en rojo, gosom no está levantado.

**Tiempos:** gosom abre un navegador real y recorre Google Maps, así que cada búsqueda tarda **al menos 3 minutos**. Activar "Buscar emails" lo hace más lento porque visita la web de cada negocio. Puedes cerrar la pestaña: la búsqueda sigue, y si reinicias la app se reanuda sola.

## Interfaz

- **Panel:** métricas (leads, % con email y teléfono, valoración media), leads extraídos por día, cobertura de contacto, categorías, valoraciones, búsquedas recientes y mejor valorados.
- **Búsquedas:** formulario de nueva búsqueda e historial con progreso en vivo.
- **Leads:** tabla con filtros, orden, columnas configurables, detalle por fila y exportación.
- **Módulos:** proveedores, fuentes, formatos y almacenamiento registrados, con su estado.
- **Tema claro, oscuro o del sistema:** monocromo (blanco, grises y negro). Selector en la barra lateral (en móvil, botón de la cabecera). Se recuerda entre visitas.
- **Skeletons de carga:** cada sección muestra su silueta mientras llegan los datos (`Skeleton`, `StatCardSkeleton`, `ChartSkeleton`, `RowsSkeleton`… en `src/components/ui`).

### Personalizar el tema

Todos los colores están en variables al principio de `src/app/globals.css` (un bloque para claro y otro para oscuro). Los componentes usan clases de Tailwind basadas en esas variables (`bg-surface`, `text-fg`, `border-line`, `text-primary`…), así que cambiar cualquier color (o volver a añadir un acento de color en `--primary` y `--chart`) se hace en un solo sitio.

## Uso

1. Escribe una búsqueda por línea, como en Google Maps (`dentistas en Valencia`).
2. En "Más opciones" ajusta idioma, límite de leads, profundidad, tiempo máximo, emails y reseñas ampliadas.
3. Al terminar, filtra (texto, categoría, valoración, nº de reseñas, con email/teléfono/web), ordena por cualquier columna haciendo clic en su cabecera y despliega una fila para ver el horario y las reseñas.
4. **Exportar** descarga exactamente lo que ves filtrado y en el mismo orden: CSV (con coma, o con punto y coma para Excel en español) o JSON.

Los datos se guardan en `./data` (búsquedas en `searches.json` y los leads de cada búsqueda en `leads/<id>.json`).

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
│   └── search.ts            Búsqueda (trabajo) y sus estados
├── modules/                 Implementaciones intercambiables
│   ├── index.ts             ⭐ REGISTRO: el único sitio donde se conectan los módulos
│   ├── sources/             google-maps
│   ├── providers/           gosom/, demo/
│   ├── exporters/           csv, json
│   └── storage/             json-file
├── server/
│   ├── registry.ts          Búsqueda de módulos e instancia del almacenamiento
│   └── runner.ts            Ejecuta búsquedas en segundo plano, guarda, cancela y reanuda
├── app/api/                 REST: modules, searches, leads, export, stats
├── components/
│   ├── shell/               Barra lateral, cabecera móvil y selector de tema
│   ├── pages/               Panel, Búsquedas, Leads, Módulos
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

Implementa `LeadStore` (`src/core/storage.ts`) en `src/modules/storage/`, regístralo en `storages` y selecciónalo con `STORAGE=<id>` en `.env.local`.

## Despliegue futuro

La app está pensada para uso local. Para desplegarla habría que cambiar dos piezas, sin tocar los proveedores:

- **Almacenamiento:** en un hosting serverless (Vercel) el disco no persiste. Habría que cambiar `json-file` por una base de datos (por ejemplo Postgres en Neon o Supabase, ambos con plan gratuito).
- **Ejecución en segundo plano:** el `runner` vive en el proceso de Next.js, lo que funciona en un servidor tradicional (VPS, Railway, Fly.io, Docker) pero no en serverless. En ese caso habría que moverlo a una cola o worker.
- **gosom** necesita una máquina con Docker: el mismo VPS o un servicio aparte.

## Aviso

Hacer scraping de Google Maps va en contra de sus Términos de Servicio. Úsalo con moderación, para prospección propia, y respeta la normativa de protección de datos (RGPD) al contactar con los leads.


## Pendientes: 
- Crear MCP para manejarlo desde claude
- En el input de que y donde buscar. poder pegar el url de google maps con el filtro ya hecho y que de ahi me saque los datos
- Conectarlo a una base de datos de mongo db y poder guardar un fila o todos los datos visibles de un filtro. 
- Opcion de recategorizar ejemplo (Desinteresados, Leads, Interesados, Clientes) En una pagina donde pueda cambiar de vistas, a listas, columnas como tablero como trello.
- Poder agregar notas, a cada lead.
- Opcion de crear y agregar tags a leads.
