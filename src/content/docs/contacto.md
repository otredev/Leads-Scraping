---
title: Contacto y plantillas
description: WhatsApp, email y llamadas desde la ficha, con plantillas y registro del contacto.
order: 5
---

# Contacto y plantillas

## Contactar desde la ficha

En la ficha de cada lead, sección **Contactar**:

- **Abrir WhatsApp** con una plantilla ya rellenada con sus datos.
- **Escribir email** con asunto y texto de plantilla.
- **Llamar**, **Copiar teléfono** y **Copiar email**.

Cada acción queda en el **historial de contacto** del lead y actualiza la columna **Último contacto**. Si el lead está marcado como "no contactar", los botones se desactivan.

## Plantillas

Se editan en [Ajustes → Plantillas de mensaje](/ajustes), con vista previa. Pueden ser de WhatsApp o de email (con asunto) y usar estas variables:

| Variable | Se sustituye por |
|---|---|
| `{nombre}` | Nombre del negocio |
| `{categoria}` | Categoría |
| `{direccion}` | Dirección |
| `{telefono}` | Teléfono |
| `{email}` | Primer email |
| `{web}` | Web |
| `{valoracion}` | Valoración en Google |
| `{resenas}` | Nº de reseñas |
| `{etapa}` | Etapa en tu CRM |

Ejemplo:

```
Hola, ¿hablo con {nombre}? Vi vuestra ficha de {categoria} en Google Maps ({valoracion}★)…
```

> Antes de escribir a un negocio que no te conoce, revisa [Buenas prácticas legales](/ayuda/legal).
