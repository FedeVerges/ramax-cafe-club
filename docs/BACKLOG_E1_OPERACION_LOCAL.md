# Backlog E1. Operación local

> Backlog de referencia. Implementación y evidencias actuales: [E0/E1](./IMPLEMENTACION_E0_E1.md). La aceptación de Windows e impresora física continúa pendiente.

## 1. Resultado de la entrega

E1 termina cuando una sucursal puede preparar su catálogo, cargar stock, vender sin internet, imprimir un comprobante, consultar el historial, anular una venta y restaurar una copia local.

```text
Producto -> Stock -> Venta -> Pago -> Comprobante
                              |
                              v
                    Historial -> Anulación

Datos locales -> Backup diario -> Restauración probada
```

E1 no incluye socios, puntos, sincronización con el club ni canjes. Esas funciones empiezan en E2 y E3.

## 2. Forma de trabajo

Cada historia se implementa de punta a punta. No se considera terminada si solo tiene interfaz o API.

Orden interno recomendado:

1. contrato compartido;
2. datos y migración;
3. API y permisos;
4. interfaz;
5. integración y pruebas.

Estados del backlog:

| Estado | Significado |
|---|---|
| Pendiente | Todavía no comenzó. |
| Parcial | Existe código, pero no cumple todo el contrato del MVP. |
| Lista | Tiene diseño, reglas y dependencias resueltas. |
| En curso | Alguien está trabajando en la historia. |
| QA | Implementación completa, pendiente de verificación. |
| Terminada | Cumple sus criterios y la definición de terminado. |

## 3. Dependencias de E0

Antes de cerrar E1 deben estar disponibles:

- sesión local del personal;
- perfiles fijos Empleado y Administrador;
- permisos validados por la API;
- una cuenta individual por integrante;
- auditoría con el usuario responsable.

E1 puede avanzar con datos de prueba mientras E0 termina, pero las pruebas de permisos dependen de esas capacidades.

## 4. Orden de ejecución

| Corte | Historias | Resultado demostrable |
|---|---|---|
| E1.1 Preparación | E1-01 a E1-05 | El Administrador prepara productos y stock. El Empleado los consulta. |
| E1.2 Venta | E1-06 a E1-10 | El Empleado cobra una venta y obtiene el comprobante. |
| E1.3 Control | E1-11 y E1-12 | El personal consulta ventas y el Administrador anula una completa. |
| E1.4 Recuperación | E1-13 a E1-15 | La operación resiste la caída de internet y puede restaurarse. |
| E1.5 Aceptación | E1-16 | El flujo completo pasa las pruebas obligatorias. |

## 5. Historias y tareas

### E1-01. Cerrar los contratos locales

Estado: Parcial.

Como equipo de desarrollo queremos contratos compartidos estables para que la web y la API implementen las mismas reglas.

Tareas:

- [ ] Limitar `PaymentMethod` a `cash | transfer`.
- [ ] Hacer obligatorio `paymentMethod` al cerrar una venta.
- [ ] Definir contratos de producto, ajuste de inventario, listado y detalle de venta.
- [ ] Incorporar `saleNumber`, estado, fecha, pago, artículos y responsable a las respuestas de venta.
- [ ] Definir el contrato del comprobante imprimible.
- [ ] Definir códigos de error para stock insuficiente, idempotencia inválida y venta ya anulada.
- [ ] Agregar pruebas del paquete `contracts`.

Criterios de aceptación:

- Web y API importan los mismos tipos públicos.
- Ningún contrato admite tarjeta, Mercado Pago, otro medio o pago ausente.
- Los importes y cantidades son enteros.

### E1-02. Adaptar el modelo de datos

Estado: Parcial. Depende de E1-01.

Como sistema local quiero guardar el contrato definitivo de E1 para conservar cada venta y su historia.

Tareas:

- [ ] Reducir los medios de pago persistidos a efectivo y transferencia.
- [ ] Agregar una secuencia única y visible para `saleNumber`.
- [ ] Asegurar un solo pago por venta.
- [ ] Guardar el hash del request en cada clave de idempotencia.
- [ ] Definir vencimiento y limpieza de claves de idempotencia.
- [ ] Prohibir saldos de inventario negativos mediante servicio y restricción de datos.
- [ ] Generar y revisar la migración con Drizzle.
- [ ] Agregar pruebas de migración sobre una base vacía y una base con datos de desarrollo.

Criterios de aceptación:

- Dos ventas nunca reciben el mismo número.
- Una venta tiene exactamente un pago.
- La base rechaza stock negativo incluso si una validación de la API falla.
- Una clave de idempotencia no se reutiliza con un request diferente.

### E1-03. Maquetar la estructura local

Estado: Parcial. Diseño disponible.

Como integrante del personal quiero navegar la caja y la administración según mi perfil.

Referencias:

- [Caja móvil](./design/app-equipo/01-caja.png)
- [Administración local](./design/admin-e0-e1/README.md)

Tareas:

- [ ] Construir el layout móvil de Caja, Ventas y operación.
- [ ] Construir el layout de escritorio para Productos, Inventario, Equipo y Copias de seguridad.
- [ ] Mostrar solo opciones permitidas por el perfil.
- [ ] Retirar campañas y dashboards de la navegación del MVP.
- [ ] Crear componentes compartidos de botones, campos, tablas, estados y diálogos.
- [ ] Implementar carga, vacío, error y confirmación.
- [ ] Verificar navegación por teclado, foco visible y tamaños táctiles.

Criterios de aceptación:

- Empleado y Administrador ven navegaciones diferentes.
- Ocultar una acción no reemplaza el control de permisos de la API.
- Las pantallas móviles y de escritorio conservan el lenguaje visual aprobado.

### E1-04. Administrar productos

Estado: Parcial. Depende de E1-01 y E1-03.

Como Administrador quiero crear, editar y desactivar productos para mantener el catálogo vendible.

Referencia: [Administración de productos](./design/admin-e0-e1/03-administracion-productos.png).

Tareas:

- [ ] Adaptar la API existente al contrato final.
- [ ] Separar el stock del formulario de edición del producto.
- [ ] Implementar búsqueda y filtros por categoría y estado.
- [ ] Implementar alta y edición con precio entero mayor que cero.
- [ ] Implementar activación y desactivación sin borrar historia.
- [ ] Mantener SKU opcional y único cuando existe.
- [ ] Restringir escrituras al Administrador.
- [ ] Auditar alta, edición y cambio de estado.
- [ ] Agregar pruebas unitarias, de integración y de permisos.

Criterios de aceptación:

- El Empleado consulta el catálogo, pero no lo modifica.
- Un producto inactivo no aparece en ventas nuevas.
- Cambiar el precio no altera ventas anteriores.

### E1-05. Consultar y ajustar inventario

Estado: Parcial. Depende de E1-02, E1-03 y E1-04.

Como Administrador quiero registrar entradas y salidas con motivo para mantener el stock correcto.

Referencia: [Ajuste de inventario](./design/admin-e0-e1/04-ajuste-inventario.png).

Tareas:

- [ ] Eliminar `allowNegative` del contrato y del servicio.
- [ ] Implementar listado de saldos y búsqueda de productos.
- [ ] Mostrar movimientos del producto seleccionado.
- [ ] Implementar entrada o salida con cantidad positiva y motivo obligatorio.
- [ ] Mostrar stock actual y resultado antes de confirmar.
- [ ] Registrar responsable, fecha, motivo y saldo resultante.
- [ ] Restringir ajustes al Administrador.
- [ ] Agregar pruebas de concurrencia para impedir stock negativo.

Criterios de aceptación:

- El Empleado consulta saldos, pero no ajusta.
- Ninguna salida deja stock negativo.
- Cada ajuste genera movimiento y auditoría en la misma transacción.

