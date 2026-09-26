# Ramax Cafe Club. MVP funcional listo para desarrollo

> Versión 1.1. Fecha: 26 de septiembre de 2026.
>
> Este documento define el primer producto operable con enfoque local-first. El objetivo no es reemplazar LibreOffice de un día para otro, sino que la caja pueda operar sin depender de internet ni de servicios cloud para vender, descontar stock y dejar auditoría clara.

## 1. Objetivo del MVP

El circuito principal que debe validarse es:

```text
Empezar a vender -> registrar productos -> cerrar venta -> descontar stock
-> asociar socio opcional -> acreditar puntos
-> revisar historial -> anular si hace falta
```

La venta y la operación del local tienen prioridad sobre campañas, club social o estructura distribuida.

### Incluido en el MVP

- productos y stock
- ventas y cierre de caja
- stock y reversas
- auditoría
- usuarios con roles
- asociación de socio a la venta
- puntos básicos por compra
- recompensas visibles y canjes simples
- historial de ventas, saldo y movimientos

### Fuera del MVP

- facturación fiscal automática
- integración rica con proveedores o ERP
- recetas, costos, compras y producción
- delivery, reservas ni logística compleja
- marketing automation avanzado
- microservicios, workers ni infraestructura distribuida prematura
- campañas QR avanzadas como primera prioridad

## 2. Principio de arquitectura

El MVP debe ser local-first:

- la caja opera en la sucursal sin internet,
- cada sucursal tiene su base local de datos,
- las transacciones y auditoría se resuelven localmente,
- la sincronización con central es posterior y opcional,
- la nube se usa para administración y reportes, no para cerrar ventas.

Se mantiene un monolito modular, no se introducen microservicios ni colas para un problema aún no probado.

## 3. Usuarios, roles y permisos

| Rol | Puede hacer |
|---|---|
| Visitante | ver el club y la propuesta si aplica |
| Socio | consultar saldo, historial, QR y canjes propios |
| Empleado | vender, asociar socio, consultar stock, validar y cancelar canjes simples |
| Administrador | todo lo del empleado, administrar catálogo, stock, usuarios, permisos, puntos y auditoría |

Reglas de acceso:

- la autorización se valida en servidor, no solo en la UI,
- un empleado no puede editar una venta cerrada ni un canje validado,
- todo cambio administrativo registra autor, fecha, motivo y valores relevantes,
- un socio solo accede a sus propios datos y beneficios.

## 4. Mapa del producto

```text
Operación local
  productos -> stock -> ventas -> cobro -> reversa -> auditoría
                               ^
                               |
                          socio opcional
                               |
                               v
                           puntos

Club
  perfil -> QR -> saldo -> historial -> recompensas -> canjes

Administración
  productos | stock | usuarios | permisos | recompensas | auditoría
```

## 5. Identidad y membresía

### Objetivo

Crear una cuenta de socio con la menor fricción posible, sin atar el negocio a un único proveedor.

### Reglas

- el sistema admite login interno para empleados/admin,
- la integración con Google puede agregarse después sin romper la estructura,
- cada socio cuenta con QR opaco y no adivinable,
- el QR identifica al socio, nunca el saldo,
- si la cuenta queda suspendida o eliminada, la misma no puede usar beneficios ni validar canjes,
- la auditoría conserva el historial aunque se anonimice una cuenta.

### Estados

```text
User: ACTIVE | INACTIVE
Member: ACTIVE | SUSPENDED | DELETED
```

La anonimización elimina datos personales, invalida sesiones y QR, pero no borra ventas, movimientos ni canjes históricos.

### Criterios de aceptación

- un usuario puede entrar a su perfil y ver su estado,
- un QR inválido o suspendido no permite acreditar puntos ni validar canjes,
- un socio puede ser asociado a una venta y recibir puntos por la compra,
- una cuenta eliminada conserva trazabilidad sin seguir usando el sistema.

## 6. Productos y stock

### Alcance

El MVP cubre productos vendibles por unidad, sin recetas ni insumos compuestos.

Campos de `Product`:

| Campo | Regla |
|---|---|
| nombre | obligatorio |
| SKU | opcional y único si existe |
| precio actual | mayor a cero |
| controlaStock | define si descuenta stock |
| stockActual | entero mayor o igual a cero |
| stockMinimo | integer y trazable |
| activo | producto no se vende si está inactivo |

