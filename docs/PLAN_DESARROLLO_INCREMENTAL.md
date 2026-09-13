# Ramax Cafe Club. Plan de desarrollo incremental

## 1. Criterio de entrega

Cada fase es un corte vertical y termina con una parte operable en producción. Incluye interfaz, reglas, persistencia, permisos, auditoría y pruebas del flujo entregado.

No habrá una fase inicial formada solo por infraestructura. La base técnica se construye dentro del primer flujo usable.

```text
E1 Caja operativa
   -> E2 Socios y puntos
      -> E3 Canjes
         -> E4 Interoperabilidad
            -> E5 Campañas
               -> E6 Operación y métricas
```

## 2. Arquitectura propuesta

Para 1.000 socios conviene un monolito modular. Los microservicios agregarían despliegues, fallos distribuidos y costo sin resolver un problema real de escala. El repositorio contiene una aplicación React y una API Nest. La aplicación separa sus experiencias por rutas y permisos. Nunca accede a PostgreSQL.

```text
ramax.app
├── /club             socios, móvil primero
├── /operacion        empleados, desktop y tablet
└── /admin            administradores
          |
   React + TypeScript + Vite + React Router
          |
      API HTTP /api/v1, NestJS
          |
  módulos de negocio, permisos y auditoría
          |
     PostgreSQL + Drizzle ORM
```

### Estructura del monorepo

Se usará `pnpm` workspaces. Para este tamaño no hace falta Turborepo: los scripts raíz ejecutan pruebas, lint y builds de la web y la API. Se despliegan por separado.

