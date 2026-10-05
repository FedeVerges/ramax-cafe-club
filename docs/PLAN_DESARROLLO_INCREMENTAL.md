# Ramax Café Club. Plan de desarrollo incremental

> Estado revisado el 4 de octubre de 2026.

## 1. Objetivo y entregas

El MVP termina en E3. Cada entrega es un corte vertical operable:

```text
E0 Acceso
   -> E1 Operación local
      -> E2 Club cloud
         -> E3 Beneficios
```

| Entrega | Resultado verificable |
|---|---|
| E0 | El personal entra con perfiles fijos y las acciones críticas se auditan. |
| E1 | La sucursal vende, cobra, descuenta stock, imprime y anula sin depender de internet. |
| E2 | El socio usa la app cloud y las ventas locales sincronizan puntos. |
| E3 | El socio solicita recompensas y la caja valida canjes online. |

Importación, campañas, dashboards, múltiples sucursales y conciliación de turnos se planifican después del MVP.

## 2. Arquitectura

La operación se divide por disponibilidad y propiedad de datos:

```text
Sucursal
┌───────────────────────────────────────────┐
│ Navegador del personal                    │
│   /login  /operacion  /admin              │
│                    │                      │
│                    v                      │
│ API local NestJS -> PostgreSQL local      │
│   ventas, pagos, catálogo, stock,         │
│   personal, auditoría, caché y outbox     │
└────────────────────┬──────────────────────┘
                     │ HTTPS cuando hay internet
                     v
Cloud
┌───────────────────────────────────────────┐
│ App del socio /club                       │
│ API cloud NestJS -> PostgreSQL cloud      │
│   Google, socios, puntos, recompensas,    │
│   canjes e inbox de sincronización        │
└───────────────────────────────────────────┘
```

### Decisiones operativas

- La PC administrativa aloja API y PostgreSQL locales en la primera versión.
- Los servicios locales se inician automáticamente con esa PC.
- Si la PC está apagada, la sucursal no puede vender desde Ramax.
- La app cloud del socio sigue disponible aunque la PC local esté apagada.
- El panel administrativo es único y local. La API local actúa como intermediaria para funciones cloud.
- Las funciones cloud del panel y todos los canjes requieren internet.
- Ventas, catálogo, inventario e historial local siguen disponibles sin internet.
- El mismo monorepo mantiene web y API. Sus módulos se despliegan en modo local o cloud según el entorno.

### Propiedad de datos

| Fuente de verdad | Datos |
|---|---|
| PostgreSQL local | personal, productos, stock, ventas, pagos, comprobantes, auditoría local, caché de socios y outbox |
| PostgreSQL cloud | identidades Google, socios, números de socio, reglas y libro de puntos, recompensas, canjes e inbox |

Las cuentas laborales usan usuario local y permanecen separadas de las membresías cloud.

## 3. Módulos y estado actual

| Módulo | Ubicación | Propietario | Depende de | Estado | Entrega |
|---|---|---|---|---|---|
| Acceso del personal | Local | Administrador | Auditoría | Implementado | E0 |
| Catálogo | Local | Administrador | Auditoría | Implementado; piloto pendiente | E1 |
| Inventario | Local | Administrador; Empleado consulta | Catálogo, auditoría | Implementado; piloto pendiente | E1 |
| Ventas, pagos y comprobantes | Local | Empleado | Catálogo, inventario, auditoría | Implementado; piloto pendiente | E1 |
| Socios y Google | Cloud | Socio; Administrador gestiona | Auditoría cloud | Pendiente | E2 |
| Puntos | Cloud | Socio; Administrador configura | Socios | Pendiente | E2 |
| Recompensas | Cloud | Administrador | Puntos | Pendiente | E3 |
| Canjes | Cloud y caja | Socio y Empleado | Socios, puntos, recompensas | Pendiente | E3 |
| Sincronización | Local y cloud | Automático | Ventas, socios, puntos | Pendiente | E2 |
| Auditoría | Transversal | Sistema | Todos los cambios críticos | Implementado | E0 |
| Backup y restauración | Local; copia cloud desde E2 | Administrador verifica | PostgreSQL local | Implementado; piloto pendiente | E1 |

### Qué existe

- Acceso laboral por usuario y contraseña, perfiles fijos, administración del equipo y revocación de sesiones.
- Productos, ajustes de inventario y movimientos con responsables; stock no negativo en servicio y base.
- Cierre con pago obligatorio, numeración, idempotencia con hash, historial, comprobante y anulación transaccional.
- Auditoría interna de cuentas y operaciones. Sin pantalla de auditoría.
- Backup local validado, restauración con mantenimiento y scripts de instalación Windows.

