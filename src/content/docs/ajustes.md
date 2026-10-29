---
title: Menú, buscador y ajustes
description: Menú, buscador, ajustes por categorías, copias de seguridad e instalar la app.
order: 10
---

# Menú, buscador y ajustes

## Menú y buscador

El menú lateral agrupa las páginas por categorías: **Prospección** (Búsquedas, Resultados, Leads), **Clientes** (Clientes, Mensajes), **Gestión** (Documentos, Finanzas), **Agenda** (Tareas, Calendario) y **Sistema** (Ajustes, Papelera, Ayuda).

Arriba del menú está el **buscador**: escribe una palabra y te lleva a la página, la pestaña o el ajuste que buscas. También encuentra los apartados de esta Ayuda. Algunos ejemplos:

- *IBAN*, *IVA* o *IRPF* → Ajustes de documentos.
- *etiquetas* o *etapas* → Ajustes → CRM.
- *NIF* o *privacidad* → Datos legales del portal.
- *gastos*, *roi* o *rentabilidad* → la pestaña correspondiente de Finanzas.
- *facturas* o *plantillas* → la pestaña de Documentos.
- *push* → Notificaciones.

Ábrelo con **Ctrl + K** (⌘ + K en Mac), muévete con las flechas y pulsa **Enter**.

## Ajustes

[Ajustes](/ajustes) está ordenado por categorías (índice a la izquierda; en el móvil, arriba):

- **General**: base de datos (cuál se usa y si está conectada) y copia de seguridad.
- **CRM**: etapas, etiquetas, umbral de "Valoración baja" y plantillas de mensaje.
- **Portal del cliente**: tu marca, la conexión con Cloudflare y los datos legales.
- **Documentos y finanzas**: IVA, IRPF, vencimiento, IBAN y pie de factura; coste de tu hora y moneda.
- **Notificaciones y app**: avisos push e instalar la app.
- **Integraciones**: Claude (MCP).
- **Módulos**: proveedores, enriquecedores, fuentes y formatos de exportación.

Cada categoría tiene su propia dirección (por ejemplo `/ajustes?seccion=crm`), así que puedes guardarla en favoritos.

## Copias de seguridad

**Descargar copia** genera un JSON con todo: búsquedas, resultados, leads (incluida la papelera), ajustes, tareas, clientes y proyectos.

**Restaurar desde archivo** solo añade lo que falte; nunca sobrescribe. El formato es el mismo con MongoDB o con ficheros locales, así que también sirve para pasar de uno a otro.

> Haz una copia antes de cambios grandes (importar un CSV enorme, borrar etapas…).

## Instalar la app

En Chrome o Edge, usa el icono de instalar de la barra de direcciones (o [Ajustes → Notificaciones y app](/ajustes?seccion=notificaciones#instalar)). Instalada, se abre en su propia ventana, los avisos salen como notificaciones del sistema y, si el servidor está apagado, muestra una pantalla de "sin conexión".

## Tema

Claro, oscuro o el del sistema, con el selector de la barra lateral (en el móvil, en la cabecera).
