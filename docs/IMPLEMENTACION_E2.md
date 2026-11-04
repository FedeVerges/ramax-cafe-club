# Implementación E2: club y puntos

## Estado

La implementación funcional está preparada para **desarrollo y pruebas con dos API y dos bases PostgreSQL**. La caja local puede asociar un socio al cierre o durante las 24 horas siguientes. La operación local conserva el cobro cuando cloud está caído; el outbox envía la venta después. Cloud registra la compra y acredita, rechaza o revierte puntos una sola vez.

| Área | Estado |
|---|---|
| Membresía con Google, número de seis dígitos, sesión y perfil | Implementado; falta probar un acceso real con credenciales Google del proyecto. El piloto permite un socio de prueba con código privado |
| Regla, libro, ajustes, suspensión y vencimiento | Implementado y probado con PostgreSQL |
| Caja, asociación tardía, historial y administración | Implementado y probado entre procesos |
| App del socio: inicio, puntos, compras paginadas y cuenta | Conectada a API; requiere prueba manual con Google |
| Beneficios y canjes | Maquetas de E3; la vista real dice “Próximamente” |
| Despliegue cloud, dominios, monitoreo y copia central cifrada | El piloto transitorio instala caja y club en la misma notebook Debian; despliegue real, monitoreo y copia central siguen pendientes |
| Anonimización y retención | Pendientes de política de producto y datos |

## Arranque local de desarrollo

1. Aplicar las migraciones locales nuevas a la base operativa después de una copia. Crear una **base cloud separada** y aplicar `db:cloud:migrate` con `CLOUD_DATABASE_URL` apuntando a ella. No ejecutar las migraciones cloud sobre la base de caja.
2. Copiar `.env.cloud.example` a `.env.cloud`. Configurar `CLOUD_DATABASE_URL`, `GOOGLE_CLIENT_ID`, un UUID en `CLUB_SOURCE_ID` y un secreto aleatorio de al menos 32 caracteres en `CLUB_SERVICE_TOKEN`.
3. Poner en `.env` el mismo `CLUB_SOURCE_ID` y `CLUB_SERVICE_TOKEN`, además de `CLUB_CLOUD_API_URL=http://localhost:3200/api/v1`. Configurar `VITE_GOOGLE_CLIENT_ID` con el mismo cliente Google y autorizar el origen web en Google.
4. Arrancar cloud, API local y Vite en terminales separadas:

```bash
corepack pnpm --filter @ramax/api db:cloud:migrate
corepack pnpm --filter @ramax/api dev:cloud
corepack pnpm dev:api
corepack pnpm dev:web
```

El administrador entra por `/club-admin`; la persona socia, por `/club/acceso`. Para el piloto se acordó **1 punto por cada $100** del total. El administrador debe guardar `pesosPorPunto = 100` antes de asociar ventas; el formulario ya propone ese valor. La caja puede seguir vendiendo sin club. En producción, publicar web y cloud detrás de HTTPS, con secretos fuera del repositorio.

Sin credenciales Google, configurar `PILOT_MEMBER_LOGIN_ENABLED=true` y un `PILOT_MEMBER_ACCESS_CODE` aleatorio de al menos 24 caracteres en cloud. La pantalla `/club/acceso` muestra el campo para ese código y crea una sola cuenta compartida de prueba. Desactivar la variable al terminar el piloto. Este acceso no comprueba la integración con Google.

## Semántica operativa

```text
Cierre local ───► outbox local ───► inbox cloud ───► libro cloud
    │                  │                │
    └─ venta cobrada   └─ reintentos    └─ acuse: confirmada/rechazada
```

- La regla y los puntos estimados quedan guardados en cada venta. Cambiar la regla genera otra versión con activación diferida.
- La búsqueda laboral devuelve datos mínimos. Una entrada conocida en caché permite trabajar sin internet y muestra la fecha de sincronización.
- Un evento inválido se conserva como rechazado; fallas de red y de autenticación se reintentan. La venta cobrada nunca se deshace por un rechazo del club.
- El saldo visible para el socio procede solo del libro cloud. Los puntos pendientes de la caja se muestran por separado.
- El vencimiento usa 365 días y las 21:00 de `America/Argentina/San_Luis`. La anulación de una compra ya vencida no repite el débito.

## Verificación ejecutada

| Comando/prueba | Resultado |
|---|---|
| `corepack pnpm check`, `corepack pnpm build`, `corepack pnpm test` | Pasan; la suite general omite integraciones sin URL de prueba |
| `cloud.integration.test.ts` con `CLOUD_TEST_DATABASE_URL` | 11 casos: seguridad, acceso piloto, inbox, puntos, administración, vencimiento y paginación |
| `club-local.integration.test.ts` con `E2_LOCAL_TEST_DATABASE_URL` | 4 casos de caja y caché |
| `e2-sync.integration.test.ts` con dos URL de prueba | 4 casos: sincronización, caída cloud, administración, rechazo definitivo y compra del socio piloto |

También se probó en Chromium el formulario de acceso piloto: rechazó un código incorrecto y abrió la cuenta de prueba con el código configurado.

Las pruebas de integración **vacían sus bases** y exigen nombres terminados en `_test`. Ejecutarlas en secuencia si comparten una base. No se probó todavía un acceso Google real, un despliegue público ni recuperación de una copia central.

## Pendientes antes del piloto

1. Elegir proveedor, región, dominio HTTPS y almacenamiento de copias. Añadir despliegue repetible, métricas de cola/rechazos y copia cifrada con restauración probada.
2. La regla inicial del piloto es $100 por punto; solo el Administrador puede cambiarla. El café gratis será una Recompensa canjeable con puntos en E3. Falta fijar qué café incluye y su costo en puntos para concretar la relación de cinco cafés por uno.
3. Resolver la reentrada de una cuenta Google tras anonimización y el plazo de retención; entonces implementar la anonimización con prueba de restauración de copia antigua.
4. Probar en navegador el acceso Google real, móvil, desconexión y reanudación, y completar la aceptación pendiente de E0/E1 en el equipo Windows e impresora.
5. Incorporar una vista operativa de conciliación/reenvío para colas grandes antes de usar E2 con datos de producción.

El alcance original y sus criterios están en [el plan E2](./PLAN_IMPLEMENTACION_E2.md).
