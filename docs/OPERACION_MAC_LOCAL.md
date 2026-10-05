# Réplica local en esta Mac

La instalación de desarrollo usa PostgreSQL 17 en Docker y la API compilada para servir web y `/api/v1` en el mismo origen, `http://localhost:3000`.

## Iniciar y detener

Abrir Docker Desktop. Desde la raíz del repositorio:

```bash
corepack pnpm start:local
```

El comando espera que PostgreSQL esté listo y ejecuta API y proceso de copias. `Ctrl+C` detiene ambos procesos; PostgreSQL conserva los datos. No migra ni recrea bases al iniciar. Si cambia el código, detener, ejecutar `corepack pnpm build` y volver a iniciar.

La configuración está en `.env` y `.env.local`, ambos privados. Las credenciales del administrador `admin` se guardaron en `var/local-adaptation/access.json`, con permisos privados. Las dos cuentas anteriores conservaron sus contraseñas; sus emails normalizados son ahora sus usuarios.

## Adaptación de la base anterior

Se guardó `var/local-adaptation/before-e01.dump` y se restauró en `ramax_adaptation_test`. La adaptación y dos flujos de Playwright pasaron sobre esa copia antes de adaptar `ramax`.

El historial tenía siete migraciones adicionales conocidas. Se conservaron esas entradas y las tablas de la versión anterior. Se renombró el hash anterior a `legacy_request_hash`, se corrigió la unicidad de idempotencia para incluir al actor y se aplicó la migración E0/E1 existente. La adaptación es transaccional y rechaza historiales distintos o datos incompatibles. Nunca se reescribió el historial para aparentar una base nueva.

Comando de mantenimiento empleado, después de verificar el respaldo:

```bash
node --env-file=.env --import ./apps/api/node_modules/tsx/dist/loader.mjs apps/api/scripts/adapt-legacy-local.ts --confirm
```

No repetirlo sobre una base ya adaptada. Se conservaron las dos cuentas anteriores y la venta existente; se agregó un administrador de prueba. No se registraron ventas de prueba en la base activa.

## Copias y límites

El proceso de copias guarda archivos en `var/local-backups`, verifica cada copia restaurándola temporalmente y conserva 30 días. Las herramientas de `scripts/local` usan el contenedor PostgreSQL para leer y escribir las copias en la Mac. No incluyen contraseñas en argumentos de consola.

La primera copia de la base activa se validó correctamente. La interfaz permite consultar copias y solicitar restauraciones. Las copias anteriores al cambio se recuperan con el código y esquema anteriores; el dump previo se conserva por separado.

## Datos de prueba

Con la réplica en ejecución:

```bash
corepack pnpm seed:demo --confirm
```

Carga datos mediante la API y conserva los existentes:

- 18 productos en cinco categorías; 17 activos y uno desactivado. Incluye productos sin seguimiento de stock, con stock bajo y agotados.
- Dos empleados activos, `demo_manana` y `demo_tarde`, y una cuenta desactivada, `demo_inactivo`. Las contraseñas generadas están en `var/demo/access.json`, fuera de Git.
- 24 ventas: 16 en efectivo y 8 por transferencia simulada. Cuatro se anulan con devolución simulada y restitución de stock; quedan 20 finalizadas.
- Ingresos de stock, merma de dos cookies y aumento del Espresso de $2100 a $2300. Los comprobantes anteriores conservan $2100.

Los productos tienen SKU `DEMO-*` y las operaciones usan claves `ramax-demo-v1:*`. El registro privado `var/demo/seed.json` permite reanudar y repetir sin duplicar pasos terminados. Conservarlo junto con la base; no borrarlo para recargar existencias. El seed no reabastece ni modifica ventas posteriores realizadas manualmente. Si una cuenta demo se desactiva o cambia su contraseña, la repetición puede requerir intervención administrativa.

Los datos se identifican como prueba en descripciones, nombres de personal, movimientos y motivos. No se envían pagos ni devoluciones externos. Se guardaron copias verificadas antes y después de la primera carga.

## Prueba del circuito en la réplica activa

Se probó una venta desde Chromium móvil con `demo_manana`: Latte y medialuna, total $4600, venta N.º 26. Se bloqueó el acceso externo del navegador y se simuló el indicador de internet caído; no se cortó físicamente la conexión de la Mac.

Se perdió intencionalmente la primera respuesta de cobro después de que la API registrara la venta. El reintento conservó la clave y produjo una sola venta y un solo descuento. El stock de medialunas pasó de 70 a 69.

Se generó un comprobante PDF de 80 mm. El empleado no recibió controles administrativos. El administrador anuló la venta con devolución simulada; el stock volvió a 70. Un segundo intento de anulación recibió conflicto y no volvió a incrementar stock.

El resultado y las capturas están en `var/local-validation`; el comprobante está en `ticket-80mm.pdf`. La venta de prueba quedó anulada y visible en el historial. Esta prueba no reemplaza una caída real de internet ni la impresión física.

Esta réplica requiere Docker Desktop y el comando de arranque abiertos. El inicio automático de Windows, HTTPS en la LAN e impresión física se verifican en la PC del negocio según [Operación Windows](./OPERACION_WINDOWS.md).
