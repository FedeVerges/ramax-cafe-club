# Plan de implementación de E2: club cloud

> Estado: plan de referencia. La implementación y sus pendientes actuales están en [IMPLEMENTACION_E2.md](./IMPLEMENTACION_E2.md). Alcance basado en [el MVP](./RAMAX_CAFE_CLUB_MVP.md), [el plan incremental](./PLAN_DESARROLLO_INCREMENTAL.md), [el glosario](../CONTEXT.md) y [la separación local/cloud](./adr/0002-operacion-local-y-club-cloud.md). E0/E1 están implementados, pero la aceptación del piloto en Windows e impresora sigue pendiente.

## Resultado de E2

Una persona entra al club con Google, recibe un número de socio de seis dígitos y consulta perfil, compras sincronizadas, saldo confirmado y movimientos. La sucursal asocia ese número a una venta al cobrar o dentro de las 24 horas siguientes. La venta funciona sin internet; cuando vuelve la conexión, cloud acredita los puntos **una sola vez**. La anulación revierte la acreditación aunque el saldo quede negativo.

```text
Google -> Membresía cloud -> Número de socio
                                |
Caja local -> Venta + regla guardada + outbox
                                |
                         HTTPS y reintentos
                                v
                    Inbox cloud -> Libro de puntos
                                |
                         App del socio
```

E2 termina en puntos y consultas. Las pantallas de beneficios y canjes ya tienen [maquetas interactivas](./design/MAQUETAS_INTERACTIVAS.md), pero su lógica pertenece a E3. Campañas y dashboards quedan después del MVP.

## Base real del repositorio

| Pieza | Hoy | Trabajo de E2 |
|---|---|---|
| API local y PostgreSQL | Ventas, pagos, stock, auditoría, sesiones y backup transaccionales | Agregar asociación, regla congelada, caché y outbox |
| API cloud | No hay proceso ni esquema cloud; `members` y `points` son módulos vacíos | Crear arranque cloud, migraciones, autenticación, membresías, puntos e inbox |
| Web | Caja y administración E0/E1 reales; 39 maquetas bajo `/maquetas/*` | Conectar las pantallas E2 pertinentes sin mezclar datos de ejemplo con producción |
| Contratos | Tipos de E0/E1 en `packages/contracts` | Definir respuestas de socio, puntos, venta asociada y eventos versionados |
| Infraestructura | Instalación local y backup diario | Despliegue cloud, credenciales de integración, observabilidad y copia cifrada central |

Los puntos de entrada actuales son `apps/api/src/app.module.ts`, `apps/api/src/modules/sales/sales.service.ts`, `db/schema`, `packages/contracts/src/index.ts` y `apps/web/src/app/router.tsx`. Las migraciones E0/E1 existentes no se editan; E2 añade migraciones nuevas.

## Decisiones técnicas al comenzar