### Reglas

- cerrar venta descuenta stock una sola vez dentro de la misma transacción,
- si `controlaStock = false`, la venta no genera movimiento de stock,
- el stock no puede quedar negativo por defecto,
- cada ajuste genera un `StockMovement` con motivo,
- desactivar un producto no elimina el historial de ventas ni movimientos anteriores.

### Estados

```text
Product: ACTIVE | INACTIVE
StockMovement: OPENING | SALE | SALE_REVERSAL | ADJUSTMENT | IMPORT
```

### Criterios de aceptación

- la lista de venta muestra solo productos activos,
- una venta de 2 unidades reduce el stock en 2,
- el cambio de precio no altera ventas anteriores,
- la pantalla alerta cuando `stockActual <= stockMinimo`.

## 7. Venta y caja

### Flujo principal

```text
Nueva venta
  -> buscar producto
  -> agregar items y cantidades
  -> asociar socio opcional
  -> elegir medio de pago opcional
  -> cobrar
  -> cerrar venta
  -> descontar stock
  -> acreditar puntos si corresponde
```

### Reglas

- una venta contiene varios `SaleItem` con producto, cantidad, precio unitario y subtotal,
- puede cerrarse con o sin socio y con o sin pago registrado,
- no puede cerrarse con total inválido ni sin items,
- el precio se copia al item para preservar historial,
- el cobro usa idempotency key para evitar doble pago o doble acreditación,
- asociar socio a una venta cerrada solo se permite si el flujo lo soporta y queda registrado,
- anular una venta restaura stock y revierte puntos si aplica, sin borrar el historial.

### Estados

```text
Sale: DRAFT -> CLOSED
      DRAFT -> VOID
      CLOSED -> VOID
```

### Criterios de aceptación

- un empleado puede cerrar una venta con varios productos y sin socio,
- un socio asociado recibe puntos una sola vez,
- un doble toque al cobrar no duplica la venta,
- anular una venta restaura stock y queda trazada con motivo.

## 8. Puntos y fidelización

### Regla configurable

La regla global define `pesosPorPunto`.

Ejemplo:

```text
1 punto cada $100
```

El sistema debe:

- calcular puntos por compra usando la regla vigente al momento del cierre,
- llevar un libro inmutable de movimientos,
- mantener vencimiento por lote,
- evitar recalcular histórica por cambios en la regla.

### Reglas clave

- el saldo se calcula a partir del libro de movimientos,
- el vencimiento se define por la fecha de acreditación,
- una reversa o anulación devuelve los puntos de la misma forma que descuenta stock,
- un socio solo puede ver su historial y saldo propios.

## 9. Recompensas y canjes

### Alcance

El MVP incluye un catálogo simple de recompensas y una validación básica del canje en caja.

Incluye:

- recompensa con nombre, costo, vigencia y cupo si aplica,
- solicitud del socio,
- emisión de ticket,
- validación única por empleado,
- vencimiento y cancelación con devolución exacta,
- historial para socio y operación.

### Reglas

- la recompensa no puede validarse dos veces,
- el costo se descuenta del saldo del socio,
- si se cancela o vence, los puntos vuelven al saldo,
- una validación requiere autorización y queda registrada en auditoría.

## 10. Importación y coexistencia con LibreOffice

El objetivo es reducir la doble carga y permitir migración gradual.

### Formatos aceptados

- `.csv` UTF-8
- `.xlsx`

### Casos incluidos

- importación de productos,
- stock inicial y ajustes,
- importación de ventas históricas,
- exportación de ventas, productos y puntos.

### Reglas

- cada lote se valida antes de aplicarse,
- el administrador decide si acepta solo filas válidas o rechaza todo,
- filas inválidas no crean datos parciales,
- importaciones se registran en auditoría,
- la importación no reemplaza la operación crítica del sistema local.

## 11. Campañas QR

Las campañas QR no son la prioridad del primer hito. Aparecen después de la caja y la fidelización básica.

Se contemplan como:

- QR público para landing y participación,
- beneficio simple basado en puntos,
- participación única por socio,
- métricas básicas de escaneo y participación.

## 12. Calidad mínima exigida

