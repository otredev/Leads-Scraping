---
title: Claude y Otrelink
description: Maneja el CRM hablando con Claude (MCP) y crea la página del negocio en Otrelink.
order: 9
---

# Claude y Otrelink

## Claude (MCP)

La app incluye un servidor MCP en `http://localhost:3000/api/mcp`. Con él, Claude puede buscar negocios, guardarlos, cambiarlos de etapa, crear tareas, preparar mensajes, completar redes, gestionar clientes y proyectos y consultar tus finanzas. Por ejemplo:

- "Busca fisioterapeutas en Sevilla y guarda los que no tienen web."
- "¿Qué tareas tengo hoy?"
- "Pasa a Interesados los abogados con más de 4,5 estrellas."
- "Crea el proyecto 'Web corporativa' para la Clínica Sonrisa con entrega el 30 de noviembre."
- "Apunta 30 € al mes de proxies como gasto de captación de Google Maps." · "¿Qué cliente me deja más beneficio este año?"
- "Prepara una propuesta para la Clínica Sonrisa con la plantilla de proyecto." (Crea el borrador; tú lo revisas y lo envías.)
- "¿Qué clientes me han escrito y no he leído?" · "Apunta una nota en la conversación de Óptica Norte: quiere presupuesto de SEO."

Los comandos para conectarlo (Claude Code y Claude Desktop) están en [Ajustes → Integraciones](/ajustes?seccion=integraciones). La app tiene que estar abierta.

**Seguridad:** sin `MCP_TOKEN`, solo acepta conexiones desde tu ordenador. Claude nunca envía mensajes por su cuenta: los prepara y respeta la lista "no contactar".

## Página en Otrelink

En la ficha del lead, sección **Página web** → **Copiar para Claude**. Copia un encargo con los datos del negocio (contacto, horario, mapa, valoración y mejores reseñas) y la plantilla de Otrelink que mejor encaja con su categoría.

Pégalo en un chat de Claude con el conector de Otrelink y creará la página en borrador. Después guarda el enlace en el lead: lo hace Claude si también tiene el MCP de esta app, o lo pegas tú en la ficha. La columna **Página** muestra qué negocios ya tienen la suya.
