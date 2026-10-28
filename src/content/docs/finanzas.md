---
title: Finanzas y rentabilidad
description: Gastos, beneficio neto por cliente y retorno de lo que inviertes en captar clientes.
order: 7.5
---

# Finanzas y rentabilidad

La página [Finanzas](/finanzas) responde a tres preguntas: **cuánto ganas de verdad**, **qué clientes te compensan** y **dónde merece la pena invertir** para conseguir más.

## De dónde salen los números

- **Ingresos**: los **pagos** que registras en los proyectos de tus clientes. Cuentan en la fecha en que los cobras.
- **Gastos**: los que añades en Finanzas (ver abajo).
- **Tus horas**: las horas registradas en los proyectos multiplicadas por el **coste de tu hora** (botón **Ajustes**).

> Pon los importes **sin IVA**. Los pagos en una moneda distinta a la de Finanzas no se suman; la página te avisa si hay alguno.

## Añadir gastos

**Añadir gasto** y elige a qué se imputa:

| Tipo | Ejemplos | Cómo se reparte |
|---|---|---|
| **De un cliente** | Colaborador, fotógrafo, licencia o plantilla para su proyecto | Entero a ese cliente (y proyecto, si lo eliges) |
| **General** | Software, hosting, gestoría, cuota de autónomo | Entre todos los clientes, según lo que paga cada uno en el periodo |
| **Captación** | Proxies para el scraping, anuncios, herramientas de prospección | Entre los clientes de ese **canal**, según lo que paga cada uno |

En **Se repite** marca las suscripciones (cada mes o cada año): se cuentan solas en cada periodo hasta su **último cargo**. Si cancelas una, edítala y pon la fecha del último cargo.

También puedes añadir gastos de un cliente desde su ficha, en la tarjeta **Rentabilidad**.

## Tus horas como coste

En **Ajustes** de Finanzas indica cuánto te cuesta una hora de tu trabajo (por ejemplo, el sueldo que quieres ganar dividido entre tus horas de trabajo al mes). Así ves si un cliente te compensa por el tiempo que te lleva.

En los proyectos **a precio cerrado** puedes desmarcar **Cuentan como coste** en la tarjeta Horas (o al editar el proyecto): sus horas no restan beneficio, pero siguen sirviendo para calcular cuánto ganas por hora.

## Las pestañas

### Resumen

- **Ingresos, gastos, beneficio neto** y **cuánto ganas por hora** en el periodo elegido.
- Gráfico de **ingresos y gastos por mes** (pasa el ratón para ver el beneficio).
- **Recomendaciones**: tu mejor canal, clientes que te hacen perder dinero, clientes que pagan menos que tu hora, el sector más rentable y si tus gastos fijos pesan demasiado.
- **Cuenta de resultados** mes a mes y **gastos por categoría**.

### Clientes

Beneficio neto de cada cliente:

> ingresos − gastos directos − tus horas − su parte de gastos generales − su parte de captación

Con su **margen** y **cuánto ganas por hora** con él (en rojo si es menos que el coste de tu hora). Ordénalo por beneficio, ingresos, margen o € por hora.

### Gastos

Todos los gastos del periodo, con buscador y filtro por tipo. Pulsa uno para editarlo o borrarlo. Los recurrentes muestran cuántos cargos caen en el periodo.

### Inversión

- **Retorno por canal**: lo invertido, clientes nuevos, **coste por cliente**, leads guardados y **coste por lead** (en Google Maps), ingresos y **retorno**. Un retorno del 200 % significa que cada euro invertido te deja 2 € de beneficio.
- **Rentabilidad por segmento**: por **sector**, **ciudad** o **canal**. Te dice qué tipo de negocio y qué zona te dejan más beneficio por cliente, para buscar más leads así.
- **Gastos recurrentes**: cuánto cuesta cada suscripción al mes y al año, por cliente y en % de tus ingresos.

## Canal y sector de cada cliente

Para medir el retorno, cada cliente tiene un **canal de captación** y un **sector** (al crearlo o con **Editar**):

- Los clientes convertidos desde un lead tienen **Google Maps** como canal y la categoría del lead como sector, salvo que lo cambies.
- Usa en los gastos de captación **el mismo nombre de canal** que en tus clientes.
- La ciudad se saca de la dirección.

## Ten en cuenta

- Si en un periodo no hay ingresos, los gastos generales no se pueden repartir entre clientes; sí cuentan en el beneficio total. Lo mismo con la captación de un canal cuyos clientes aún no han pagado.
- Al **borrar un cliente**, sus gastos pasan a generales (el dinero se gastó igualmente). Al borrar un proyecto, sus gastos se quedan en el cliente.
- Claude puede consultar y registrar todo esto con las herramientas `get_finances`, `list_expenses` y `add_expense` (ver [Claude y Otrelink](/ayuda/claude)).
