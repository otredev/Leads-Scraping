---
title: Leads y CRM
description: Organiza tus leads por etapas, etiquetas y colores, con notas, filtros y acciones masivas.
order: 3
---

# Leads y CRM

[Leads](/leads) es tu CRM: los negocios que has guardado. Es independiente de los resultados: borrar una búsqueda no borra tus leads, y volver a guardar un negocio actualiza sus datos sin tocar tu trabajo.

## Vistas

- **Tabla**: todas las columnas, ordenable y con anchos ajustables.
- **Lista**: agrupada por etapa.
- **Tablero**: tipo Trello; arrastra tarjetas entre etapas.
- **Mapa**: los leads filtrados sobre el mapa, coloreados por etapa. Útil para planificar visitas.

## La ficha del lead

Al pulsar un lead se abre su ficha con:

- **Etapa y color**.
- **Contactar**: WhatsApp o email con plantilla, llamar o copiar datos (ver [Contacto y plantillas](/ayuda/contacto)).
- **Tareas** (ver [Tareas, calendario y avisos](/ayuda/tareas)).
- **Página web**: encargo para crear su página en Otrelink con Claude (ver [Claude y Otrelink](/ayuda/claude)).
- **Datos de contacto**, redes sociales y **Completar redes y emails**.
- **Puntuación**, **etiquetas**, **notas** y **no contactar**.
- Abajo: **Volver a extraer datos**, **Convertir en cliente** y **Mover a la papelera**.

## Etapas, etiquetas y colores

- **Etapas**: por defecto Desinteresados, Leads, Interesados y Clientes. Puedes renombrarlas, reordenarlas y crear más en [Ajustes](/ajustes).
- **Etiquetas**: tuyas, con color. Créalas en Ajustes o al vuelo desde la ficha.
- **Etiquetas automáticas**: "Sin web", "Sin contacto" y "Valoración baja" se calculan solas. El umbral de valoración baja se cambia en Ajustes.
- **Color**: un color por lead para destacarlo.

## Puntuación (0–100)

Suma puntos por tener email (25), teléfono (20) y web (15), por la valoración (hasta 25) y por el nº de reseñas (hasta 15). Sirve para priorizar: filtra por "Puntuación 40+" o más.

## Filtros predeterminados y columnas

- **Fijar como predeterminados** guarda los filtros y el orden actuales. **Restablecer** vuelve a ellos.
- El orden, la visibilidad y el ancho de las columnas se guardan solos.

## Acciones masivas

Selecciona filas (o todos los filtrados) para cambiar etapa, añadir o quitar etiquetas, color, marcar "no contactar", **actualizar datos**, **completar redes y emails** o enviar a la papelera.

## No contactar (RGPD)

Marca con un motivo a quien pide no ser contactado. Se ocultan por defecto (y por tanto no se exportan), los botones de contacto se desactivan y, si el negocio vuelve a aparecer en una búsqueda, la app te avisa. Más en [Buenas prácticas legales](/ayuda/legal).

## Importar CSV

**Importar CSV** detecta las columnas habituales (también los CSV exportados por la app). Puedes corregir el mapeo y elegir etapa, etiquetas y país de los teléfonos. Las filas repetidas se combinan y los negocios que ya tienes solo actualizan sus datos.

## Volver a extraer datos

Desde la ficha o con varios seleccionados. Lanza una búsqueda con la URL de su ficha de Google Maps y, al terminar, refresca teléfono, web, email, valoración, horario y reseñas sin tocar etapa, etiquetas ni notas.

## Papelera

Los leads borrados se pueden restaurar desde [Papelera](/papelera). Se eliminan solos a los 30 días (variable `TRASH_DAYS`).
