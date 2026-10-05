# Ramax Café Club

Ramax registra la operación de una única sucursal y ofrece una aplicación cloud para que sus socios consulten y usen los beneficios del club.

## Alcance

**MVP de Ramax**:
Primera versión del producto, completada al terminar E3: acceso, operación local, club cloud y beneficios.
_Evitar_: llamar MVP solamente a E1 o extenderlo más allá de E3

**Sucursal**:
Local físico donde se realizan las ventas. El MVP opera una sola sucursal.

**App del socio**:
Aplicación cloud donde el socio ingresa con Google y consulta perfil, número de socio, puntos, recompensas y canjes.

## Personas y acceso

**Socio**:
Persona inscrita en el club mediante una cuenta de Google verificada. Puede acumular puntos y solicitar canjes.

**Membresía**:
Cuenta cloud personal del Socio. Conserva nombre, email, teléfono opcional, estado y número de socio.

**Número de socio**:
Identificador aleatorio de seis dígitos, único y nunca reutilizable. Sirve para asociar una venta, pero no autentica ni concede acceso.

**Empleado**:
Integrante del personal que vende, consulta operación y socios, y entrega canjes. Usa una cuenta laboral individual.

**Administrador**:
Integrante del personal que hereda las capacidades del Empleado y administra catálogo, inventario, personal, membresías, puntos y recompensas.

**Cuenta laboral**:
Cuenta local con contraseña usada por un Empleado o Administrador. Permanece separada de cualquier Membresía de la misma persona.
_Evitar_: cuenta de socio, cuenta compartida

**Visitante**:
Persona sin sesión. Es un estado público y no un perfil persistido.

**Usuario eliminado**:
Etiqueta mostrada en el historial de una Membresía anonimizada. Conserva referencias operativas y de auditoría, pero no datos personales ni acceso.

**Anonimización**:
Acción exclusiva de un Administrador que elimina los datos personales y el acceso de una Membresía, pero conserva su historia como "Usuario eliminado".

## Venta e inventario

**Venta**:
Operación con uno o más items que se confirma una sola vez junto con un pago en efectivo o transferencia. Usa los precios vigentes y no admite descuentos durante el MVP.

**Número de venta**:
Número visible perteneciente a una secuencia creciente única de la sucursal. No se reinicia cada día.

**Cierre de venta**:
Confirmación que finaliza venta y pago y descuenta stock. Un fallo del club nunca invalida la venta.

**Comprobante de venta**:
Resumen imprimible sin validez fiscal que muestra número de venta, items, total, medio de pago, fecha y, si corresponde, los últimos cuatro dígitos del número de socio.

**Importe**:
Cantidad expresada en pesos argentinos enteros, sin centavos.

**Anulación de venta**:
Reversión completa que solo un Administrador confirma, con motivo obligatorio, después de devolver el dinero por fuera de Ramax. Restaura stock y revierte puntos sin borrar la Venta.

**Movimiento de stock**:
Registro inmutable que aumenta o disminuye las existencias por una causa identificable.

**Unidad de stock**:
Cantidad entera y no negativa de un producto. Ninguna operación puede dejar existencias negativas.

**Inventario inicial**:
Existencias de productos vendibles. No incluye recetas, insumos ni compras.

**Asociación tardía**:
Vínculo permitido durante las 24 horas posteriores al Cierre de venta entre un Socio y una Venta no anulada ni asociada. Usa la regla de puntos guardada al cerrar la Venta.

## Puntos y beneficios

**Libro de puntos**:
Registro inmutable de créditos y débitos de un Socio. Una Anulación de venta puede dejar saldo negativo si los puntos ya fueron consumidos.

**Regla de puntos**:
Regla global que acredita `piso(total de la venta / pesosPorPunto)`. Todos los productos participan y cada cambio afecta solo cierres posteriores.

**Lote de puntos**:
Porción de puntos que vence a las 21:00 cuando se cumplen 365 días desde su acreditación. El consumo toma primero el lote que vence antes.

**Puntos pendientes**:
Puntos de una Venta local que esperan confirmación cloud. No forman parte del saldo disponible hasta confirmarse.

**Recompensa**:
Beneficio canjeable por puntos. Puede tener un cupo propio opcional, independiente del inventario de productos.

**Canje**:
Solicitud de una cantidad de una Recompensa reunida en un único Ticket de canje. Al emitirlo descuenta puntos y reserva cupo.

**Ticket de canje**:
Credencial localizada mediante código manual que el personal valida al entregar la cantidad completa. Vence en 24 horas salvo configuración diferente de la Recompensa.

## Operación y control

**Auditoría**:
Registro inmutable de una acción crítica, su actor, motivo, fecha y entidad afectada.

**Hora de negocio**:
Hora usada para vencimientos. Ramax usa `America/Argentina/San_Luis` y procesa el vencimiento diario a las 21:00.