- pruebas automáticas de reglas y permisos,
- pruebas de integración para transacciones,
- prueba de punta a punta del flujo principal,
- registro de auditoría desde E1,
- idempotencia en cobro y validación,
- no edición destructiva de ventas, stock, puntos ni canjes.

## 13. Orden recomendado de ejecución

```text
E0: base ejecutable
E1: caja operativa local
E2: socios y puntos
E3: recompensas y canjes
E4: LibreOffice y migración
E5: campañas QR
E6: métricas, sincronización y lanzamiento
```

## 14. Primer hito de valor real

El primer hito no es “backend listo”, sino que un empleado pueda:

- crear productos,
- cargar stock,
- vender varios items,
- cierre la operación,
- anular la venta si hace falta,
- ver el historial y la auditoría.

Ese corte es el que entrega valor real al negocio y deja la base para club, puntos y canjes sin introducir complejidad innecesaria ni dependencia de la nube.
- Los puntos solo vencen si fueron acreditados. Un ajuste puede marcarse con vencimiento o sin vencimiento, segun su motivo.
- El saldo disponible se calcula desde el libro de movimientos y lotes de puntos no vencidos.
- Los canjes consumen lotes por FEFO: primero vence primero se usa.
- Antes de aprobar un canje el servidor descarta lotes vencidos y recalcula disponibilidad dentro de la transaccion.

### Libro inmutable

```text
PointsMovement
  EARN_SALE          + puntos por venta
  EARN_CAMPAIGN      + puntos por beneficio de campana
  REDEEM             - puntos consumidos
  EXPIRE             - puntos vencidos
  ADJUSTMENT         +/- correccion autorizada
  REVERSAL           +/- compensacion de una operacion previa
```

Cada movimiento guarda socio, tipo, puntos, fecha, fuente, actor, regla aplicada, motivo y referencias a venta, canje, campana o movimiento revertido. No se edita ni elimina. Una correccion crea otro movimiento.

### Criterios de aceptacion

- Con una regla de $100 por punto, una venta elegible de $11.500 acredita 115 puntos.
- Si la regla cambia a $200 por punto, una venta nueva de $11.500 acredita 57 puntos; la venta previa conserva 115.
- Un canje de 100 puntos usa primero los lotes con vencimiento mas cercano y registra el detalle de lotes consumidos.
- Al cumplirse 365 dias, los puntos no usados dejan de estar disponibles y se crea su movimiento `EXPIRE`.

## 9. Recompensas y canjes

### Modelo y flujo

Una recompensa define que se puede obtener. Un canje es la solicitud concreta de un socio.

```text
Catalogo -> socio pide canje -> servidor reserva/consume puntos -> ticket
                                                     |
Empleado valida -------------------------------------+
```

Campos de `Reward`: nombre, descripcion, imagen opcional, costo en puntos, estado, periodo de vigencia, cupo propio opcional y condiciones visibles. El cupo limita canjes de la recompensa y no descuenta inventario de productos vendibles.

### Estados

```text
Reward:       DRAFT | ACTIVE | PAUSED | ENDED
Redemption:   REQUESTED -> READY -> REDEEMED
              REQUESTED -> CANCELLED | EXPIRED
              READY -> CANCELLED | EXPIRED
```

Para el MVP, la confirmacion exitosa crea `READY` y descuenta puntos en ese momento. Si el ticket vence o se cancela, se genera una reversa de puntos y se libera stock. La vigencia por defecto es hasta el fin del dia local, salvo configuracion de la recompensa.

### Reglas

- El servidor verifica estado, fechas, stock y puntos en una transaccion atomica.
- Pausar una recompensa impide nuevos pedidos. No invalida tickets `READY` ya emitidos.
- Cambiar el costo afecta pedidos futuros, no canjes ya creados.
- Un ticket se valida una vez. El empleado puede localizarlo por QR o codigo.
- Si la recompensa tiene cupo, se reserva al crear el canje y se confirma al validarlo. Cancelar o vencer el ticket libera ese cupo.

### Criterios de aceptacion

- Un socio sin saldo ve la recompensa bloqueada y el faltante exacto.
- Dos canjes simultaneos no pueden consumir los mismos puntos ni el ultimo stock disponible.
- Validar dos veces el mismo ticket no entrega dos recompensas.
- Cancelar o vencer un ticket `READY` devuelve exactamente los puntos que habia consumido.