### E1-06. Crear una venta en memoria

Estado: Parcial. Depende de E1-03 y E1-04.

Como Empleado quiero seleccionar productos y cantidades para preparar una venta sin guardar borradores.

Referencias:

- [Productos de la venta](./design/app-equipo/02-productos-venta.png)
- [Revisar venta](./design/app-equipo/03-revisar-venta.png)

Tareas:

- [ ] Implementar búsqueda, categorías y estados sin productos.
- [ ] Impedir seleccionar productos inactivos o sin stock.
- [ ] Implementar cantidades enteras y eliminación de artículos.
- [ ] Mostrar subtotales y total en pesos enteros.
- [ ] Separar carga y revisión según las maquetas.
- [ ] Conservar la venta solo en memoria del navegador.
- [ ] Descartar el pedido al cancelar o abandonar el flujo.
- [ ] Agregar pruebas de componentes y navegación.

Criterios de aceptación:

- Recargar o cancelar no crea una venta ni un borrador.
- El pedido contiene al menos un producto antes de avanzar.
- El total usa los precios vigentes recibidos de la API.

### E1-07. Cobrar y cerrar una venta

Estado: Parcial. Depende de E1-01, E1-02, E1-05 y E1-06.

Como Empleado quiero elegir un medio de pago y confirmar una vez para cerrar la venta.

Referencia: [Cobrar venta](./design/app-equipo/05-cobrar-venta.png).

Tareas:

- [ ] Mostrar solamente efectivo y transferencia.
- [ ] Pedir confirmación manual para transferencia sin guardar referencia.
- [ ] No pedir efectivo recibido ni calcular vuelto.
- [ ] Enviar una clave de idempotencia estable durante todos los reintentos del mismo cobro.
- [ ] Comparar el hash del request antes de devolver una respuesta idempotente.
- [ ] Insertar venta, artículos, pago, salida de stock y auditoría en una transacción.
- [ ] Asignar el siguiente número de venta de la sucursal.
- [ ] Bloquear toques repetidos mientras se resuelve el primer envío.
- [ ] Agregar pruebas de doble envío y cierres concurrentes.

Criterios de aceptación:

- Dos toques generan una sola venta, un pago y una salida de stock.
- Un reintento idéntico devuelve la venta original.
- Reutilizar la clave con otro pedido devuelve conflicto.
- Si falta stock, no queda ningún registro parcial.

### E1-08. Mostrar la venta registrada

Estado: Pendiente. Depende de E1-07.

Como Empleado quiero ver la confirmación para saber que la venta terminó correctamente.

Referencia: [Venta registrada](./design/app-equipo/06-venta-registrada.png).

Tareas:

- [ ] Mostrar número secuencial, fecha, artículos, pago y total.
- [ ] Reemplazar el identificador UUID truncado por `saleNumber`.
- [ ] Permitir iniciar una venta nueva sin reutilizar la clave anterior.
- [ ] Mostrar errores recuperables sin duplicar el cobro.
- [ ] Preparar el espacio visual donde E2 mostrará puntos pendientes.

Criterios de aceptación:

- La confirmación usa datos devueltos por la API.
- Volver o recargar no repite la venta.

### E1-09. Emitir el comprobante

Estado: Pendiente. Depende de E1-07.

Como Empleado quiero imprimir un comprobante para entregarlo al cliente.

Tareas:

- [ ] Implementar consulta de datos del comprobante por venta.
- [ ] Crear una vista de impresión sin controles de navegación.
- [ ] Mostrar número, fecha, artículos, cantidades, precios, total y pago.
- [ ] Indicar que no es un comprobante fiscal.
- [ ] Mantener el espacio para los últimos cuatro dígitos del socio desde E2.
- [ ] Verificar impresión y exportación a PDF desde el navegador.

Criterios de aceptación:

- El comprobante conserva los datos históricos de la venta.
- Imprimir no cambia el estado de la venta.

### E1-10. Funcionar sin internet

Estado: Pendiente. Depende de E1-03, E1-07 y del despliegue local.

Como Empleado quiero vender cuando falla internet para que la sucursal siga operando.

Tareas:

- [ ] Servir la aplicación del personal desde la infraestructura local.
- [ ] Evitar dependencias externas para cargar fuentes, imágenes o código crítico.
- [ ] Mostrar estado de conexión a internet sin confundirlo con la disponibilidad local.
- [ ] Confirmar que catálogo, inventario, ventas, historial y comprobantes usan solo la API local.
- [ ] Probar el flujo con acceso a la red local y salida a internet bloqueada.

Criterios de aceptación:

- La venta completa funciona sin conexión a internet.
- Un fallo futuro del club no revierte pago, stock ni comprobante local.

### E1-11. Consultar historial y detalle

Estado: Parcial. Depende de E1-01, E1-03 y E1-07.

Como integrante del personal quiero consultar todas las ventas para revisar una operación anterior.

Referencias:

- [Historial de ventas](./design/app-equipo/07-ventas.png)
- [Detalle de venta](./design/admin-e0-e1/05-detalle-anulacion-venta.png)

Tareas:

- [ ] Paginar el listado completo de la sucursal.
- [ ] Filtrar por fecha, número, estado y medio de pago.
- [ ] Implementar detalle con artículos, pago y responsable.
- [ ] Permitir reimprimir el comprobante.
- [ ] Mostrar la anulación sin ocultar la venta original.
- [ ] Preparar el acceso a asociación tardía para E2.
- [ ] Agregar pruebas de permisos y filtros.

Criterios de aceptación:

- Empleado y Administrador consultan todo el historial local.
- La interfaz no limita el historial al día actual.
- Una venta anulada conserva sus datos originales.

### E1-12. Anular una venta completa

Estado: Parcial. Depende de E1-02, E1-05, E1-07 y E1-11.

Como Administrador quiero anular una venta completa para corregir una operación sin borrar su historia.

Referencia: [Detalle y anulación](./design/admin-e0-e1/05-detalle-anulacion-venta.png).

Tareas:

- [ ] Exigir motivo y confirmación de devolución externa.
- [ ] Mantener la acción oculta para el Empleado y rechazarla en la API.
- [ ] Restaurar todas las cantidades controladas por stock.
- [ ] Marcar el pago como revertido sin registrar una devolución monetaria interna.
- [ ] Conservar artículos, importes, responsable y venta original.
- [ ] Registrar responsable, fecha, motivo y auditoría.
- [ ] Hacer segura la repetición de la solicitud.
- [ ] Preparar el evento `sale.voided` para E2 sin depender del cloud.
- [ ] Agregar pruebas de anulación repetida y concurrente.

Criterios de aceptación:

- Solo el Administrador puede anular.
- La anulación es completa y restaura stock una vez.
- La operación local termina aunque E2 todavía no exista o el cloud esté caído.

### E1-13. Crear el backup local diario

Estado: Pendiente. Depende de E1-02.

Como Administrador quiero una copia local diaria para recuperar la operación ante una falla.

Referencia: [Backup y restauración](./design/admin-e0-e1/06-backup-restauracion.png).

Tareas:

- [ ] Definir ubicación, horario y política de retención local.
- [ ] Ejecutar el backup automático de PostgreSQL.
- [ ] Guardar fecha, estado, versión de esquema y archivo asociado.
- [ ] Evitar incluir secretos en los metadatos o logs.
- [ ] Mostrar última ejecución y copias disponibles.
- [ ] Registrar y mostrar fallos sin borrar la última copia válida.
- [ ] Dejar la copia cifrada central para E2.

Criterios de aceptación:

- El proceso crea una copia diaria utilizable sin intervención manual.
- Un fallo queda visible y no se reporta como copia correcta.