El código E0/E1 tiene pruebas automatizadas. La instalación Windows y la impresión física deben pasar la aceptación del piloto. Socios, puntos, recompensas y canjes siguen pendientes para E2/E3.

## 4. Contratos objetivo

### 4.1 Perfiles y permisos

Los perfiles son fijos. No se implementa edición de permisos.

| Permiso | Socio | Empleado | Administrador |
|---|---:|---:|---:|
| Consultar perfil propio | Sí | — | — |
| Crear ventas y comprobantes | — | Sí | Sí |
| Consultar todo el historial local | — | Sí | Sí |
| Anular venta completa | — | — | Sí |
| Consultar catálogo y stock | — | Sí | Sí |
| Administrar catálogo y ajustar stock | — | — | Sí |
| Consultar socio por número, estado y saldo | — | Sí | Sí |
| Consultar perfil y libro de puntos de terceros | — | — | Sí |
| Ajustar puntos y configurar regla | — | — | Sí |
| Solicitar canje propio | Sí | — | — |
| Validar o cancelar ticket pendiente | — | Sí | Sí |
| Administrar recompensas | — | — | Sí |
| Administrar personal y membresías | — | — | Sí |

### 4.2 API local

Todos los endpoints continúan bajo `/api/v1`.

| Área | Operaciones objetivo |
|---|---|
| Sesión | login interno, sesión actual y logout |
| Personal | listar, crear, desactivar y restablecer contraseña |
| Catálogo | listar, crear, editar y desactivar productos |
| Inventario | consultar saldos y crear ajustes con motivo |
| Ventas | cerrar, listar, consultar detalle, imprimir comprobante, asociar socio y anular |
| Socios | consultar por número mediante caché o cloud |
| Canjes | consultar ticket por código, validar y cancelar mediante cloud |
| Administración cloud | consultar socios, regla de puntos y recompensas mediante cloud |

Cambios sobre el contrato existente:

- `paymentMethod` queda limitado a `cash | transfer` y es obligatorio;
- no se guarda referencia de transferencia, efectivo recibido ni vuelto;
- la venta se crea directamente cerrada y recibe `saleNumber` secuencial;
- la asociación usa `memberNumber`, nunca un código visual escaneable;
- el comprobante incluye solo los últimos cuatro dígitos de `memberNumber`;
- la anulación exige Administrador y motivo, y siempre afecta la venta completa;
- toda escritura crítica usa idempotency key y rechaza reutilizar una clave con otro request.

### 4.3 API cloud

| Área | Operaciones objetivo |
|---|---|
| Google | iniciar y completar login; cerrar sesión |
| Socio | consultar y editar teléfono; ver número y estado |
| Puntos | consultar saldo e historial propios |
| Recompensas | listar recompensas disponibles |
| Canjes | solicitar cantidad, consultar tickets y cancelar ticket propio pendiente |
| Administración | estado de socios, libro y ajustes de puntos, regla global y recompensas |
| Integración local | resolver socio por número y recibir eventos idempotentes |

No se crean rutas, tablas ni tokens personales para identificación visual. El número de socio es el único identificador operativo visible.

### 4.4 Datos locales

- `staff_users`, credenciales, sesiones y un perfil fijo por cuenta;
- productos, saldos y movimientos de stock;
- ventas con `sale_number`, items, pago obligatorio y asociación opcional;
- clave idempotente con alcance, actor, hash del request, respuesta y vencimiento;
- caché de socio con número, identificador central, nombre, estado, saldo confirmado y fecha de sincronización;
- outbox de eventos inmutables pendientes, procesados o rechazados;
- auditoría solo de inserción;
- metadatos de backup y restauración.

### 4.5 Datos cloud

- miembros e identidades Google;
- número aleatorio de seis dígitos con restricción única y sin reutilización;
- regla global versionada;
- libro y lotes de puntos;
- recompensas con cupo propio;
- canjes con cantidad y ticket de código manual;
- inbox con identificador único por evento local;
- auditoría cloud solo de inserción.

## 5. Sincronización

La sincronización usa outbox local e inbox cloud. Cada evento tiene un identificador global estable y central lo procesa una sola vez.

### Eventos mínimos