## 10. Campanas QR reutilizables

### Separacion del modelo

Esta separacion evita que un sticker, una experiencia y un beneficio queden mezclados en una sola entidad.

```text
Campaign             define objetivo, fechas y regla de participacion
  -> EntryPoint      define el QR fisico o enlace reutilizable
       -> Experience define lo que ve la persona al abrirlo
            -> Benefit define lo que recibe al completar la experiencia
```

Ejemplo:

```text
Campaign: "Cafes escondidos de septiembre"
EntryPoint: sticker QR en la mesa 4
Experience: landing "Encontraste un cafe escondido"
Benefit: +200 puntos
```

### Flujo

```text
Sticker/cartel QR -> landing publica -> explicar beneficio
 -> Google login si hace falta -> verificar cupo por socio/campana
 -> registrar participacion -> entregar beneficio
```

### Reglas

- El mismo QR de sticker o cartel puede ser escaneado muchas veces. Es un `EntryPoint` reutilizable, no un codigo descartable.
- Un socio puede tener una sola participacion exitosa por `Campaign`, aunque escanee distintos `EntryPoint` de esa campana.
- El limite se impone con una restriccion unica `(campaignId, memberId)` en servidor.
- El primer escaneo se puede medir de forma anonima. La participacion y el beneficio requieren socio autenticado.
- Una campana define inicio, fin, estado, limite opcional total y terminos visibles.
- Desactivar un `EntryPoint` deja de aceptar escaneos sin borrar datos previos. Pausar o terminar la campana impide nuevas participaciones.
- El beneficio puede ser puntos o una recompensa/cupon. Los puntos de campana usan el mismo libro y vencen a los 365 dias, salvo que la configuracion del beneficio indique otra vigencia aprobada.

### Estados

```text
Campaign:     DRAFT | ACTIVE | PAUSED | ENDED
EntryPoint:   ACTIVE | DISABLED
Experience:   DRAFT | PUBLISHED | ARCHIVED
Benefit:      DRAFT | ACTIVE | DISABLED
Participation:PENDING | GRANTED | REJECTED
```

### Criterios de aceptacion

- Dos personas distintas pueden escanear el mismo sticker y entrar a la experiencia.
- El mismo socio solo recibe una vez el beneficio de la misma campana, incluso con varios stickers.
- Un QR de una campana pausada muestra que ya no esta disponible y no otorga puntos.
- El panel informa escaneos por `EntryPoint`, participaciones unicas y beneficios otorgados por campana.

## 11. Trazabilidad, integridad y auditoria

| Evento | Registro obligatorio |
|---|---|
| Venta, anulacion y asociacion tardia de socio | actor, fecha, venta, motivo si hay anulacion, resultado de puntos y stock; pago devuelto si existía |
| Movimiento de stock | producto, delta, saldo resultante, fuente y actor |
| Movimiento de puntos | socio, delta, lotes, fuente, regla y actor |
| Canje | socio, recompensa, costo, ticket, empleado y cambios de estado |
| Cambio de configuracion | actor, fecha, valores anterior/nuevo y motivo |
| Importacion/exportacion | archivo, actor, fecha, resumen, errores y referencias creadas |

Principios:

- Ventas, movimientos de stock, movimientos de puntos, canjes y participaciones no se eliminan.
- Las anulaciones, expiraciones y correcciones son nuevos eventos compensatorios.
- Las operaciones que cambian venta, stock y puntos usan transacciones atomicas.
- Las consultas de saldo se pueden materializar para rendimiento, pero su fuente de verdad sigue siendo el libro de puntos.
- Toda fecha se almacena en UTC y se muestra en horario local de Ramax. La zona oficial es `America/Argentina/San_Luis` (GMT-3). El cierre diario y los vencimientos se procesan a las 21:00 de esa zona.

## 12. Datos centrales y relaciones

```text
ClubMember 1---* Identity
ClubMember 1---* Sale (opcional en Sale)
Sale       1---* SaleItem *---1 Product
Product    1---* StockMovement
ClubMember 1---* PointsMovement
Reward     1---* Redemption *---1 ClubMember
Campaign   1---* EntryPoint
Campaign   1---* Participation *---1 ClubMember
Experience 1---* EntryPoint
Benefit    1---* Participation
```