```text
ramax-cafe-club/
├── apps/
│   ├── web/                       # Vite y React Router
│   │   └── src/
│   │       ├── app/               # providers, rutas y layouts
│   │       ├── features/          # club, operacion y admin
│   │       └── shared/            # sesión, utilidades y componentes locales
│   └── api/                       # NestJS
│       └── src/
│           ├── common/            # filtros, guards, configuración
│           ├── database/          # cliente Drizzle y transacciones
│           └── modules/           # un directorio por dominio
├── packages/
│   ├── contracts/                 # DTOs, esquemas Zod y tipos públicos
│   ├── api-client/                # cliente HTTP tipado, sin reglas de negocio
│   ├── config/                    # ESLint, TypeScript y Prettier
│   └── ui/                        # componentes sin lógica de dominio, posterior a design.md
├── db/
│   ├── schema/                    # definición Drizzle por dominio
│   ├── migrations/                # SQL generado, versionado y revisado
│   └── seeds/                     # datos locales de prueba
├── docs/
│   └── adr/
├── CONTEXT.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Aplicación React

- `/club` cubre puntos, recompensas, QR, perfil y campañas. Se diseña móvil primero.
- `/operacion` cubre ventas, stock, búsqueda de socios y validación de canjes. Se diseña para monitor de caja y tablet, con controles táctiles amplios.
- `/admin` cubre productos, recompensas, campañas, usuarios, permisos, ajustes y auditoría.
- React Router agrupa las rutas por área. Un `RequireArea` consulta la sesión y redirige a su área de inicio cuando el usuario intenta entrar a otra. Esto mejora la experiencia, pero NestJS toma la decisión de seguridad.
- Los estilos iniciales usan tokens semánticos. `design.md` definirá valores visuales sin alterar rutas, contratos ni lógica.

### Rutas React

```text
/                         -> consulta GET /auth/me y navega a homePath
/login                    -> acceso para socios o personal
/auth/complete            -> finaliza el regreso de Google
/club                     -> RequireArea(member)
/club/puntos              -> saldo e historial
/club/recompensas         -> catálogo y solicitud
/club/qr                  -> QR personal
/club/perfil              -> perfil y sesión
/operacion                -> RequireArea(employee | admin)
/operacion/ventas/nueva   -> caja
/operacion/ventas         -> historial de ventas
/operacion/stock          -> consulta y ajustes autorizados
/operacion/socios         -> búsqueda y asociación
/operacion/canjes         -> validación de tickets
/admin                    -> RequireArea(admin)
/admin/productos          -> catálogo y precios
/admin/recompensas        -> administración de recompensas
/admin/campanas           -> campañas QR
/admin/usuarios           -> usuarios, roles y permisos
/admin/auditoria          -> consulta de eventos
```

### Backend

- NestJS y TypeScript en un único despliegue lógico. Los controladores traducen HTTP; los servicios de aplicación ejecutan casos de uso; los repositorios acceden a Drizzle.
- Drizzle ORM es la opción elegida. El esquema vive en TypeScript, los tipos se infieren, y las migraciones quedan como SQL versionado y fácil de revisar. Es una opción más simple que Prisma para un backend Nest donde las transacciones y restricciones de PostgreSQL importan mucho.
- La API publica `/api/v1`, genera OpenAPI desde decoradores Nest y publica Swagger solo en entornos internos.
- Las reglas críticas viven en servicios Nest. Por ejemplo, `closeSale`, `voidSale`, `attachMemberToSale`, `requestRedemption` y `validateRedemption`.
- Una transacción PostgreSQL cierra una venta, descuenta stock y acredita puntos. Otra transacción confirma o revierte un canje. Las restricciones únicas evitan duplicados cuando un cliente reintenta.
- Un proceso programado diario dentro de Nest vence lotes de puntos y tickets a las 21:00 de `America/Argentina/San_Luis` (GMT-3). Para el volumen inicial no hacen falta colas ni un worker independiente. Reutiliza los mismos casos de uso y transacciones que la API.

### Módulos Nest y dependencias

| Módulo | Responsabilidad | Puede depender de |
|---|---|---|
| `auth` | Inicio con Google, sesiones, `homePath` y guards | `users-and-roles`, `members`, `audit` |
| `users-and-roles` | Usuarios, roles, permisos y rol de inicio | `audit` |
| `members` | Perfil, estado y QR opaco del socio | `audit` |
| `products` | Catálogo, precio y estado de productos | `audit` |
| `inventory` | Saldos, mínimos y movimientos inmutables | `products`, `audit` |
| `sales` | Venta, ítems, pagos, anulación y asociación de socio | `products`, `inventory`, `members`, `points`, `audit` |
| `points` | Libro, lotes, saldo, acreditación, consumo y vencimiento | `members`, `audit` |
| `rewards` | Catálogo de recompensas y cupos propios opcionales | `points`, `audit` |
| `redemptions` | Solicitud, ticket, validación, vencimiento y devolución | `rewards`, `points`, `members`, `audit` |
| `campaigns` | Landing, escaneos, participación y beneficio QR | `members`, `points`, `audit` |
| `audit` | Registro inmutable y consulta autorizada | solo `database` |

Los módulos de bajo nivel no importan módulos de flujos: `inventory` no conoce ventas, `points` no conoce canjes y `members` no conoce campañas. Un módulo de flujo orquesta sus dependencias dentro de una transacción. Cada módulo presenta una interfaz pequeña, como `closeSale`, `voidSale`, `creditPoints` o `redeemReward`, y oculta repositorios, bloqueos y cálculo de movimientos. Los módulos comparten contratos públicos pequeños, no repositorios ni tablas ajenas.

### Datos e infraestructura

- PostgreSQL es la fuente de verdad. Drizzle administra el esquema y las migraciones; las restricciones, índices y transacciones siguen siendo SQL de PostgreSQL.
- Despliegue gestionado con dos ambientes: prueba y producción.
- Copias diarias, recuperación a un punto en el tiempo, logs estructurados y alertas de errores.
- Archivos CSV/XLSX en almacenamiento privado con vencimiento y registro de quién los importó o exportó.
- Objetivo inicial: 20 a 50 usuarios simultáneos, 1.000 socios y varios años de movimientos. Una instancia pequeña cubre este volumen con margen.

### Modelo de datos inicial

| Dominio | Tablas iniciales | Regla importante |
|---|---|---|
| Identidad | `users`, `roles`, `permissions`, `user_roles`, `auth_identities`, `sessions` | Un socio se vincula a Google por `provider + provider_subject`, nunca por email mutable. Solo `admin` anonimiza la membresía, invalida acceso y QR y conserva su historial como "Usuario eliminado". |
| Socios | `members`, `member_qr_tokens` | QR opaco, revocable y único. El estado del socio bloquea beneficios según la regla definida. |
| Productos y stock | `products`, `stock_balances`, `stock_movements` | El saldo es una proyección en unidades enteras. Todo cambio crea un movimiento con motivo. |
| Ventas | `sales`, `sale_items`, `payments`, `sale_member_links`, `idempotency_keys` | Una venta anulada conserva su registro, crea movimientos compensatorios y marca como devuelto cualquier pago registrado. |
| Puntos | `point_ledger_entries`, `point_lots` | El libro no se edita. Los lotes registran origen, vencimiento, saldo y consumo FEFO. |
| Recompensas y canjes | `rewards`, `redemptions`, `redemption_tickets` | El cupo de una recompensa es propio, no depende del inventario. Un ticket solo puede validarse una vez; cancelación y vencimiento devuelven los mismos lotes y liberan el cupo. |
| Campañas | `qr_campaigns`, `campaign_scans`, `campaign_participations` | Índice único por campaña y socio para impedir un beneficio duplicado. |
| Auditoría | `audit_events` | Solo inserciones. Guarda actor, acción, entidad, fecha, motivo y datos mínimos antes/después. |

Las tablas críticas incluyen `id`, `created_at`, `updated_at` cuando corresponde, y `version` u otro control de concurrencia donde una actualización compite. Las claves de idempotencia se guardan con alcance, actor, request hash, respuesta y vencimiento.

```text
users ──< user_roles >── roles
  │                         │
  ├── 0..1 members           └──< role_permissions >── permissions
  ├──< auth_identities
  └──< sessions

