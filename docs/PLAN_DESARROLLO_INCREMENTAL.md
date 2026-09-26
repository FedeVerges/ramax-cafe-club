# Ramax Cafe Club. Plan de desarrollo incremental

## 1. Decisión de arquitectura

La prioridad del proyecto no es “cloud-first”. La prioridad es que la caja opere sin depender del internet ni de servicios externos para cerrar ventas, descontar stock y dejar auditoría clara.

Por eso, la arquitectura correcta para este negocio es:

- monolito modular en una sola base de código,
- API local por sucursal para operación real,
- PostgreSQL como sistema de persistencia principal,
- React para la capa operativa y la experiencia del socio,
- sincronización periódica con un backend central solo para reporting, administración y casos no críticos en tiempo real.

Esto reduce costo, elimina dependencia de un proveedor externo para la operación del local y acelera el primer entregable funcional.

```text
Sucursal / local
├── POS web local (tablet / escritorio)
├── API local NestJS
├── PostgreSQL local
├── Auditoría y stock en tiempo real
└── Sincronización periódica con backend central

Backend central (opcional / posterior)
├── reportes
├── administración global
├── socios y club
├── campañas
└── dashboards y exportación
```

La caja no debería depender de la nube para trabajar. El club y la administración pueden tolerar más latencia, pero la operación del punto de venta no.

## 2. Criterio de entrega

Cada fase es un corte vertical y termina con una parte operable en producción. Incluye interfaz, reglas, persistencia, permisos, auditoría e idempotencia del flujo entregado.

No habrá una fase inicial formada solo por infraestructura. La base técnica se construye dentro del primer flujo usable.

```text
E0 Base ejecutable
   -> E1 Caja operativa local
      -> E2 Socios y puntos
         -> E3 Canjes
            -> E4 Migración / LibreOffice
               -> E5 Campañas QR
                  -> E6 Operación, métricas y sincronización
```

## 3. Arquitectura propuesta

Para 1.000 socios y un negocio de punto de venta, conviene un monolito modular y no microservicios. Los microservicios agregan despliegues, fallos distribuidos y costo sin resolver un problema real de escala.

El repositorio mantiene:

- una app web React para operaciones y club,
- una API NestJS,
- PostgreSQL con Drizzle ORM,
- un modelo de dominio orientado a transacciones y auditoría.

