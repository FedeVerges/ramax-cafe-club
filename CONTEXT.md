# Contexto del dominio

## Términos

| Término | Significado |
|---|---|
| Socio | Persona inscrita en el club. Puede tener una identidad de Google y acumular o consumir puntos. |
| Usuario eliminado | Etiqueta mostrada en el historial de una membresía anonimizada. Conserva referencias operativas y de auditoría, pero no datos personales ni acceso. |
| Usuario | Cuenta autenticada de una persona. Puede ser socio, empleado o administrador. En el inicio se usa su `primary_role` para elegir el área. |
| Usuario interno | Usuario que opera el local como empleado o administrador. No es necesariamente socio. |
| Venta | Operación de caja cerrada con uno o más ítems. Una anulación no borra la venta. |
| Movimiento de stock | Registro inmutable que aumenta o disminuye las existencias por una causa identificable. |
| Unidad de stock | Cantidad entera de un producto. El MVP no admite fracciones. |
| Inventario inicial | Existencias de productos vendibles en unidades enteras. No incluye recetas, insumos ni compras. |
| Libro de puntos | Registro inmutable de créditos y débitos de puntos de un socio. |
| Lote de puntos | Porción de puntos acreditada en un momento y con una fecha de vencimiento. El consumo toma primero el lote que vence antes. |
| Recompensa | Beneficio canjeable por puntos. Puede tener un cupo propio opcional y no modifica el inventario de productos vendibles. |
| Canje | Solicitud de una recompensa que reserva puntos y emite un ticket. Su validación entrega el beneficio. |
| Ticket de canje | Credencial única y con vencimiento que un empleado valida al entregar una recompensa. |
| Asociación tardía | Vínculo de un socio a una venta cerrada. No vence, pero la venta no puede estar anulada ni tener otro socio. La acción auditada del empleado es la prueba suficiente en el MVP. |
| Campaña QR | Experiencia pública identificada por QR que puede registrar un escaneo y conceder un beneficio una vez por socio. |
| Auditoría | Registro inmutable de una acción crítica, su actor, motivo, fecha y entidad afectada. |
| Anonimización | Acción exclusiva de un administrador que elimina los datos personales de una membresía, invalida su acceso y QR, y conserva sus registros históricos como "Usuario eliminado". |
| Rol principal | Rol que define el destino de una sesión al iniciar. En el MVP los destinos son `/club`, `/operacion` y `/admin`. |
| Hora de negocio | Hora usada para cierres y vencimientos. Ramax usa `America/Argentina/San_Luis`; el proceso diario corre a las 21:00. |
