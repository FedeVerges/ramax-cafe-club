# Ramax Cafe Club. MVP funcional listo para desarrollo

> Version 1.0. Fecha: 12 de septiembre de 2026.
>
> Este documento define el primer producto operable. Ramax no reemplaza LibreOffice de un dia para otro: registra productos, ventas y fidelizacion sin frenar la caja actual.

## 1. Objetivo y limite del MVP

El circuito que se debe validar es:

```text
Descubrir Ramax Club -> entrar con Google -> comprar -> sumar puntos
-> volver -> canjear una recompensa
```

El local debe poder vender aunque el cliente no sea socio, no quiera identificarse o haya un problema con el Club.

| Incluido | Fuera del MVP |
|---|---|
| Google login, clientes, productos, ventas, stock simple, puntos, recompensas, QR de campana y administracion | Facturacion fiscal, integracion automatica con FUDO/POS, proveedores, recetas, costos, reservas, delivery, gamificacion y automatizaciones de marketing |

## 2. Usuarios, roles y permisos

| Rol | Puede hacer |
|---|---|
| Visitante | Abrir un QR de campana y ver la propuesta. |
| Socio | Entrar con Google, mostrar su QR, consultar puntos, reclamar una campana y pedir un canje. |
| Empleado | Crear ventas, asociar un socio a una venta, ver stock, iniciar y validar canjes. |
| Administrador | Todo lo del empleado, administrar productos, stock, reglas de puntos, recompensas, campanas, usuarios y ajustes. |

Reglas de acceso:

- El sistema aplica permisos en servidor. Ocultar un boton no basta.
- Un empleado no puede editar una venta cerrada, un movimiento de puntos, ni un canje confirmado.
- Todo cambio administrativo guarda autor, fecha, motivo y valores anterior/nuevo cuando aplique.
- El socio solo accede a sus propios datos y beneficios.

## 3. Mapa del producto

```text
Cliente
  Google login -> Mi Club -> Mi QR -> Puntos y movimientos -> Recompensas
                     ^                         |
Campana QR publica --+                         +-> Caja

Operacion
  Productos y stock -> Nueva venta por items -> pago opcional -> cerrar venta
                                                    |
                                                    +-> socio opcional -> puntos

Administracion
  Productos | Importar/exportar | Regla de puntos | Recompensas | Campanas | Auditoria
```

## 4. Modulo de identidad y membresia

### Objetivo

Crear una cuenta de socio con la menor friccion posible y sin atar el modelo a un unico proveedor.

### Flujo

```text
[Continuar con Google]
          |
          v
Google autoriza identidad
          |
          +-> identidad existente: ingresar
          |
          +-> identidad nueva: crear socio activo y entrar
                                  |
                                  +-> pedir telefono y fecha de nacimiento, ambos opcionales
```

### Reglas

- Google entrega el nombre, email verificado y un identificador estable del proveedor.
- La cuenta se crea en el primer acceso exitoso. No hay contraseña propia.
- Telefono y fecha de nacimiento se pueden completar, editar u omitir.
- Cada socio tiene un QR opaco y no adivinable. El QR identifica al socio, nunca contiene el saldo.
- La tabla `Identity` permite sumar Apple, email magico u otros metodos despues, sin migrar `ClubMember`.
- Si Google no devuelve email, el sistema no crea la membresia y explica el motivo.

### Estados

```text
ClubMember: ACTIVE | SUSPENDED | DELETED
Identity:   ACTIVE | REVOKED
```

Solo un administrador puede pasar una membresía a `DELETED`. La anonimización elimina nombre, email, teléfono, fecha de nacimiento e identidades de acceso, invalida sesiones y QR, y muestra los registros conservados como "Usuario eliminado". No borra ventas, movimientos de stock o puntos, ni canjes históricos requeridos para auditoría.

### Criterios de aceptacion

