# Verificación visual de Ventas

final result: passed

Resultado para el alcance acordado: pantallas existentes de Ventas, con los datos que soportan los contratos actuales. No implica igualdad píxel a píxel con las imágenes generadas.

Las capturas y comparaciones usadas durante esta revisión son artefactos locales y no se versionan. Las rutas siguientes documentan la evidencia generada durante el trabajo; el comando de pruebas visuales vuelve a crear las capturas actuales.

## Referencias y capturas

- Referencias móviles: `docs/design/app-equipo/02-productos-venta.png`, `03-revisar-venta.png`, `05-cobrar-venta.png`, `06-venta-registrada.png`, `07-ventas.png`.
- Referencia administrativa: `docs/design/admin-e0-e1/05-detalle-anulacion-venta.png`.
- Capturas del navegador: `docs/design/comparisons/after-{320,390,1440}-{products,review,payment,transfer,registered,detail,history}.png`.
- Comparaciones completas: `docs/design/comparisons/compare-{products,review,payment,registered,history,detail}.png`.
- Antes/después móvil: `docs/design/comparisons/before-after-{products,review,payment,registered,history}.png`.
- Detalle de encabezados: `docs/design/comparisons/focus-*-header.png`.
- Comprobantes: `docs/design/comparisons/after-{320,390,1440}-receipt.pdf`.

Las imágenes móviles originales de 853 × 1844 se normalizaron a 390 × 844. La referencia administrativa se normalizó a 1440 × 1024. Las capturas usan viewport CSS 320 × 844, 390 × 844 y 1440 × 1024, con densidad 1. Cada comparación coloca referencia e implementación juntas, con una franja de título de 30 px. Se inspeccionaron también las capturas de 320 px y los importes/controles en las comparaciones completas.

## Iteraciones y correcciones

1. El catálogo usaba tarjetas y el historial una tabla; se sustituyeron por filas, cantidades y grupos por fecha. Las capturas `before-*` conservan el estado anterior disponible.
2. Se detectaron reglas repetidas, símbolos de menú/regreso y distribución estrecha de la revisión. Se consolidó CSS por contexto, se usaron iconos Phosphor y se adaptaron las filas a 320 px.
3. La comparación conjunta mostró importes poco destacados, filtros demasiado altos y el botón de cobro demasiado abajo. Se reforzó el tamaño de los importes, se compactaron filtros y filas, y se movió la cancelación debajo del cobro.
4. Se ajustaron el indicador de conexión, la proporción de la barra de pedido y el formato `$11.500`. Las capturas finales y las comparaciones mencionadas arriba contienen estas correcciones.

## Superficies revisadas

- **Fuentes:** Cormorant Garamond y Space Grotesk se cargan desde archivos locales, con licencias incluidas. Las pruebas confirman que ambas familias están cargadas. Jerarquía serif para títulos/importes y sans para controles.
- **Distribución:** encabezado compacto, navegación inferior, pedido fijo con espacio reservado, tarjetas de pago, número a izquierda/monto a derecha y paneles administrativos equilibrados. Sin desbordamiento horizontal en los tres tamaños probados. Controles de cantidad de al menos 44 × 44 px.
- **Colores:** se usan los tokens Ramax para verdes, crema, terracota y arena; estados y selección conservan contraste y foco visibles.
- **Imágenes:** emblema extraído de la referencia y servido como PNG transparente. No se inventaron fotos por producto: el contrato actual no dispone de imágenes de catálogo.
- **Contenido:** se conservan importes, cantidades, pago, estado, responsable y detalle reales de los contratos. No se simulan socios, puntos ni canjes dentro de la aplicación.

## Diferencias aceptadas y límites

- Caja/Ventas/Más reemplaza Caja/Ventas/Canjes según el alcance acordado; Más mantiene accesibles las rutas existentes.
- Las referencias contienen socios, puntos y acciones de asociación no implementadas en la API. Su omisión es intencional.
- Se mantiene el motivo de anulación como texto libre y la confirmación de transferencia exigidos por el flujo existente.
- Las referencias son imágenes con textura y tipografía ilustrada. Se usan las familias locales acordadas y superficies CSS sólidas; la textura fotográfica queda como refinamiento P3.
- Algunos datos de las referencias, estados de internet y números de ticket difieren de los fixtures. Se compararon composición y componentes equivalentes, sin atribuir esas diferencias a fallos visuales.
- El navegador integrado no estaba disponible. Las capturas se obtuvieron ejecutando las pruebas visuales Playwright existentes con respuestas interceptadas; no se usó la base de datos.

## Verificación funcional

Tres pruebas visuales aprobadas: 320, 390 y 1440 px. Cubren búsqueda, categorías, stock máximo, cantidades, revisión, efectivo/transferencia, confirmación, reintento con la misma clave, registro, impresión, anulación, historial, filtros, paginación, menú y permisos de empleado. No se detectaron errores JavaScript de página.

Para repetir las cuatro pruebas visuales, ejecutar desde la raíz:

```bash
corepack pnpm --filter @ramax/web exec playwright test --config playwright.visual.config.ts
```

La configuración inicia Vite en `http://127.0.0.1:5186` y usa respuestas de prueba interceptadas; no necesita una base de datos.

`pnpm check`, `pnpm test` y compilación aprobados. Las pruebas unitarias existentes sumaron 16 casos aprobados; 12 casos de integración de API se omitieron porque requieren su entorno de base de datos. El frontend no tiene pruebas unitarias; su verificación funcional se realizó mediante los tres recorridos visuales aislados.

## Vista de revisión

La prueba abre `/operacion` en el servidor temporal de Vite y muestra datos en memoria mediante respuestas interceptadas. Solo incluye Ventas y no cambia la configuración normal del frontend.

## Revisión adicional del listado de ventas

final result: passed

Se comparó `07-ventas.png` con las capturas finales de 390 y 1440 px. Evidencia conjunta: `docs/design/comparisons/compare-history.png`; antes/después del listado previo: `docs/design/comparisons/listing-before-after.png`. Se mantiene la normalización 853 × 1844 a 390 × 844 con densidad 1. Los estados adicionales están en `listing-states-390.png`, `listing-filters-390.png`, `listing-applied-390.png` y `listing-empty-390.png`.

- Se redujo el espacio de cada fila; número/hora quedan a izquierda e importe serif a derecha. Pago y responsable tienen una jerarquía secundaria; Finalizada y Anulada se distinguen por texto y color.
- Los encabezados indican Hoy/Ayer cuando corresponde, conservando la fecha explícita. El conteo superior corresponde al total informado por la API, no solo a la página visible.
- Búsqueda directa por número, panel compacto de fechas/estado/pago y resumen de filtros aplicados. Aplicar cierra el panel y vuelve a la primera página; limpiar restaura los campos y la consulta completa.
- Paginación únicamente cuando hay más de una página. Estados explícitos de carga, vacío y error con reintento; los datos anteriores no se presentan como resultado de una consulta fallida.
- Selectores Estado/Pago con nombres accesibles explícitos. Campos de fecha con límites cruzados; preservada la consulta por límites horarios de San Luis.
- Estilos del listado separados en `sales-history.css`, retirando sus reglas anteriores de `sales.css`. No se modificaron API ni contratos.

Se inspeccionaron encabezado, filas, importes, panel de filtros, estados anulados y recuperación de vacío/error. Pasaron cuatro pruebas de navegador: tres recorridos completos en 320/390/1440 px y uno específico del listado. Comprobación de tipos y compilación aprobadas. Las diferencias de socios/puntos y navegación siguen siendo las exclusiones acordadas.
