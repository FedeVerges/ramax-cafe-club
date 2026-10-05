# Implementación de E0 y E1

## Entregado

- Acceso laboral con usuario normalizado, contraseña Argon2 y sesiones de 12 horas. Un perfil fijo por persona; cuentas cloud fuera del acceso local.
- Gestión de personal, restablecimiento, desactivación y revocación de sesiones. Protección del último administrador y auditoría sin contraseñas.
- Productos con stock inicial cero, edición, filtros y activación. Inventario con entradas/salidas, motivo, responsables y movimientos.
- Venta en memoria, revisión, efectivo/transferencia, confirmación de transferencia y comprobación del total vigente.
- Venta, pago único, artículos históricos, stock y auditoría transaccionales. Numeración secuencial sin reinicio diario.
- Reintentos con clave estable, alcance, actor y hash; expiración a 30 días sin reutilizar claves antiguas. Mutaciones de contraseñas usan un digest costoso para no debilitar Argon2.
- Historial paginado, detalle, ticket imprimible de 80 mm y anulación completa con devolución externa confirmada.
- Web servida localmente, sin fuentes o recursos externos. La disponibilidad de internet se informa por separado de la API local.
- Copias diarias verificadas mediante restauración temporal; retención de 30 días; mantenimiento durante restauración; registro externo de recuperación y conservación de la base anterior.
- Scripts de instalación Windows, HTTPS local, arranque sin sesión de escritorio y recuperación por consola.

## Cambios de contrato y migración

Los endpoints conservan `/api/v1`. Se agregaron `/staff`, `/sales/:id`, `/sales/:id/receipt`, `/backups`, `/backups/restore` y `/health`. El estado de restauración se consulta en `/backups`.

Las escrituras operativas requieren `idempotency-key`. Login recibe `username`; cierre de venta exige `paymentMethod` y `expectedTotalArs`; transferencia exige `transferConfirmed: true`. Anulación exige `reason` y `refundConfirmed: true`. No se admiten `initialQuantity`, `allowNegative` ni pagos distintos de efectivo/transferencia.

La migración `0002_dizzy_corsair.sql` preserva los IDs y la tabla física `users`, que queda exclusivamente laboral. Agrega `staff_role`, convierte email a username y conserva administradores existentes. Las antiguas tablas de roles quedan por compatibilidad de datos, pero no conceden permisos: la matriz fija compartida es la autoridad.

Conserva ventas compatibles y convierte claves antiguas en claves vencidas. Revoca sesiones existentes. Rechaza datos incompatibles como ventas sin pago, otros medios de pago, stock negativo o identidades sin perfil laboral. No inventa datos ni recrea bases automáticamente. Si el desarrollo contiene datos incompatibles, recrear únicamente esa base de prueba por una acción explícita.

## Verificación reproducible

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Las integraciones requieren PostgreSQL 17 y una base **aislada cuyo nombre termine en `_test`**. La suite operativa vacía sus tablas al comenzar. No usar datos reales.

```bash
TEST_DATABASE_URL=postgresql://USER:PASS@localhost:55433/ramax_test corepack pnpm --filter @ramax/api test
TEST_DATABASE_URL=postgresql://USER:PASS@localhost:55433/ramax_test corepack pnpm test:e2e
```

Ejecutar esas suites en secuencia porque comparten la base. Instalar Chromium con `corepack pnpm --filter @ramax/web exec playwright install chromium`. E2E usa la API y web compiladas; volver a ejecutar `build` después de cambios.

Para recuperación, usar una segunda base aislada, herramientas PostgreSQL nativas compatibles y rutas absolutas:

```bash
BACKUP_TEST_DATABASE_URL=postgresql://USER:PASS@localhost:55434/ramax_backup_test \
BACKUP_DIR=/ruta/aislada/copias \
PG_BIN_DIR=/ruta/postgresql/bin \
corepack pnpm --filter @ramax/api test
```

La suite cambia y restaura esa base deliberadamente. Comprueba restauración, venta posterior, rechazo de copia alterada y fallo de backup sin eliminar la última copia válida. En este entorno se ejecutó PostgreSQL en dos contenedores aislados; los binarios de PostgreSQL se invocaron mediante wrappers de prueba.

## Resultado y límite del piloto

Pasaron `check` y `build`, 4 tests de contratos, 19 tests de API/integración/recuperación y 2 flujos E2E en Chromium. Incluyen migración desde cero y desde datos anteriores, concurrencia, expiración/revocación de sesiones, backup y restauración. El flujo de navegador bloquea recursos externos y pierde intencionalmente la primera respuesta de cobro para comprobar su reintento.

Los artefactos de navegador se generan bajo `apps/web/test-results`: capturas de caja móvil, equipo y comprobante, más un PDF de 80 mm. No se versionan datos ni archivos de prueba.

Pendiente de aceptación en el local:

- Ejecutar el instalador en la PC Windows y verificar arranque sin iniciar sesión.
- Instalar y comprobar confianza del certificado en los dispositivos del personal.
- Imprimir un ticket físico de 80 mm.
- Probar caída de internet en la LAN real y reinicio inesperado de Windows.

Estas pruebas de hardware no se reemplazan por las pruebas realizadas en macOS. La guía está en [Operación Windows](./OPERACION_WINDOWS.md). E1 queda listo para esa aceptación, no declarado desplegado en el local.

## Validación de arranque local — 2026-10-04

- Se recuperó Docker Desktop, que no respondía, y se inició PostgreSQL de desarrollo.
- En la base aislada `ramax_test`, la API compilada sirvió la web y respondió a salud y login. Pasaron nuevamente los dos flujos E2E.
- Se detuvo y volvió a iniciar el proceso de API: salud respondió y la sesión anterior siguió autenticada.
- En esa validación, la base de desarrollo `ramax` tenía el esquema anterior y nueve entradas de migración. Se adaptó posteriormente con respaldo verificado, conservando cuentas, venta y tablas adicionales. El procedimiento está en [Operación local en Mac](./OPERACION_MAC_LOCAL.md).
- Este resultado comprueba el arranque local con datos compatibles; no valida el arranque automático de Windows, HTTPS ni el proceso de recuperación al iniciar Windows.
