# Ramax Café Club. MVP funcional

> Versión 2.0. Fecha: 4 de octubre de 2026.

## 1. Alcance

El MVP termina en E3 y valida el circuito completo de una única sucursal:

```text
E0 Acceso -> E1 Operación local -> E2 Club cloud -> E3 Beneficios
```

El producto debe permitir vender aunque el local pierda internet. La aplicación del socio funciona en cloud y muestra la última información confirmada.

### Incluido

- acceso del personal con perfiles fijos;
- catálogo e inventario de productos vendibles;
- ventas con pago, comprobante, historial y anulación completa;
- membresía con Google y número de socio;
- puntos por compra, vencimiento y ajustes administrativos;
- recompensas con cupo propio;
- solicitud, cancelación y validación de canjes;
- sincronización entre la operación local y el club cloud;
- auditoría interna y backup diario.

### Fuera del MVP

- importación desde LibreOffice;
- campañas promocionales;
- dashboards;
- arqueo y conciliación de turnos;
- facturación fiscal;
- recetas, insumos, compras y proveedores;
- descuentos, precios manuales y pagos divididos;
- pantalla de consulta de auditoría;
- múltiples sucursales.

## 2. Perfiles

Visitante es un estado público sin sesión, no un perfil persistido.

| Capacidad | Socio | Empleado | Administrador |
|---|---|---|---|
| Acceso | Google, cloud | Contraseña local | Contraseña local |
| Ventas | — | Crear, cobrar, consultar historial completo e imprimir comprobante | Hereda al Empleado y puede anular |
| Catálogo e inventario | — | Consultar | Administrar catálogo y ajustar stock |
| Socios | Consultar perfil propio | Consultar nombre, estado y saldo por número | Consultar perfil y libro de puntos; cambiar estado |
| Puntos | Consultar saldo e historial | Consultar saldo | Configurar regla y crear ajustes |
| Recompensas | Consultar | Consultar para entregar canjes | Administrar |
| Canjes | Solicitar y cancelar los propios | Validar y cancelar pendientes | Hereda al Empleado |
| Personal | — | — | Crear, desactivar y restablecer contraseñas |

Reglas de acceso:

- los perfiles son fijos y no se personalizan por usuario;
- el Administrador hereda todas las capacidades del Empleado;
- la cuenta laboral y la membresía personal son cuentas separadas, aunque pertenezcan a la misma persona;
- cada integrante del personal usa una cuenta individual;
- el servidor valida todos los permisos;
- el Empleado no consulta email, teléfono ni historial de puntos del socio;
- solo el Administrador suspende, reactiva o anonimiza membresías.

## 3. Módulos

| Módulo | Ubicación | Responsable | Depende de |
|---|---|---|---|
| Acceso del personal | Local | Administrador | Auditoría |
| Catálogo | Local | Administrador | Auditoría |
| Inventario | Local | Administrador; Empleado consulta | Catálogo, auditoría |
| Ventas, pagos y comprobantes | Local | Empleado | Catálogo, inventario, auditoría |
| Socios y Google | Cloud | Socio; Administrador gestiona estado | Auditoría cloud |
| Puntos | Cloud | Socio; Administrador configura | Socios |
| Recompensas | Cloud | Administrador | Puntos |
| Canjes | Cloud y caja | Socio solicita; Empleado valida | Socios, puntos, recompensas |
| Sincronización | Local y cloud | Automático | Ventas, socios, puntos |
| Auditoría | Transversal, sin pantalla | Sistema | Todos los cambios críticos |
| Backup y restauración | Operación local | Automático; Administrador verifica | Datos locales |

### 3.1 Acceso del personal

- Empleado y Administrador ingresan con usuario y contraseña internos.
- El Administrador crea y desactiva cuentas del personal.
- Si un Empleado olvida la contraseña, un Administrador la restablece.
- El primer Administrador se crea durante la instalación local.

### 3.2 Catálogo e inventario

Un producto tiene nombre, SKU opcional, precio en pesos enteros, estado, control de stock, stock actual y stock mínimo.

- el precio debe ser mayor que cero;
- el SKU es único cuando existe;
- la venta usa el precio vigente del catálogo;
- el Empleado no cambia precios ni aplica descuentos;
- las cantidades son enteras y nunca quedan negativas;
- todo ajuste de stock exige Administrador, motivo y auditoría;
- desactivar un producto impide ventas nuevas sin borrar su historia.

### 3.3 Ventas, pagos y comprobantes

Una venta se crea cerrada en una única operación. No se persisten borradores.

- contiene uno o más productos y cantidades enteras;
- usa un número visible perteneciente a una secuencia única de la sucursal;
- admite un solo medio de pago: efectivo o transferencia;
- la transferencia se confirma manualmente y no guarda referencia;
- no registra efectivo recibido ni vuelto;
- descuenta stock y registra auditoría en la misma operación;
- usa idempotencia para impedir ventas, pagos o descuentos duplicados;
- genera un comprobante imprimible sin validez fiscal;
- el comprobante muestra los últimos cuatro dígitos del número de socio cuando corresponde;
- el Empleado consulta el historial completo de la sucursal.

Solo un Administrador anula una venta completa, con motivo obligatorio y después de confirmar que devolvió el dinero por fuera de Ramax. La anulación restaura stock, revierte puntos y conserva la venta original.

### 3.4 Socios