members ──< point_lots ──< point_ledger_entries
members ──< redemptions >── rewards
products ── 1 stock_balances
products ──< stock_movements
sales ──< sale_items >── products
sales ──< payments
sales ── 0..1 sale_member_links >── members
redemptions ── 1 redemption_tickets
qr_campaigns ──< campaign_participations >── members
```

### Endpoints principales

Todos responden JSON y viven bajo `/api/v1`. Las rutas de escritura validan DTOs y autorización en Nest.

| Área | Endpoints | Permiso |
|---|---|---|
| Autenticación | `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | público, salvo sesión y cierre |
| Socios | `GET/PATCH /members/me`, `GET /members/lookup`, `POST /members/:id/qr/rotate` | propio; `members.read`; `members.manage` |
| Productos e inventario | `GET /products`, `POST/PATCH /products`, `GET /inventory`, `POST /inventory/adjustments`, `GET /inventory/movements` | `products.read`; `products.manage`; `inventory.read`; `inventory.adjust` |
| Ventas | `POST /sales`, `GET /sales`, `GET /sales/:id`, `POST /sales/:id/void`, `POST /sales/:id/member` | `sales.create`; `sales.read`; `sales.void`; `sales.member.attach` |
| Puntos | `GET /members/me/points`, `GET /members/:id/point-ledger`, `POST /members/:id/point-adjustments` | propio; `points.read`; `points.adjust` |
| Recompensas y canjes | `GET /rewards`, `POST/PATCH /rewards`, `POST /redemptions`, `POST /redemptions/:id/validate`, `POST /redemptions/:id/cancel` | `rewards.read`; `rewards.manage`; socio propio; `redemptions.validate`; propio o `redemptions.cancel` |
| Campañas | `GET /campaigns/:slug`, `POST /campaigns/:slug/participations`, `GET/POST/PATCH /campaigns` | público; socio; `campaigns.manage` |
| Administración | `GET/POST/PATCH /users`, `POST /members/:id/anonymize`, `GET /audit-events`, `GET /dashboard/daily` | `users.manage`; `members.anonymize`; `audit.read`; `dashboard.read` |

`POST /sales`, `POST /redemptions` y sus confirmaciones aceptan una clave `Idempotency-Key`. La API devuelve el resultado original si recibe el mismo intento otra vez.

### Autenticación y permisos

- Los socios usan Authorization Code con PKCE de Google OAuth. La API crea o vincula una identidad y emite una sesión propia en cookie `HttpOnly`, `Secure` y `SameSite` apropiada al dominio final.
- Empleados y administradores usan cuentas internas. E1 puede comenzar con contraseña y hash Argon2id; se podrá sumar Google Workspace sin cambiar los permisos.
- Los roles iniciales son `member`, `employee` y `admin`. Un rol agrupa permisos explícitos como `sales.create`, `sales.void`, `inventory.adjust`, `points.adjust`, `redemptions.validate` y `audit.read`.
- `GET /auth/me` devuelve el usuario, sus permisos y `homePath`. El frontend dirige `member` a `/club`, `employee` a `/operacion` y `admin` a `/admin`. Si en el futuro una cuenta reúne roles, `primary_role` define el destino inicial y sus permisos efectivos se combinan.
- Cada endpoint declara el permiso requerido. Un guard de Nest lo verifica con el usuario autenticado. Las acciones críticas registran auditoría en la misma transacción o bloquean el cambio si no puede registrarse.

### Estrategia de pruebas

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Unidad | Reglas de precio, permisos, FEFO, vencimientos y reversas | Vitest |
| Integración | Transacciones PostgreSQL, bloqueos, índices únicos y migraciones | Vitest + PostgreSQL efímero en contenedor |
| API | DTOs, autenticación, autorización y respuestas de Nest | Supertest |
| Punta a punta | Venta, anulación, acumulación y canje desde las áreas protegidas | Playwright |