```text
ramax-cafe-club/
├── apps/
│   ├── web/                       # React + Router + UI local
│   │   └── src/
│   │       ├── app/
│   │       ├── features/
│   │       └── shared/
│   └── api/                       # NestJS
│       └── src/
│           ├── common/
│           ├── database/
│           └── modules/
├── packages/
│   ├── contracts/
│   ├── api-client/
│   ├── config/
│   └── ui/
├── db/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
├── docs/
│   └── adr/
├── CONTEXT.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Experiencia de usuario

- `/operacion`: caja, productos, stock, comprobantes, identificación y validación.
- `/club`: perfil, saldo, puntos, QR y canjes.
- `/admin`: catálogo, usuarios, permisos, ajustes y auditoría.
- La caja se diseña para tablet y escritorio con controles táctiles amplios.
- La app de socios se diseña móvil primero.
- El backend decide seguridad; la UI solo guía al usuario.

### Rutas principales

```text
/                         -> sesión y home según rol
/login                    -> acceso interno / club / personal
/club                     -> socio
/club/puntos              -> saldo e historial
/club/recompensas         -> catálogo y solicitud
/club/qr                  -> QR personal
/club/perfil              -> perfil y sesión
/operacion                -> empleado / admin
/operacion/ventas/nueva   -> caja
/operacion/ventas         -> historial
/operacion/stock          -> consulta y ajustes autorizados
/operacion/socios         -> búsqueda y asociación
/operacion/canjes         -> validación de tickets
/admin                    -> admin
/admin/productos          -> catálogo y precios
/admin/recompensas        -> administración de recompensas
/admin/campanas           -> campañas QR
/admin/usuarios           -> usuarios y permisos
/admin/auditoria          -> eventos y trazabilidad
```

### Backend

- NestJS y TypeScript en un único despliegue lógico por sucursal.
- Los controladores traducen HTTP; los servicios de aplicación ejecutan casos de uso; los repositorios usan Drizzle.
- Drizzle es la capa de persistencia elegida. El esquema vive en TypeScript, las migraciones quedan versionadas y las restricciones de PostgreSQL se usan para integridad real.
- La API expone `/api/v1`.
- Las reglas críticas residen en servicios: `closeSale`, `voidSale`, `attachMemberToSale`, `requestRedemption`, `validateRedemption`.
- La venta se cierra en una transacción: stock, venta, pagos y puntos si aplica.
- Los canjes también se validan dentro de transacciones con idempotencia y prevención de doble validación.
- El sistema debe soportar pérdida de conexión sin romper la caja: se prioriza transacción local y sincronización posterior.

### Módulos de dominio

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `auth` | login, sesiones y home path | `users-and-roles`, `members`, `audit` |
| `users-and-roles` | usuarios, roles y permisos | `audit` |
| `members` | perfil, QR y estado del socio | `audit` |
| `products` | catálogo y precios | `audit` |
| `inventory` | stock, mínimo y movimientos | `products`, `audit` |
| `sales` | ventas, pagos, anulación y asociación | `products`, `inventory`, `members`, `points`, `audit` |
| `points` | libro de puntos, lotes y vencimiento | `members`, `audit` |
| `rewards` | recompensas y cupos | `points`, `audit` |
| `redemptions` | solicitud, validación y cancelación | `rewards`, `points`, `members`, `audit` |
| `campaigns` | campañas QR y participación | `members`, `points`, `audit` |
| `audit` | trazabilidad inmutable | `database` |

Se evita acoplar módulos de bajo nivel con flujos complejos. `inventory` no conoce ventas, `points` no conoce canjes y `members` no conoce campañas. Los flujos orquestan dependencias dentro de transacciones.

## 4. Persistencia y operatividad local

- PostgreSQL es la fuente de verdad en cada sucursal.
- La caja depende de la base local para vender, reembolsar y auditar.
- La sincronización con el backend central es periódica y no crítica para operar la venta.
- Se deja definido el flujo de backup local, restauración y registro de cambio.
- La importación desde LibreOffice se considera un mecanismo de coexistencia y migración gradual, no una base de operación diaria.

## 5. Modelo de datos

| Dominio | Tablas principales | Regla importante |
|---|---|---|
| Identidad | `users`, `roles`, `permissions`, `user_roles`, `auth_identities`, `sessions` | empleados/admin usan cuentas internas; socios pueden entrar por Google o login local según definición posterior |
| Socios | `members`, `member_qr_tokens` | QR opaco, revocable y único |
| Productos y stock | `products`, `stock_balances`, `stock_movements` | todo movimiento queda registrado |
| Ventas | `sales`, `sale_items`, `payments`, `sale_member_links`, `idempotency_keys` | la anulación conserva el historial y compensa stock |
| Puntos | `point_ledger_entries`, `point_lots` | no se editan movimientos históricos |
| Recompensas y canjes | `rewards`, `redemptions`, `redemption_tickets` | un ticket se valida una sola vez |
| Campañas | `qr_campaigns`, `campaign_scans`, `campaign_participations` | no duplicar participación |
| Auditoría | `audit_events` | solo inserciones |

Las tablas críticas llevan `id`, `created_at`, `updated_at` y control de concurrencia cuando aplica. El idempotency key se guarda con alcance, actor, request hash y vencimiento.

## 6. Endpoints principales

Todos viven bajo `/api/v1` y validan DTOs y permisos.

| Área | Endpoints | Permiso |
|---|---|---|
| Autenticación | `GET /auth/me`, `POST /auth/login`, `POST /auth/logout` | usuario autenticado / público según tipo |
| Socios | `GET/PATCH /members/me`, `GET /members/lookup`, `POST /members/:id/qr/rotate` | propio; `members.read`; `members.manage` |
| Productos e inventario | `GET /products`, `POST/PATCH /products`, `GET /inventory`, `POST /inventory/adjustments` | `products.read`; `products.manage`; `inventory.read`; `inventory.adjust` |
| Ventas | `POST /sales`, `GET /sales`, `GET /sales/:id`, `POST /sales/:id/void`, `POST /sales/:id/member` | `sales.create`; `sales.read`; `sales.void`; `sales.member.attach` |
| Puntos | `GET /members/me/points`, `GET /members/:id/point-ledger`, `POST /members/:id/point-adjustments` | propio; `points.read`; `points.adjust` |
| Recompensas y canjes | `GET /rewards`, `POST/PATCH /rewards`, `POST /redemptions`, `POST /redemptions/:id/validate`, `POST /redemptions/:id/cancel` | `rewards.read`; `rewards.manage`; propio; `redemptions.validate`; `redemptions.cancel` |
| Campañas | `GET /campaigns/:slug`, `POST /campaigns/:slug/participations`, `GET/POST/PATCH /campaigns` | público; socio; `campaigns.manage` |
| Administración | `GET/POST/PATCH /users`, `POST /members/:id/anonymize`, `GET /audit-events` | `users.manage`; `members.anonymize`; `audit.read` |

Los requests de escritura usan idempotency key para evitar dobles cobros o doble validación.

## 7. Autenticación y permisos

- Los empleados y administradores usan cuentas internas.
- El primer sprint puede arrancar con contraseña y hash Argon2id.
- El login con Google puede agregarse después sin cambiar la base de permisos.
- Los roles iniciales son `member`, `employee` y `admin`.
- `GET /auth/me` devuelve usuario, permisos y `homePath`.
- El frontend redirige a `/club`, `/operacion` o `/admin` según rol.
- Cada operación crítica registra auditoría en la misma transacción o bloquea el cambio.

## 8. Estrategia de pruebas

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Unidad | reglas de venta, stock, permisos, vencimientos y reversas | Vitest |
| Integración | transacciones PostgreSQL, idempotencia y migraciones | Vitest + PostgreSQL efímero |
| API | DTOs, seguridad y respuestas | Supertest |
| E2E | venta, anulación, acumulación y canje | Playwright |

Cada entrega incluye prueba de demo y prueba de integración para movimientos irreversibles.

## 9. Plan de implementación incremental

| Entrega | Resultado usable | Módulos y rutas principales |
|---|---|---|
| E0 | base ejecutable y navegación | `auth`, `users-and-roles`, `audit`, `/login` |
| E1 | caja operativa local | `products`, `inventory`, `sales`, `/operacion` |
| E2 | socios y puntos | `members`, `points`, `/club` |
| E3 | recompensas y canjes | `rewards`, `redemptions`, `/club/recompensas`, `/operacion/canjes` |
| E4 | importación y coexistencia | import/export y LibreOffice |
| E5 | campañas QR | `campaigns`, landing y gestión |
| E6 | operación, métricas y sincronización | dashboards, backup, rollout |

## 10. Entregables

### E0. Base y diseño mínimo

Objetivo: dejar la plataforma ejecutándose con navegación por rol.

Incluye:

- mapa de la caja actual y convivencia con LibreOffice,
- wireframes de venta, productos y stock,
- permisos y auditoría,
- esquema inicial y decisiones técnicas,
- criterios básicos de backup y soporte.

### E1. Caja operativa local

Primer sistema que el local puede usar en una venta real.

Incluye:

- acceso de administrador y empleado,
- alta, edición y desactivación de productos,
- stock inicial y ajustes con motivo,
- venta de varios productos,
- pago opcional y cobro idempotente,
- descuento de stock y alerta de mínimo,
- anulación administrativa con compensación,
- historial y auditoría básica.

Demo:

```text
Crear producto -> cargar stock -> vender 2 unidades
-> venta cerrada -> stock -2 -> anular -> stock restaurado
```

### E2. Socios y puntos

Entrega el circuito de fidelización.

Incluye:

- ingreso y creación de socio,
- perfil, QR y estado,
- búsqueda de socio desde caja,
- asociación durante la venta,
- regla de puntos y saldo,
- historial del socio,
- ajustes manuales solo para administrador.

### E3. Recompensas y canjes

Completa el ciclo principal del negocio.

Incluye:

- catálogo visible por saldo y vigencia,
- administración de recompensas,
- solicitud de ticket,
- validación en caja,
- cancelación y vencimiento,
- historial para socio y operación.

### E4. Migración y LibreOffice

Reduce la doble carga y habilita la migración gradual.

Incluye:

- plantillas oficiales,
- importación idempotente de productos y stock,
- importación de ventas históricas,
- validación por fila,
- exportación de ventas y puntos,
- auditoría del lote importado.

### E5. Campañas QR

Agrega adquisición y recurrencia sin comprometer la caja.

Incluye:

- campaña, landing y beneficio,
- escaneo y participación,
- puntos como beneficio inicial,
- cupo total, pausa y cierre,
- métricas básicas.

### E6. Operación, métricas y sincronización

Incluye:

- tablero de ventas y stock,
- auditoría y permisos finales,
- backup y restauración,
- sincronización con central,
- prueba piloto y ajustes de lanzamiento.

## 11. Orden y dependencias

| Entrega | Puede operar | Depende de |
|---|---|---|
| E0 | base ejecutable | - |
| E1 | caja y stock | E0 |
| E2 | socios y acumulación | E1 |
| E3 | fidelización completa | E2 |
| E4 | migración gradual | E1 y E2 |
| E5 | campañas | E2, idealmente después de E3 |
| E6 | lanzamiento controlado | E1 a E5 |

Con un solo equipo, el orden recomendado es E0 → E1 → E2 → E3 → E4 → E5 → E6.

## 12. Recomendación de primer hito

Empezar con E0 y E1. El criterio de salida no es “backend listo”, sino que un empleado pueda:

- crear productos,
- cargar stock,
- vender varios items,
- cierre la operación,
- anular la venta si hace falta,
- ver el historial y la auditoría.

Ese corte es el que entrega valor real al negocio y deja la base para club, puntos y canjes sin introducir complejidad innecesaria ni dependencia de la nube.