- cualquier persona con una cuenta de Google verificada crea su membresía en el primer acceso;
- el perfil conserva nombre, email y teléfono opcional;
- cada socio recibe un número aleatorio de seis dígitos, único y nunca reutilizable;
- el número identifica la membresía, pero no autentica ni concede acceso;
- el Empleado busca al socio únicamente por ese número;
- la caja muestra al Empleado nombre, estado y último saldo confirmado;
- una membresía suspendida no acredita puntos ni permite canjes;
- anonimizar elimina datos personales y acceso, pero conserva la historia operativa como "Usuario eliminado".

### 3.5 Puntos

Existe una única regla global:

```text
puntos = piso(total de la venta / pesosPorPunto)
```

- todos los productos participan;
- la regla vigente al cerrar la venta queda asociada a esa venta;
- los cambios solo afectan ventas futuras;
- el libro de puntos es inmutable;
- los puntos vencen a las 21:00 cuando se cumplen 365 días desde la acreditación;
- los canjes consumen primero los lotes que vencen antes;
- solo el Administrador crea ajustes manuales, siempre con motivo;
- si se anula una venta cuyos puntos ya se consumieron, el saldo puede quedar negativo;
- un saldo negativo impide nuevos canjes, pero no nuevas compras.

### 3.6 Recompensas y canjes

Una recompensa tiene nombre, descripción, costo en puntos, vigencia, estado y cupo propio opcional. Su cupo es independiente del inventario de productos.

- el socio solicita una cantidad y recibe un único ticket;
- emitir el ticket descuenta puntos y reserva todo el cupo solicitado;
- el ticket se localiza con un código manual;
- el Empleado entrega y valida la cantidad completa; no existe validación parcial;
- validar requiere internet y solo puede ocurrir una vez;
- el socio, Empleado o Administrador pueden cancelar un ticket no validado;
- cancelar o vencer devuelve exactamente los puntos y libera el cupo;
- el vencimiento inicial es de 24 horas y cada recompensa puede configurarlo.

### 3.7 Sincronización, auditoría y backup

- la PC administrativa aloja la operación local durante la primera versión;
- la aplicación cloud del socio no depende de que esa PC esté encendida;
- las ventas funcionan sin internet;
- los canjes y las funciones administrativas del club requieren internet;
- la app muestra el último saldo confirmado y suma puntos nuevos después de sincronizar;
- si el socio ya existe en la caché local, puede asociarse offline y sus puntos quedan pendientes;
- si no existe en caché, la venta cierra sin socio y puede asociarse dentro de las 24 horas posteriores;
- si central rechaza una asociación pendiente, la venta permanece cerrada y no acredita puntos;
- cada cambio crítico crea auditoría, pero el MVP no incluye una pantalla para consultarla;
- el backup corre a diario y conserva copias locales durante 30 días. Desde E2 envía otra cifrada a central cuando hay internet.

## 4. Flujos principales

### Venta online con socio

```text
Ingresar productos -> ingresar número de socio -> confirmar identidad y saldo
-> elegir efectivo o transferencia -> cerrar venta -> descontar stock
-> imprimir comprobante -> acreditar puntos -> mostrar saldo actualizado
```

### Venta sin internet

```text
Ingresar productos -> cerrar venta local -> descontar stock -> imprimir comprobante
-> socio conocido: puntos pendientes
-> socio desconocido: venta sin socio, asociación posterior hasta 24 h
```

### Asociación tardía

```text
Buscar venta cerrada -> comprobar plazo de 24 h -> ingresar número de socio
-> confirmar que no tenga otro socio -> usar regla guardada con la venta
-> acreditar puntos -> auditar empleado y fecha
```

### Anulación

```text
Administrador confirma devolución externa -> informa motivo -> anula venta completa
-> restaura stock -> revierte puntos -> saldo puede quedar negativo -> audita
```

### Canje

```text
Socio elige recompensa y cantidad -> puntos y cupo se reservan -> recibe código
-> Empleado busca código online -> entrega cantidad completa -> valida una vez
```

## 5. Criterios de aceptación

### E0. Acceso

- Empleado y Administrador ingresan con cuentas individuales.
- Un Empleado no accede a ajustes, anulaciones, usuarios ni configuración.
- El Administrador restablece la contraseña de un Empleado y la acción queda auditada.

### E1. Operación local

- El Empleado crea una venta con varios productos y pago en efectivo o transferencia.
- Un reintento con la misma clave no duplica venta, pago ni stock.
- La venta recibe número secuencial y comprobante imprimible.
- La caja sigue vendiendo sin internet.
- El stock nunca queda negativo.
- Solo el Administrador anula la venta completa y restaura el stock.
- El backup diario puede restaurarse antes del piloto.

### E2. Club cloud

- El primer acceso con Google crea socio y número de seis dígitos.
- El socio consulta perfil, saldo confirmado e historial desde internet aunque la PC local esté apagada.
- La caja consulta nombre, estado y saldo mediante el número de socio.
- Una venta offline de un socio conocido sincroniza sus puntos una sola vez.
- Un socio desconocido durante la caída puede asociarse después dentro de 24 horas.
- Los puntos vencen correctamente y una reversa puede dejar saldo negativo.

### E3. Beneficios

- El socio solicita varias unidades en un ticket si tiene puntos y cupo suficientes.
- Emitir el ticket descuenta puntos y reserva cupo una sola vez.
- El código manual permite validar online la cantidad completa.
- Cancelar o vencer el ticket devuelve puntos y cupo.
- Un ticket validado no puede validarse ni cancelarse otra vez.
