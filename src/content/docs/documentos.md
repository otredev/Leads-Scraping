---
title: Propuestas, contratos y facturas
description: Crea documentos desde plantillas que se rellenan con los datos del cliente, y emite facturas numeradas.
order: 7.6
---

# Propuestas, contratos y facturas

En [Documentos](/documentos) preparas las **propuestas**, los **contratos** y las **facturas** de tus clientes. También desde la ficha de cada cliente, en la tarjeta **Documentos**.

## Antes de empezar

1. Rellena **tus datos legales** (titular, NIF, domicilio) en [Ajustes → Portal del cliente](/ajustes). Salen en todos los documentos.
2. En **Documentos → Ajustes**: IVA por defecto, retención de IRPF si te aplica, días de vencimiento, tu **IBAN** y el pie de factura.
3. En la ficha de cada cliente, pon su **NIF/CIF**, su dirección completa y, si es una empresa, su razón social. Sin NIF no se puede emitir una factura.

## Crear un documento

**Nueva propuesta / contrato / factura** → elige cliente, proyecto (opcional) y plantilla. Se crea un **borrador** que se guarda solo mientras escribes:

- **Texto** en Markdown: `## Título`, `**negrita**`, `- lista`.
- **Variable**: inserta datos que se rellenan solos, como `{cliente.nombre}`, `{cliente.nif}`, `{proyecto.hitos}`, `{proyecto.presupuesto}`, `{yo.iban}` o `{documento.validez}`. La vista previa de la derecha muestra el resultado.
- **Líneas**: concepto, cantidad, precio e IVA. Si el proyecto tiene presupuesto y la plantilla no trae líneas, se añade una con él.
- Si falta algún dato, la página lo avisa y en el documento aparece como `[cliente.nif]`. Complétalo en la ficha del cliente, del proyecto o en tus datos, y se actualiza solo.

Mientras es borrador, las variables usan los **datos actuales**. Al enviarlo (o emitir la factura) el texto y los datos de las partes **quedan fijados**: aunque cambies después la ficha del cliente, el documento no cambia.

## Plantillas

En la pestaña **Plantillas** hay tres incluidas (propuesta de proyecto, contrato de prestación de servicios y factura) y puedes crear las tuyas con su texto, líneas por defecto y días de validez o vencimiento. Si editas una incluida, siempre puedes **Restaurar** la original.

> El contrato incluido es una **plantilla orientativa**: revísalo (o pídele a un profesional que lo revise) antes de usarlo.

## Propuestas y contratos

- **Marcar como enviado**: fija el texto. Si el cliente tiene el [portal](/ayuda/portal) activo, lo verá allí y podrá **aceptar la propuesta** o **firmar el contrato** escribiendo su nombre y marcando una casilla. Se guardan la fecha, la hora y la IP.
- La app recoge las aceptaciones del portal sola (cada 5 minutos o al abrir Documentos) y te avisa con una **notificación push**.
- Si el cliente acepta por otra vía, usa **Marcar aceptada / firmado**.
- Mientras no esté aceptado puedes **volver a borrador**, cambiarlo y enviarlo otra vez: una aceptación de la versión anterior ya no cuenta.
- Una propuesta aceptada se convierte en **contrato** o **factura** con un clic (copia las líneas).

La aceptación en el portal es una firma electrónica simple: sirve como prueba de conformidad para la mayoría de trabajos. Para contratos de mucho importe, valora una firma electrónica avanzada.

## Facturas

- **Emitir factura**: le asigna el siguiente número de su serie (`F2026-0001`, `F2026-0002`…) y la fecha no puede ser futura ni anterior a la última emitida.
- Una factura emitida **no se puede cambiar ni borrar**. Si hay un error, **Crear rectificativa** (serie `R2026-…`): se crea un borrador con las líneas en negativo para que lo ajustes; al emitirla, la original queda como *Rectificada*.
- **Marcar cobrada**: puedes registrar el pago en el proyecto para que cuente en [Finanzas](/ayuda/finanzas).
- Cada factura lleva su **QR tributario** y queda en un **registro encadenado**: una huella SHA-256 calculada como pide la AEAT a partir de sus datos y de la huella de la factura anterior. En la pestaña Facturas verás si el registro está **íntegro** y el **registro de eventos**.
- **PDF**: botón PDF → *Guardar como PDF* en el diálogo de impresión. Sale solo el documento, en A4.

### VeriFactu

Las normas de los programas de facturación (Reglamento VeriFactu, RD 1007/2023) obligan desde el **1 de enero de 2027** a las sociedades y desde el **1 de julio de 2027** al resto, autónomos incluidos. En octubre de 2026 Hacienda anunció que las aplazará a octubre de 2028, pero hasta que se publique en el BOE siguen valiendo esas fechas.

Esta app funciona como un sistema **"NO VERI\*FACTU"** (no envía nada a la AEAT) y ya hace lo principal: numeración correlativa, facturas inalterables, rectificativas, huella encadenada en el formato oficial, QR y registro de eventos. **Le falta** la firma electrónica de los registros y la declaración responsable del fabricante del programa. Antes de que te sea obligatorio, revisa con tu gestoría si te basta o si te conviene un programa certificado o enviar los registros a la AEAT.

## Con Claude

Claude puede listar tus documentos y crear **borradores** (`list_documents`, `get_document`, `create_document`), por ejemplo: "Prepárame una propuesta para la Clínica Sonrisa con la plantilla de proyecto y tres líneas: diseño, desarrollo y SEO". Nunca los envía ni emite facturas: eso lo haces tú desde la app.