| Evento | Resultado cloud |
|---|---|
| `sale.closed` | Acredita puntos si la venta tiene un socio confirmado. |
| `sale.member_attached` | Acredita puntos con la regla guardada al cerrar la venta. |
| `sale.voided` | Revierte puntos; permite saldo negativo. |

### Reglas

- La venta se confirma localmente antes de intentar sincronizar.
- El local guarda en cada venta la versión de la regla, `pesosPorPunto` y puntos calculados.
- El panel administrativo cambia la regla en cloud y actualiza la caché local en la misma operación online.
- Un socio presente en caché puede asociarse offline; sus puntos quedan pendientes.
- Si el número no está en caché, la venta cierra sin socio.
- La asociación posterior dispone de 24 horas desde el cierre.
- La app muestra solo saldo confirmado, nunca suma eventos locales pendientes.
- Un rechazo central no revierte venta, pago ni stock. Marca el evento y no acredita puntos.
- El reintento aplica backoff y conserva el error para diagnóstico.

## 6. Implementación incremental

### E0. Acceso

Completar:

- separar identidad laboral local de membresía cloud;
- fijar perfiles Empleado y Administrador;
- administración local de personal;
- restablecimiento administrativo de contraseña;
- auditoría obligatoria para cuentas y cambios críticos.

Salida: dos cuentas diferentes respetan su matriz y ninguna acción administrativa depende de ocultar botones.

### E1. Operación local

Completar:

- catálogo y pantalla de inventario;
- prohibición absoluta de stock negativo;
- venta sin borrador, pago obligatorio y medios `cash | transfer`;
- numeración secuencial y comprobante imprimible;
- historial completo para el personal;
- anulación completa exclusiva del Administrador;
- idempotencia con hash del request;
- backup diario local y restauración probada; copia cifrada central desde E2.

Salida:

```text
Crear producto -> cargar stock -> vender offline -> imprimir
-> anular como Administrador -> stock restaurado -> restaurar backup de prueba
```

### E2. Club cloud

Implementar:

- despliegue cloud de web, API y PostgreSQL;
- Google login y alta automática;
- perfil con nombre, email y teléfono opcional;
- número de socio de seis dígitos;
- regla global, libro, lotes, FEFO y vencimiento diario;
- consultas del Socio y del Administrador;
- caché local de socios;
- outbox, inbox y sincronización idempotente;
- asociación durante la venta y hasta 24 horas después;
- puntos pendientes y saldo confirmado.

Salida: una venta online u offline acredita puntos una sola vez y el socio los ve al confirmarse en cloud.

### E3. Beneficios

Implementar:

- catálogo y administración de recompensas;
- cupo independiente del inventario local;
- ticket con código manual, cantidad y vencimiento configurable;
- débito de puntos y reserva de cupo al emitir;
- consulta, validación completa y cancelación online;
- vencimiento automático con devolución exacta.

Salida: solicitar, cancelar, vencer y validar un ticket conserva puntos y cupo correctos ante reintentos.

## 7. Pruebas y aceptación

| Nivel | Escenarios mínimos |
|---|---|
| Unidad | cálculo y vencimiento de puntos, FEFO, permisos, stock, cantidad de canje y reversas |
| Integración local | venta, pago, stock, numeración, auditoría, idempotencia, anulación y backup |
| Integración cloud | Google, número único, libro, cupos, tickets e inbox idempotente |
| Contrato | eventos de sincronización y respuestas del intermediario local |
| E2E local | venta online, venta offline, comprobante, historial y anulación |
| E2E club | alta con Google, saldo, asociación tardía, canje, cancelación y vencimiento |

Escenarios obligatorios:

1. Dos toques al cobrar producen una sola venta, pago y salida de stock.
2. Una venta offline queda cerrada aunque falle el club.
3. Un socio en caché recibe puntos pendientes y luego una sola acreditación.
4. Un socio no conocido se asocia al recuperar internet dentro de 24 horas.
5. Anular después de gastar puntos puede dejar saldo negativo.
6. Un ticket de varias unidades se valida completo una sola vez.
7. Cancelar o vencer devuelve exactamente puntos y cupo.
8. Empleado y Administrador reciben respuestas distintas para operaciones restringidas.
9. Un backup diario restaura una base local utilizable antes del piloto.

## Implementación E0/E1

Ver [estado y verificación](./IMPLEMENTACION_E0_E1.md) y [operación Windows](./OPERACION_WINDOWS.md). El acceso laboral usa usuario y contraseña. Las pruebas de piloto con Windows e impresora física son la puerta de salida antes del uso real.
