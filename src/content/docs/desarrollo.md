---
title: Ampliar la app (desarrollo)
description: Cómo está organizada y cómo añadir proveedores, enriquecedores y otros módulos.
order: 12
---

# Ampliar la app (desarrollo)

Todo es modular: proveedores de scraping, fuentes, exportadores, almacenamiento, canales de notificación y enriquecedores se conectan en **un solo sitio**, `src/modules/index.ts`. La interfaz, la API y el MCP se adaptan solos.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/core/` | Modelos y lógica pura (leads, CRM, clientes, filtros, puntuación…) e interfaces de los módulos |
| `src/modules/` | Implementaciones intercambiables y el registro `index.ts` |
| `src/server/` | Lógica del servidor (búsquedas, CRM, tareas, clientes, portal, MCP…) |
| `src/app/` | Páginas y API (`src/app/api/`) |
| `src/components/` | Interfaz |
| `src/content/docs/` | Esta ayuda, en Markdown |
| `portal/` | Portal del cliente (Cloudflare Workers + D1), app aparte |

## Añadir un módulo

| Tipo | Interfaz | Carpeta |
|---|---|---|
| Proveedor de búsqueda (Apify, Google Places…) | `LeadProvider` (`src/core/provider.ts`) | `src/modules/providers/` |
| Fuente (Páginas Amarillas…) | `SourceDefinition` | `src/modules/sources/` |
| Exportador (Excel…) | `Exporter` (`src/core/exporter.ts`) | `src/modules/exporters/` |
| Almacenamiento (Postgres, SQLite…) | `LeadStore` (`src/core/storage.ts`) | `src/modules/storage/` |
| Canal de aviso (Telegram, email…) | `defineNotifier` (`src/core/notifier.ts`) | `src/modules/notifiers/` |
| Enriquecedor (Hunter, Apify…) | `defineEnricher` (`src/core/enricher.ts`) | `src/modules/enrichers/` |

Crea el fichero, impórtalo en `src/modules/index.ts` y añádelo a su lista. El README tiene ejemplos completos de cada uno.

## Editar esta ayuda

Cada guía es un fichero `.md` en `src/content/docs/` con una cabecera:

```
---
title: Título de la guía
description: Una frase que la resume
order: 13
---
```

El nombre del fichero es la dirección (`mi-guia.md` → `/ayuda/mi-guia`). Al guardar, la ayuda se actualiza.
