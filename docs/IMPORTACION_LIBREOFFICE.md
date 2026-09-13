# Revisión de la planilla de LibreOffice

## Muestra revisada

Archivo: `samples/Ramax_Cafe_Club_Operacion.xlsx`.

La planilla tiene 17 hojas. Catorce contienen tablas estructuradas con encabezados en la fila 5. Las fechas y horas llegan como valores nativos de Excel. Los importadores deben convertirlas a UTC usando `America/Argentina/San_Luis`.

| Hoja | Filas de datos | Uso propuesto |
|---|---:|---|
| Productos | 18 | Importar solo productos de venta. |
| Recetas e insumos | 16 | Fuera del MVP actual. |
| Stock actual | 6 | Requiere decidir si el MVP manejará insumos. |
| Mov. stock | 16 | Requiere decidir si el MVP manejará insumos. |
| Proveedores y compras | 6 | Fuera del MVP actual. |
| Ventas | 5 | Importación histórica junto con detalle de ventas. |
| Detalle ventas | 13 | Ítems de la venta histórica. |
| Socios | 5 | Importación de perfiles sin identidad de Google. |
| Mov. puntos | 7 | No importar al libro vivo sin una migración de lotes aprobada. |
| Recompensas y canjes | 4 | Separar en catálogo y canjes antes de importar. |
| Caja | 4 | Fuera del MVP actual. |
| Gastos | 5 | Fuera del MVP actual. |
| Empleados y usuarios | 3 | Usar como referencia para el alta manual de usuarios internos. |
| Campañas | 3 | Importar solo campaña básica después de E5. |
| Dashboard, Parámetros, Auditoría | — | Solo lectura. Son resumen, configuración y controles de la planilla. |

## Validaciones encontradas

- Las 5 ventas suman $362.300 y coinciden con sus 13 líneas.
- Las acreditaciones de compra siguen la regla de 1 punto cada $100, redondeada hacia abajo.
- El libro de puntos incluye campaña, canje y ajuste, además de compras.
- La hoja de recompensas mezcla la definición de recompensa con un canje en la misma fila. Ramax las guarda en entidades separadas.
- Los importadores deben leer valores calculados, no fórmulas ni columnas derivadas. Por ejemplo, el total de venta se recalcula desde sus ítems y el saldo de puntos no se importa como fuente de verdad.

## Contrato de importación E4

La carga empieza siempre con una previsualización. Cada hoja recibe un informe por fila con `CREATED`, `UPDATED`, `SKIPPED` o `ERROR`. El administrador decide luego entre rechazar todo o aplicar solo las filas válidas.

| Origen | Destino | Clave de idempotencia | Tratamiento |
|---|---|---|---|
| Productos | `products` | `ID` | Solo filas con `Tipo = Venta`. Se ignoran precio final, IVA y puntos por unidad como campos derivados o incompatibles con la regla global de puntos. |
| Ventas + Detalle ventas | `sales` + `sale_items` | `ID venta` | Se valida que cada venta tenga ítems, cantidades enteras y total coincidente. La venta histórica no acredita puntos por defecto. |
| Socios | `members` | `ID socio` | Crea un perfil sin sesión. Al iniciar con Google, Ramax puede vincular la identidad solo si el email verificado coincide y los términos permiten ese vínculo. |
| Recompensas y canjes | `rewards` + `redemptions` | `ID recompensa` y `ID canje` | Requiere dos plantillas separadas. El campo `Stock` se convierte en cupo propio. |
| Campañas | `qr_campaigns` | `ID campaña` | Solo después de E5. No reconstruye QR, entradas ni experiencias desde métricas agregadas. |

## Fuera del contrato inicial

Recetas, insumos, proveedores, compras, caja y gastos no se importan en E4. La muestra gestiona insumos en gramos, mililitros y unidades. El MVP controla solo cantidades enteras de productos vendibles y no descuenta recetas al cerrar una venta.

Si en una etapa posterior Ramax necesita que la venta de un cappuccino reduzca café, leche y vasos, se agregan los módulos `ingredients`, `recipes` y `purchases`. No forman parte del MVP ni de su importación inicial.