Cada entrega agrega como mínimo una prueba de punta a punta de su demo y pruebas de integración para cada movimiento irreversible. Las pruebas de concurrencia cubren doble toque al cobrar y último cupo de un canje.

### Plan de implementación incremental

| Entrega | Resultado usable | Módulos y rutas principales |
|---|---|---|
| E0 | Base ejecutable y navegación por rol | `auth`, `users-and-roles`, `audit`, `/login` y layouts vacíos |
| E1 | Caja, productos y stock | `products`, `inventory`, `sales`, `/operacion` y `/admin/productos` |
| E2 | Club y puntos | `members`, `points`, `/club` y asociación desde operación |
| E3 | Recompensas y canjes | `rewards`, `redemptions`, catálogo del club y validación en operación |
| E4 | Importación y exportación | extensiones de productos, inventario, ventas y puntos |
| E5 | Campañas QR | `campaigns`, landing pública y gestión en `/admin/campanas` |
| E6 | Tablero, auditoría y lanzamiento | consultas de operación y administración, respaldo y piloto |

## 3. Entregables

### E0. Descubrimiento y diseño mínimo, 3 a 5 días

No se despliega por separado. Alimenta E1.

| Resultado | Profundidad |
|---|---|
| Mapa de caja actual y convivencia con LibreOffice | Análisis alto |
| Wireframes de venta, productos y stock | Diseño medio |
| Modelo de permisos y auditoría | Análisis alto |
| Decisiones técnicas y esquema inicial de datos | Diseño técnico alto |
| Criterios de producción, respaldo y soporte | Análisis medio |

Salida: prototipo navegable de caja, decisiones registradas y backlog de E1 aceptado.

### E1. Caja operativa y stock, 2 semanas

Primer sistema que el local puede usar en una venta real.

Estado actual: en curso.

- Hecho: acceso interno, roles y permisos, catálogo con alta y stock inicial, caja de varios ítems, cobro idempotente, descuento y reversa de stock, pagos registrados como devueltos al anular y auditoría inmutable.
- Hecho: interfaz de caja para tablet y escritorio, más alta de productos en `/admin/productos`.
- Pendiente: edición, búsqueda y desactivación de productos; ajustes y consulta de stock; historial y anulación desde la interfaz; pruebas de integración con PostgreSQL y punta a punta.

Incluye:

- acceso de administrador y empleado;
- alta, edición, búsqueda y desactivación de productos;
- carga de stock inicial y ajustes con motivo;
- venta de varios productos, pago opcional y cobro idempotente;
- descuento de stock y alerta de mínimo;
- anulación administrativa con movimientos compensatorios;
- historial de ventas y auditoría básica.

Demo de cierre:

```text
Crear producto -> cargar stock -> vender 2 unidades
-> venta cerrada -> stock -2 -> anular -> stock restaurado
```

Profundizar antes de construir:

- Análisis alto: quién puede anular y cómo se registra un error de caja. Las cantidades de inventario y venta son unidades enteras.
- Diseño alto: pantalla táctil de venta y respuesta ante doble toque o pérdida de conexión.

### E2. Club y acumulación de puntos, 2 semanas

Entrega el circuito de fidelización, todavía sin canjes.

Incluye:

- ingreso con Google y creación de socio;
- perfil opcional, estado del socio y QR opaco;
- búsqueda de socio desde caja;
- asociación durante la venta y asociación tardía;
- regla `1 punto cada X pesos`;
- libro inmutable, lotes con vencimiento y saldo;
- vista `Mi Club` con QR, saldo e historial;
- ajustes manuales solo para administrador.

Demo de cierre:

```text
Entrar con Google -> comprar identificado -> sumar puntos
-> ver saldo -> asociar otra venta pendiente -> sumar una sola vez
```

Profundizar antes de construir:

- Diseño medio: experiencia cuando el socio está suspendido o el QR no funciona.
- Diseño técnico alto: libro de puntos, lotes, vencimientos y reversas.

### E3. Recompensas y canjes, 2 semanas

Completa el ciclo principal del MVP.

Incluye:

- catálogo visible según vigencia y saldo;
- administración de recompensas;
- solicitud y ticket con QR o código;
- consumo FEFO y reserva de stock de recompensa;
- validación única por empleado;
- cancelación y vencimiento con devolución exacta;
- historial para socio y operación.

Demo de cierre:

```text
Acumular puntos -> pedir recompensa -> emitir ticket
-> validar en caja -> impedir una segunda validación
```

Profundizar antes de construir:

- Análisis alto: qué representa el stock de una recompensa y cómo se repone.
- Diseño alto: flujo de entrega para evitar errores del empleado.
- Diseño técnico alto: concurrencia entre dos canjes por el último cupo.

Al terminar E3 ya está validado el circuito principal del negocio.

### E4. Convivencia con LibreOffice, 1 a 2 semanas

Reduce la doble carga y habilita la migración gradual.

Incluye:

- plantillas oficiales;
- previsualización y validación sin escribir;
- importación de productos y stock;
- importación idempotente de ventas históricas;
- elección entre rechazar todo o aplicar filas válidas;
- exportaciones de ventas, stock y puntos;
- informe por fila y auditoría del lote.

Profundizar antes de construir:

- Análisis alto sobre archivos reales usados hoy. Los nombres de columnas y formatos deben probarse con muestras, no suponerse.
- Diseño medio de la revisión de errores y confirmación del lote.

### E5. Campañas QR, 2 semanas

Agrega adquisición y recurrencia sin comprometer la caja.

Incluye:

- administración de campaña, entrada, experiencia y beneficio;
- landing pública por QR reutilizable;
- medición de escaneo anónimo;
- autenticación y participación única por socio;
- puntos como primer tipo de beneficio;
- pausa, cierre, cupo total y métricas básicas.

Demo de cierre:

```text
Escanear sticker -> ingresar -> recibir beneficio
-> reintentar con otro sticker -> no duplicar beneficio
```

Profundizar antes de construir:

- Análisis medio: métricas que tomarán decisiones reales.
- Diseño alto: editor limitado de experiencias. No conviene construir un creador libre de páginas en el MVP.
- Diseño técnico alto si se incluyen cupones o recompensas como beneficio. Recomiendo comenzar solo con puntos.

### E6. Operación, métricas y preparación de lanzamiento, 1 semana

Incluye:

- tablero diario de ventas, socios, puntos, canjes y stock bajo;
- búsqueda y detalle unificado del socio;
- permisos finales y exportaciones;
- accesibilidad y rendimiento;
- restauración ensayada desde una copia;
- monitoreo, manual breve y capacitación;
- prueba piloto y correcciones de lanzamiento.

Profundizar:

- Análisis medio: indicadores y responsables de responder a alertas.
- Diseño medio: jerarquía del tablero. Mostrar pocos datos accionables.

## 4. Estrategia de iteración

Cada entregable sigue el mismo ciclo:

```text
Definir ejemplos y riesgos
 -> diseñar el flujo crítico
 -> implementar una porción completa
 -> probar con datos reales
 -> demo con usuarios del local
 -> ajustar y desplegar
```

Dentro de una fase, el equipo debe integrar cambios pequeños varias veces por semana. Al final se ejecutan pruebas automáticas del módulo, pruebas de transacción y el recorrido completo de la demo.

## 5. Orden y dependencias

| Entrega | Puede operar | Depende de |
|---|---|---|
| E1 | Ventas y stock | E0 incorporado |
| E2 | Socios y acumulación | E1 |
| E3 | Fidelización completa | E2 |
| E4 | Migración gradual | E1 y E2 |
| E5 | Campañas | E2, conviene después de E3 |
| E6 | Lanzamiento controlado | E1 a E5 |

E4 y E5 pueden avanzar en paralelo después de E3 si hay dos equipos. Con un solo equipo, mantendría el orden anterior.

Duración orientativa: 10 a 12 semanas de construcción, más E0. La estimación debe corregirse después de ver archivos reales de LibreOffice y validar los flujos con empleados.

## 6. Calidad exigida en todas las fases

- Pruebas automáticas de reglas, permisos e idempotencia.
- Pruebas de integración con PostgreSQL para transacciones y restricciones.
- Una prueba de punta a punta para la demo de cada entrega.
- Migraciones versionadas y reversibles cuando el cambio lo permita.
- Registro de actor, fecha y motivo desde E1.
- Sin edición destructiva de ventas, stock, puntos o canjes.
- Revisión en celular, tablet y pantalla de caja.

## 7. Insumo requerido para E4

Antes de iniciar E4 se revisará una planilla real de LibreOffice. La muestra mock ya define el contrato inicial en `docs/IMPORTACION_LIBREOFFICE.md`. Recetas, insumos, proveedores, compras, caja y gastos quedan fuera de la importación del MVP.

## 8. Recomendación de primer hito

Empezar con E0 y E1. El criterio de salida no debe ser “backend listo”, sino que un empleado pueda registrar, cobrar y anular una venta de prueba desde la misma interfaz que usará en el local.