Restricciones de base de datos que no deben quedar solo en la interfaz:

- `sale_item.quantity` es un entero mayor que cero, `sale_item.unit_price >= 0` y una venta cerrada tiene al menos un item.
- Una sola participacion exitosa por `campaignId + memberId`.
- Una sola acreditacion de venta por `saleId`.
- Un solo movimiento de descuento de stock de venta por `saleId + productId`.
- Un canje solo puede pasar a `REDEEMED` una vez.

## 13. Orden de desarrollo

| Fase | Entregable | Depende de |
|---|---|---|
| 0. Fundacion | Usuarios internos, roles, auditoria base, modelo de productos y migraciones | Nada |
| 1. Caja minima | Productos, stock simple, venta item por item, pago y socio opcionales | Fase 0 |
| 2. Club y puntos | Google login, QR de socio, regla configurable, libro de puntos, asociacion tardia | Fase 1 |
| 3. Recompensas | Catalogo, solicitud, ticket, validacion, FEFO, vencimientos y reversas | Fase 2 |
| 4. LibreOffice | Plantillas, importadores validados, exportaciones y reporte de filas | Fases 1 y 2 |
| 5. Campanas QR | Campaign, EntryPoint, Experience, Benefit, landing y limite por socio | Fase 2 |
| 6. Panel y metricas | Busqueda, detalle de socio, alertas de stock, reportes basicos de campana | Fases 3 a 5 |

La Fase 1 ya permite operar ventas y stock. La Fase 2 convierte esas ventas en fidelizacion. No conviene adelantar QR promocionales antes de que el libro de puntos y las transacciones de venta sean confiables.

## 14. Pruebas de aceptacion de punta a punta

1. Un cliente entra con Google, recibe su QR y no completa telefono. Puede acumular y canjear igual.
2. El empleado vende 2 cappuccinos y 1 medialuna sin socio. Stock baja y no hay puntos.
3. El cliente vuelve y el empleado lo asocia a esa venta. Se acreditan puntos una vez con la regla vigente y queda rastro del empleado.
4. El administrador cambia de 1 punto cada $100 a 1 cada $200. Las ventas anteriores no cambian.
5. El socio recibe lotes en dos fechas, canjea y el sistema usa primero el lote que vence antes.
6. Un sticker de campana se escanea por muchas personas. Cada socio recibe el beneficio una sola vez para esa campana.
7. LibreOffice exporta un archivo, el administrador lo reimporta y el sistema no duplica las operaciones.
8. Una anulacion deja intacta la venta original, crea sus compensaciones y devuelve stock y puntos de manera visible.

## 15. Decisiones cerradas

- Registro con Google. Telefono y fecha de nacimiento opcionales.
- Venta por producto. No se usa una carga manual de importe total.
- Producto vendible y stock simple por producto.
- Medio de pago opcional.
- La relacion de puntos se configura como "1 punto cada X pesos" y se explica con equivalencias de productos.
- Los cambios de regla rigen de inmediato hacia adelante. El pasado no se recalcula.
- Un socio puede asociarse después a una venta cerrada en cualquier momento si no está anulada ni asociada a otro socio. La acción auditada del empleado es prueba suficiente y los puntos se acreditan con la regla vigente.
- Los puntos vencen 365 dias despues de acreditarse y los canjes consumen FEFO.
- Los QR de stickers y carteles son reutilizables. El limite es una participacion exitosa por socio y campana.
- El modelo de campanas separa `Campaign`, `EntryPoint`, `Experience` y `Benefit`.
- El stock y las cantidades vendidas usan unidades enteras en el MVP.
- El inventario inicial controla solo productos vendibles. Recetas, insumos, compras, caja y gastos quedan fuera del MVP.
- Un empleado puede asociar un socio a una venta cerrada en cualquier momento si la venta no está anulada ni asociada a otro socio.
- Solo un administrador puede anonimizar una membresía. La operación invalida acceso y QR, elimina datos personales y conserva el historial bajo "Usuario eliminado".
- Las recompensas usan cupos propios opcionales. No consumen ni reservan inventario de productos vendibles.
