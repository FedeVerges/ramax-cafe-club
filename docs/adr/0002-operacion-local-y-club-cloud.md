# ADR 0002. Operación local y club cloud

## Estado

Aceptada.

## Contexto

La sucursal debe vender aunque pierda internet, mientras que el Socio necesita consultar puntos y canjes desde cualquier lugar. Una solución solo local impediría el acceso remoto y una solución solo cloud convertiría la conexión en requisito para vender.

## Decisión

La PC administrativa aloja la API y PostgreSQL locales para personal, catálogo, inventario, ventas, pagos y auditoría. La aplicación del Socio y los datos de membresía, puntos, recompensas y canjes viven en cloud. El panel administrativo se sirve localmente y usa la API local como intermediaria para las funciones cloud. Desde E2, un outbox local sincroniza eventos idempotentes con un inbox central. La venta local se confirma antes de sincronizar y nunca se revierte por un fallo del club.

## Consecuencias

La caja continúa operando sin internet y la aplicación del Socio no depende de que la PC local esté encendida. Los canjes, la administración del club y la actualización del saldo requieren conexión. La primera versión depende de que la PC administrativa esté encendida para operar ventas y necesita backup diario local con copia cifrada central cuando haya internet.