### E1-14. Restaurar una copia local

Estado: Pendiente. Depende de E1-13.

Como Administrador quiero restaurar una copia seleccionada para recuperar una base local utilizable.

Referencia: [Backup y restauración](./design/admin-e0-e1/06-backup-restauracion.png).

Tareas:

- [ ] Restringir la operación al Administrador.
- [ ] Mostrar qué copia se restaurará y qué datos posteriores pueden perderse.
- [ ] Exigir una confirmación explícita.
- [ ] Impedir nuevas escrituras durante la restauración.
- [ ] Restaurar la base y validar la versión del esquema.
- [ ] Reiniciar los servicios locales de forma controlada.
- [ ] Registrar resultado y responsable fuera de la base que será reemplazada.
- [ ] Documentar el procedimiento de recuperación si la interfaz no inicia.

Criterios de aceptación:

- Una copia seleccionada restaura productos, stock, ventas, pagos y auditoría.
- La interfaz nunca indica éxito antes de validar la base restaurada.

### E1-15. Preparar la instalación local

Estado: Pendiente. Depende de E1-10, E1-13 y E1-14.

Como responsable de la sucursal quiero que los servicios locales inicien con la PC administrativa para operar sin pasos técnicos diarios.

Tareas:

- [ ] Definir configuración de producción local para web, API y PostgreSQL.
- [ ] Iniciar servicios automáticamente con la PC.
- [ ] Implementar chequeos de salud de API y base.
- [ ] Documentar instalación, actualización y recuperación.
- [ ] Probar reinicio inesperado durante una operación.
- [ ] Verificar que ninguna credencial se incluya en el repositorio.

Criterios de aceptación:

- Reiniciar la PC recupera la aplicación local sin comandos manuales.
- La interfaz distingue servidor local caído de internet caído.

### E1-16. Ejecutar la aceptación de E1

Estado: Pendiente. Depende de E1-01 a E1-15.

Como responsable del piloto quiero verificar el flujo completo antes de usarlo en la sucursal.

Tareas:

- [ ] Ejecutar `corepack pnpm check`.
- [ ] Ejecutar `corepack pnpm test`.
- [ ] Ejecutar pruebas E2E del flujo local.
- [ ] Probar venta en efectivo y transferencia.
- [ ] Probar doble toque y reintento después de una respuesta perdida.
- [ ] Probar stock insuficiente y cierres concurrentes.
- [ ] Probar venta sin salida a internet.
- [ ] Probar historial, impresión y anulación.
- [ ] Restaurar un backup en un entorno limpio y repetir una consulta y una venta.
- [ ] Registrar cualquier deuda que quede fuera de E1.

Criterios de aceptación:

- Todos los escenarios obligatorios de E1 pasan.
- No quedan medios de pago, campañas, dashboards ni cierres de caja dentro del flujo.
- El piloto puede ejecutarse con una sucursal y una PC administrativa.

## 6. Definición de terminado

Una historia pasa a Terminada cuando:

- cumple todos sus criterios de aceptación;
- respeta permisos en la API, no solo en la interfaz;
- registra auditoría cuando cambia información crítica;
- incluye estados de carga, vacío, error y éxito cuando corresponden;
- tiene pruebas de reglas y fallos relevantes;
- no rompe `corepack pnpm check` ni `corepack pnpm test`;
- actualiza contratos y documentación si cambió una decisión.

## 7. Primer lote para implementar

El primer lote recomendado es:

1. E1-01 Cerrar los contratos locales.
2. E1-02 Adaptar el modelo de datos.
3. E1-04 Administrar productos.
4. E1-05 Consultar y ajustar inventario.
5. E1-06 Crear una venta en memoria.
6. E1-07 Cobrar y cerrar una venta.

Este lote termina con una demostración concreta: crear un producto, cargar stock y venderlo una sola vez con efectivo o transferencia.