- Un usuario nuevo entra con una sola accion de autenticacion y llega a "Mi Club" con una membresia creada.
- Un usuario que ya ingreso vuelve a su misma membresia y conserva su historial.
- Telefono ausente no impide registro, compra, acumulacion ni canje.
- Un QR de socio invalido, suspendido o inexistente no permite acreditar puntos ni validar canjes.

## 5. Modulo de productos vendibles y stock

### Alcance

Un producto vendible es todo item que se puede agregar a una venta. El MVP usa stock por producto, no recetas ni insumos compuestos.

Campos de `Product`:

| Campo | Regla |
|---|---|
| nombre, SKU opcional, categoria opcional | El nombre es obligatorio. SKU no se repite si existe. |
| precio actual | Mayor que cero. Los precios historicos viven en la venta. |
| controlaStock | Define si descuenta stock. |
| stockActual, stockMinimo | Cantidades enteras mayores o iguales a cero. Valor inicial trazable. |
| activo | Un producto inactivo no se agrega a ventas nuevas. |

### Flujos y reglas

```text
Alta o importacion -> producto activo -> venta cerrada -> salida de stock
                                      -> ajuste autorizado -> movimiento de stock
```

- Cerrar una venta descuenta stock una sola vez, dentro de la misma transaccion que la venta.
- Si `controlaStock = false`, la venta no crea movimiento de stock.
- Stock negativo se bloquea por defecto. Un administrador puede permitirlo en una operacion puntual con motivo registrado.
- Corregir stock crea un movimiento `ADJUSTMENT`; nunca se cambia `stockActual` sin registro.
- Desactivar un producto conserva sus ventas y movimientos previos.

### Estados y movimientos

```text
Product:        ACTIVE | INACTIVE
StockMovement:  OPENING | SALE | SALE_REVERSAL | ADJUSTMENT | IMPORT
```

### Criterios de aceptacion

- La lista de venta solo muestra productos activos.
- Una venta de 2 unidades reduce el stock en 2 y deja un movimiento ligado a esa venta.
- Cambiar luego el precio o desactivar el producto no altera ninguna venta anterior.
- La pantalla muestra una alerta cuando `stockActual <= stockMinimo`.

## 6. Modulo de ventas y caja

### Flujo de venta

```text
Nueva venta
  -> buscar/tocar producto
  -> agregar items y cantidades
  -> asociar socio, opcional
  -> elegir medio de pago, opcional
  -> [Cobrar]
  -> venta cerrada + stock + puntos si hay socio
```

Ejemplo de pantalla:

```text
NUEVA VENTA                                      #1284
Buscar producto...

2 x Cappuccino                              $10.000
1 x Medialuna                                $1.500
--------------------------------------------------
TOTAL                                       $11.500

SOCIO            [ + Agregar miembro ]
PAGO             [ + Registrar pago ]       opcional

                         [ COBRAR $11.500 ]
```

### Reglas

- Una venta tiene uno o mas `SaleItem`. Cada item guarda producto, nombre, precio unitario, cantidad entera, subtotal e impuestos si se agregan luego.
- Una venta puede cerrar sin socio y sin medio de pago. Nunca puede cerrar sin items ni con total menor o igual a cero.
- Medios de pago del MVP: `CASH`, `TRANSFER`, `MERCADO_PAGO`, `CARD`, `OTHER`. El campo puede quedar vacio.
- El precio de venta se copia al item. Cambiar el precio actual no cambia la historia.
- El boton de cobro usa una clave de idempotencia. Un doble toque o reintento no crea dos ventas, dos descuentos de stock ni dos acreditaciones.
- La asociacion de socio se permite al crear la venta y tambien después, sin límite de tiempo, mientras esté cerrada, no anulada y aún no tenga socio. La acción del empleado y su registro de auditoría bastan para acreditar la asociación; el MVP no exige comprobante adicional.
- Al asociar un socio despues del cierre, el sistema acredita los puntos de inmediato usando la regla vigente en ese momento. No aplica la regla de la fecha original de venta.
- Una venta ya asociada no puede reasignarse. Un administrador debe anularla y crear una correccion documentada si hay error.

### Estados