1. **Dos bases y dos despliegues.** El proceso local conserva exclusivamente datos operativos; el proceso cloud conserva membresías y puntos. Crear `LocalAppModule` y `CloudAppModule`, o una composición equivalente, para que cloud no arranque módulos de ventas, backup ni autenticación laboral. Separar la configuración de migraciones de ambas bases antes de crear tablas cloud.
2. **Identidades separadas.** Google autentica al Socio ante cloud. La cuenta laboral y su cookie local siguen independientes. El número de socio identifica para la operación, pero nunca autentica. En Google, usar el `sub` verificado como clave estable; el email puede cambiar. Usar una biblioteca compatible con Google Identity Services, validar el token en el servidor y proteger el retorno con `state`. [Documentación de Google](https://developers.google.com/identity/openid-connect/openid-connect).
3. **El saldo viene del libro cloud.** Caja muestra el último saldo confirmado y la fecha de actualización; los puntos pendientes se presentan aparte. Ningún cálculo del navegador modifica el saldo.
4. **Sin transacción distribuida.** Cierre, asociación o anulación escriben venta, auditoría y evento de outbox en **una transacción local**. Cloud procesa cada evento junto con inbox, estado de la venta y libro en **una transacción cloud**. La confirmación local nunca espera a cloud.
5. **Regla congelada.** Cada venta guarda versión, `pesosPorPunto` y puntos calculados al cierre, incluso si no tiene socio. El cambio de regla necesita un protocolo de activación que impida que la caja use una versión que cloud aún no reconoce. Propuesta: cloud crea versión pendiente, local la descarga y confirma, y cloud la activa con una fecha efectiva futura conocida por ambos. Si se corta la conexión, la versión anterior sigue vigente. Probar explícitamente el corte en cada paso.

## Entregas verticales

| Corte | Entrega comprobable | Dependencias principales |
|---|---|---|
| 0. Preparación | E1 aceptado en hardware o riesgos del piloto registrados; entornos cloud de prueba, secretos, dominio y migraciones separados | Decisiones de alojamiento y credenciales Google |
| 1. Socios | Login Google, alta idempotente, número único, perfil, sesión, suspensión y anonimización auditadas | Base cloud y OAuth |
| 2. Puntos | Regla versionada, libro y lotes inmutables, saldo, historial, ajuste administrativo y vencimiento diario | Socios |
| 3. Vínculo local | Búsqueda por número, caché mínima, venta asociada, asociación tardía y puntos pendientes en caja, historial y comprobante | 1 y 2 |
| 4. Sincronización | Outbox, worker, autenticación entre servicios, inbox y procesamiento idempotente de cierre, asociación y anulación | 2 y 3 |
| 5. App y operación | Pantallas E2 reales del socio y administración, copia cifrada central, monitoreo, pruebas de caída y despliegue gradual | 1 a 4 |

Cada corte acaba con migración, contratos, pruebas y una demostración que usa datos persistidos. El corte 4 debe probarse con dos procesos y dos bases separadas.

### Corte 0. Preparar los entornos

- Elegir alojamiento para web del socio, API cloud, PostgreSQL cloud y almacenamiento de copias; fijar dominios HTTPS y ambiente de prueba separado de producción.
- Crear un arranque cloud distinto del local, comprobaciones de salud y readiness, migraciones cloud independientes, despliegue repetible y recuperación documentada.
- Guardar secretos fuera del repositorio; distinguir variables locales y cloud. El despliegue cloud detrás de un terminador TLS necesita una configuración distinta del `main.ts` local, que hoy exige archivos de certificado en producción.
- Preparar métricas y alertas para eventos pendientes/rechazados, retraso de sincronización, vencimiento de puntos, fallos OAuth y copias centrales.
- Resolver antes de publicar el piloto E1 en Windows, certificado local, impresión física y caída de internet real según [implementación E0/E1](./IMPLEMENTACION_E0_E1.md).

### Corte 1. Membresías y Google

- Tablas cloud: `members`, `google_identities`, `member_sessions`, `member_number_reservations` y auditoría cloud. `member_number` es texto de seis caracteres para preservar ceros iniciales; índice único y reserva permanente incluso tras anonimización.
- Login mediante Google, validación de identidad en la API cloud, alta automática idempotente por `sub`, sesión segura, logout y revocación. No unir cuentas por email. Registrar nombre, email verificado y teléfono opcional.
- Estados operativos `active`, `suspended`, `anonymized`. Suspender impide nuevas acreditaciones; anonimizar retira datos personales y acceso, pero deja referencias históricas con la etiqueta del glosario.
- API del Socio: sesión, perfil, edición de teléfono, número y estado. API de administración cloud para listar, consultar, suspender, reactivar y anonimizar con auditoría y permisos locales comprobados en el intermediario.
- Número aleatorio en el rango `000000` a `999999` generado en el servidor, con inserción y reintento ante colisiones. Nunca asignarlo desde el navegador.

### Corte 2. Libro y reglas de puntos

- Tablas cloud: `point_rules`, `point_ledger`, `point_lots`, `point_allocations` y `point_balances` si la consulta necesita una proyección. Índices únicos por causa de negocio, por ejemplo venta y tipo de movimiento. La proyección se reconstruye desde el libro.
- Regla global `piso(totalArs / pesosPorPunto)`. Validar enteros positivos y evitar cálculos de coma flotante. Guardar versiones y fecha efectiva; el Administrador cambia la regla desde el panel local mediante la API local.
- Acreditación, reversión y ajustes en transacciones cloud. Un ajuste exige Administrador y motivo. La reversión consume o compensa exactamente los puntos que esa venta acreditó; puede dejar saldo negativo. No bloquear compras nuevas por saldo negativo.
- Lotes con vencimiento a las 21:00 de `America/Argentina/San_Luis` al cumplirse 365 días de la acreditación. Worker diario idempotente: un lote vencido produce a lo sumo un débito, incluso tras reinicio o ejecución repetida. Dejar preparada la asignación de consumo por vencimiento para E3.
- API del Socio: saldo confirmado e historial paginado. API del Administrador: perfil, libro, ajuste y regla. El Empleado solo recibe nombre, estado, saldo y momento de actualización.

### Corte 3. Asociación en la sucursal

- Migración local: `sales.member_id`, `member_number_last4` o referencia equivalente, `member_attached_at`, `member_attached_by`, campos de regla congelada, `member_cache`, `outbox_events`. Mantener nombres y datos históricos de ventas E1 sin rellenar asociaciones inexistentes.
- Búsqueda `/api/v1/members/by-number/:number` protegida por permiso laboral. Online consulta cloud y actualiza solo nombre, identificador, estado, saldo confirmado y fecha de la caché. Offline devuelve una entrada conocida y marca su antigüedad; un número no conocido produce un estado claro para seguir vendiendo sin socio.
- Extender cierre de venta con `memberNumber?`. Si se asocia, guardar en la misma transacción la identidad consultada, regla, puntos estimados y evento. Si no se asocia, congelar igualmente la regla de puntos para permitir vínculo posterior.
- `POST /api/v1/sales/:id/member` con clave de idempotencia: exigir venta cerrada, sin socio previo, dentro de 24 horas según hora de cierre y actor laboral autenticado. Registrar la asociación y evento en la misma transacción. Un segundo intento para otro socio devuelve conflicto.
- Al anular, guardar `sale.voided` en outbox junto con stock, pago y auditoría ya existentes. El comprobante muestra solo los cuatro últimos dígitos. Caja, historial y detalle muestran puntos estimados, pendientes, confirmados o rechazados sin prometer saldo nuevo antes del acuse cloud.

### Corte 4. Sincronización confiable

- Sobre HTTPS, autenticar la instalación local con una credencial propia rotatable y alcance limitado. Cloud no confía en `actor` enviado por un navegador; la API local valida la cuenta laboral y transmite su ID en una solicitud autenticada de servidor a servidor. No exponer el inbox como endpoint público sin esta validación.
- Evento compartido versionado: `eventId`, `eventType`, `schemaVersion`, `sourceId`, `saleId`, `saleVersion`, `occurredAt`, datos mínimos de negocio y `payloadHash`. Los tres tipos son `sale.closed`, `sale.member_attached` y `sale.voided`.
- Worker local toma eventos pendientes sin carreras, envía lotes acotados, aplica backoff con variación, persiste intentos y último error. Conserva los rechazos definitivos para revisión; no reabre ni revierte ventas. La pantalla o herramienta operativa muestra cola, último acuse y capacidad de reintento.
- Cloud inserta `eventId` único en inbox y actualiza su proyección de la venta y el libro en la misma transacción. Un duplicado devuelve el mismo acuse. Reordenamientos se resuelven por `saleVersion`: un evento con predecesor faltante espera; una anulación conocida impide acreditar después. No acreditar dos veces por el mismo `saleId`.
- Resolver el estado de aceptación de la asociación en cloud: activa acredita; suspendida o inexistente rechaza sin tocar venta ni stock local. El rechazo queda visible para Administrador y empleado en el detalle de venta, con motivo comprensible.
- Reconciliación diaria compara ventas asociadas locales, acuses de inbox y créditos/reversiones cloud; informa diferencias y permite reenviar eventos. La restauración de una copia local antigua puede reponer eventos ya recibidos: el inbox y la reconciliación deben aceptar ese replay sin duplicar puntos.

### Corte 5. Pantallas reales, copias y lanzamiento

- Convertir las vistas E2 de `/maquetas/club/*` en componentes presentacionales compartidos con la app real. Conectar acceso, inicio, movimientos, compras y cuenta a la API cloud. Mantener `/maquetas/*` como galería con datos de ejemplo. Las vistas de beneficio, ticket y canje siguen como maquetas hasta E3.
- En la app del equipo conectar búsqueda de socio, estado sin conexión, puntos pendientes y asociación tardía. En administración agregar socios, libro y configuración de regla según el sistema visual existente; estas pantallas aún requieren diseño E2 específico.
- Copia central: cifrar el dump local antes de subirlo, guardar hash y metadatos, limitar acceso a la clave y al objeto, programar reintentos y probar descarga, descifrado y restauración en entorno aislado. Mantener las copias locales y su retención actuales.
- Publicar primero en un entorno interno con socios de prueba, luego en la sucursal con una ventana de observación. Registrar saldo y cola antes y después. Si falla cloud, desactivar funciones del club sin detener ventas locales; si falla el nuevo cierre, volver a la versión E1 con migraciones compatibles.

## Contratos mínimos que conviene fijar antes de programar

| Contrato | Campos/resultado | Invariante |
|---|---|---|
| Búsqueda laboral | `memberNumber`, `displayName`, `status`, `confirmedBalance`, `syncedAt`, `source` | Nunca email, teléfono ni libro para Empleado |
| Cierre de venta | Entrada E1 + `memberNumber?`; respuesta + estado de puntos | Precio, pago y stock se cierran una vez; club no decide el cierre |
| Asociación tardía | Número de socio y clave de idempotencia | Una venta, un socio y límite de 24 horas |
| Evento de venta | Identidad estable, versión por venta y regla congelada | Se inserta junto con la operación local |
| Acuse cloud | `eventId`, `accepted | deferred | rejected`, motivo y saldo si corresponde | Duplicados devuelven el mismo resultado |
| Saldo del Socio | Confirmado, movimientos y fecha de actualización | No incluye eventos pendientes de la sucursal |

Definir estos tipos en `packages/contracts`, DTOs validados en ambas API y ejemplos de errores. La respuesta de venta E1 debe seguir funcionando para clientes previos durante la transición.

## Pruebas que habilitan la salida

| Nivel | Casos que deben pasar |
|---|---|
| Reglas puras | Cálculo entero, cambio de versión, 365 días y 21:00 local, saldo negativo, número con ceros iniciales |
| Integración cloud | Alta Google repetida, colisión de número, suspensión, anonimización, ajuste auditado, vencimiento duplicado, inbox duplicado/desordenado |
| Integración local | Venta con socio online, venta con caché offline, número desconocido, asociación a las 23:59 y rechazo a las 24:00, anulación antes y después del acuse, idempotencia de cada escritura |
| Entre procesos | Cortar internet antes/después del envío y antes/después del acuse; reiniciar ambos servicios; restaurar copia local anterior; verificar un único crédito o débito cloud y venta local intacta |
| Navegador y operación | Alta, inicio, puntos, compras, búsqueda en caja, pendiente, confirmación, rechazo y vista del Administrador; control de permisos y dispositivos móviles |
| Copias | Subida cifrada, contenido y hash verificados, fallo de red, recuperación en una base aislada y clave inaccesible para el navegador |

**Criterio de aceptación final:** dos intentos de la misma venta o evento producen una sola acreditación; una venta offline sigue cobrada e imprimible; una asociación tardía válida acredita según la regla guardada; una anulación revierte exactamente lo acreditado, incluso con saldo negativo; el socio consulta todo desde cloud con la PC de la sucursal apagada.

## Decisiones pendientes antes del corte 0

1. Proveedor y región de alojamiento, dominios y almacenamiento de copias. El plan evita atarse a uno hasta conocer presupuesto y operación deseada.
2. Valor inicial de `pesosPorPunto` y quién podrá aprobar sus cambios. Las maquetas usan ejemplos distintos; no deben convertirse en configuración productiva por accidente.
3. Qué ocurre si una membresía anonimizada vuelve a entrar con la misma cuenta Google. Hay que fijar esa política antes de diseñar la reserva permanente del número y la eliminación de identidad.
4. Política de retención del libro, auditoría cloud, eventos e información personal, incluida la recuperación de una copia antigua después de una anonimización.

Estas decisiones no impiden preparar entornos de prueba, contratos, migraciones ni pruebas de sincronización.