```text
Sale: DRAFT -> CLOSED
      DRAFT -> VOID
      CLOSED -> VOID, solo administrador y con motivo
```

Anular una venta genera movimientos compensatorios de stock y puntos. Si la venta tenía un pago registrado, Ramax registra su estado como devuelto, pues la devolución se considera realizada al anular. No borra filas ni reescribe los movimientos originales.

### Criterios de aceptacion

- El empleado registra una venta con varios productos, sin socio y sin pago, y el sistema la cierra.
- Una venta con socio acredita los puntos una vez y muestra el resultado antes de cobrar.
- El empleado puede encontrar un socio por QR, numero de socio, nombre, email o telefono si existe.
- Asociar un socio a una venta previa crea una sola acreditacion y deja quien hizo la asociacion.
- Anular una venta restaura stock y revierte su acreditacion, sin eliminar el historial.

## 7. Importacion y exportacion compatible con LibreOffice

### Objetivo

Permitir una adopcion gradual. El equipo puede seguir trabajando con LibreOffice mientras Ramax empieza a concentrar ventas, stock y fidelizacion.

### Formatos y contratos

| Operacion | Formato | Hojas o columnas minimas |
|---|---|---|
| Importar productos | `.csv` UTF-8 o `.xlsx` | `sku`, `nombre`, `precio`, `controla_stock`, `stock_actual`, `stock_minimo`, `activo` |
| Importar stock | `.csv` UTF-8 o `.xlsx` | `sku`, `cantidad`, `tipo`, `motivo`, `fecha_opcional` |
| Importar ventas historicas | `.csv` UTF-8 o `.xlsx` | `referencia_venta`, `fecha`, `sku`, `cantidad`, `precio_unitario`, `medio_pago_opcional`, `socio_opcional` |
| Exportar productos, stock, ventas y movimientos | `.csv` UTF-8 y `.xlsx` | Una hoja o archivo por entidad, con fechas ISO 8601 y separador decimal estable |

### Reglas

- El administrador primero descarga la plantilla oficial. La importacion valida encabezados, tipos, referencias y duplicados antes de escribir.
- Cada fila trae resultado `CREATED`, `UPDATED`, `SKIPPED` o `ERROR`, con numero de fila y causa.
- No se aplica una importacion parcialmente valida sin confirmacion del administrador. Se puede elegir "rechazar todo" o "importar filas validas".
- `referencia_venta` funciona como clave de idempotencia de ventas importadas.
- Importar ventas cerradas crea items y stock. Por defecto no acredita puntos, para no premiar retroactivamente ni duplicar acreditaciones. El administrador puede habilitar esa acreditacion por lote solo si el socio se pudo resolver.
- Las exportaciones no sustituyen la auditoria interna. Son una copia interoperable para LibreOffice.

### Criterios de aceptacion

- Un `.xlsx` creado y guardado por LibreOffice se importa con acentos, precios y fechas correctos.
- Reimportar el mismo archivo de ventas no duplica ventas, stock ni puntos.
- Una fila con SKU desconocido informa el error y no crea una venta incompleta.
- Un administrador puede exportar ventas, productos, stock y puntos en formatos que LibreOffice abre sin pasos manuales.

## 8. Motor de puntos

### Regla configurable

La configuracion global define `pesosPorPunto`. Por ejemplo:

```text
1 punto cada $100

Cappuccino  $5.000  = 50 puntos
5 cappuccinos         = 250 puntos
Recompensa: cafe      = 250 puntos
Leyenda: "5 cappuccinos te dan un cafe gratis"
```

La interfaz administrativa calcula equivalencias con los productos actuales y la recompensa elegida. Es una ayuda de lectura, no una regla alternativa.

### Calculo y vigencia

```text
puntos acreditados = piso(total elegible / pesosPorPunto)
vencimiento = fecha de acreditacion + 365 dias
```

- La regla activa se usa al acreditar. Cambiarla toma efecto inmediato para acreditaciones futuras.
- Nunca se recalculan ventas, acreditaciones, vencimientos ni saldos historicos.
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
