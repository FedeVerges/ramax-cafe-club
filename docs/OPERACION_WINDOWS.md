# Instalación y recuperación local en Windows

## Preparar la PC

Requisitos: Windows con PowerShell 7.2 o posterior, Node.js 22 LTS instalado para todos los usuarios, Corepack, PostgreSQL 17 nativo y una impresora de 80 mm instalada en Windows. El servicio PostgreSQL debe iniciar automáticamente. No se usa Docker para producción.

1. Reservar un nombre de host e IP en la red local. Todos los dispositivos deben resolver ese nombre; el certificado se emite para él.
2. Instalar PostgreSQL y crear una base `ramax` con un usuario propietario exclusivo de Ramax. Ese usuario necesita `CREATEDB` para validar copias y restaurarlas. Limitar PostgreSQL a localhost. No usar el usuario `postgres` para la aplicación.
3. Ubicar el proyecto en una carpeta estable, por ejemplo `C:\Ramax`. Ejecutar `corepack pnpm install --frozen-lockfile` y `corepack pnpm build` desde ella.
4. Crear `.env.production` sin subirlo a Git:

```dotenv
DATABASE_URL=postgresql://ramax:CONTRASENA_CODIFICADA_PARA_URL@localhost:5432/ramax
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CONTRASENA_INICIAL
ADMIN_NAME=Administrador Ramax
```

El usuario configurado debe ser propietario de tablas y base. Si se define `RECOVERY_DATABASE_URL`, debe conectar con ese mismo propietario. Una contraseña con caracteres reservados debe codificarse para URL.

5. Aplicar migraciones desde la raíz usando la configuración de producción y crear el primer administrador:

```powershell
node --env-file=.env.production apps/api/node_modules/drizzle-kit/bin.cjs migrate --config=apps/api/drizzle.production.config.ts
node --env-file=.env.production --import ./apps/api/node_modules/tsx/dist/loader.mjs apps/api/scripts/seed-admin.ts
```

El seed falla si la cuenta existe; no cambia contraseñas en cada arranque. Quitar `ADMIN_PASSWORD` después de crear la cuenta.

6. Ejecutar PowerShell como administrador:

```powershell
pwsh -File scripts/windows/install.ps1 -HostName ramax-pc -BackupDirectory D:\RamaxBackups
```

El script genera HTTPS local, configura las tareas `Ramax-api` y `Ramax-recovery` al iniciar Windows, restringe acceso a secretos y habilita el puerto 3443 solo para la subred local privada. Ambas tareas usan Local Service, sin sesión de escritorio. El directorio de backups debe estar en un volumen disponible al arrancar. Se recomienda otro disco físico.

7. Instalar **solo** `C:\ProgramData\Ramax\tls\ramax-public.cer` como certificado de confianza en los dispositivos del personal. En otros Windows:

```powershell
pwsh -File scripts/windows/trust-certificate.ps1 -CertificateFile .\ramax-public.cer
```

Nunca distribuir `server.key`. Abrir `https://ramax-pc:3443`. El nombre debe coincidir con el certificado. Renovarlo antes del vencimiento indicado por Windows; detener tareas, reemplazar certificado y clave, actualizar confianza y reiniciar tareas.

## Operación y copias

- Crear productos en cero y cargar existencias mediante Inventario, con motivo.
- El pedido existe solo en memoria. Al recargar o salir del flujo se descarta. Si se perdió la respuesta de un cobro, reintentar el mismo cobro o consultar el historial antes de iniciar otro.
- La venta funciona sin internet mientras la PC y la LAN estén disponibles. El indicador verifica por separado la API local y una consulta HTTPS externa breve; esta consulta no participa del cobro.
- Imprimir desde el detalle. Elegir la impresora, papel de 80 mm y desactivar encabezados/pies del navegador. El comprobante no tiene validez fiscal.
- El proceso de recuperación verifica cada minuto si falta la copia del día de San Luis. Tras un fallo espera una hora para reintentar. Valida cada copia restaurándola en una base temporal. Retiene 30 días y solo depura tras crear otra válida.
- Las claves idempotentes vencidas se conservan para impedir repeticiones; se elimina su respuesta después de 30 días.
- Copias de seguridad muestra ejecuciones, fallos y restauraciones. No incluye copia cloud en E1.

## Restaurar desde la interfaz

1. Detener la operación de caja y seleccionar una copia válida como Administrador.
2. Confirmar la pérdida de operaciones posteriores. La solicitud queda pendiente hasta que la tome el proceso de recuperación.
3. Se bloquean escrituras, se verifica archivo y esquema, se restaura en una base temporal y se cambia la base activa. La anterior permanece como `ramax_previous_<identificador>`.
4. Se revocan sesiones. El proceso informa éxito solo después de comprobar datos y disponibilidad de API. Volver a ingresar con una cuenta presente en la copia y consultar el resultado.

Los archivos `.job.json` guardan fecha, actor y resultado fuera de la base. No borrar `maintenance.json` manualmente para habilitar ventas. Las bases anteriores no se borran automáticamente; un responsable técnico puede eliminarlas tras verificar la recuperación y conservar una copia válida.

## Recuperar si la interfaz no inicia

Primero comprobar PostgreSQL y las tareas con `Get-ScheduledTaskInfo -TaskName Ramax-api` y `Ramax-recovery`. Un resultado fallido requiere revisar `.env.production`, permisos de carpetas, PostgreSQL y vigencia del certificado. Se puede ejecutar el comando Node de cada tarea en una consola administrativa para ver el error, con la tarea detenida.

Si se cortó la energía durante una restauración:

```powershell
Stop-ScheduledTask -TaskName Ramax-api
Stop-ScheduledTask -TaskName Ramax-recovery
node --env-file=.env.production apps/api/dist/apps/api/src/recover-local.js --rollback-interrupted
Start-ScheduledTask -TaskName Ramax-api
Start-ScheduledTask -TaskName Ramax-recovery
```

El comando conserva las bases involucradas, recupera la original y elimina mantenimiento solo después de validarla. Si falla, mantener los servicios detenidos y revisar las bases indicadas en `maintenance.json`.

Si la base activa está dañada y no hay una restauración en curso, usar:

```powershell
node --env-file=.env.production apps/api/dist/apps/api/src/restore-local.js --backup ID_DE_COPIA --actor ID_ADMINISTRADOR --confirm
```

Mantener el proceso de recuperación detenido. La API debe iniciarse para la verificación final; si no logra reconectar, el proceso intenta volver a la base anterior y registra el fallo. El procedimiento requiere credenciales de Windows del responsable técnico y un administrador activo identificable en la base local.

## Actualizar

1. Verificar una copia válida y detener ambas tareas.
2. Guardar la versión anterior del código y su `.env.production` fuera de Git.
3. Instalar dependencias bloqueadas, compilar y migrar explícitamente. El arranque no migra ni reinicia datos.
4. Iniciar tareas, verificar `/api/v1/health`, login y catálogo. Las copias de otra versión de esquema requieren el código correspondiente; no se restauran sobre un esquema diferente automáticamente.

## Aceptación en la PC del local

- Reiniciar Windows sin iniciar sesión y entrar desde otro dispositivo.
- Cortar solo internet, conservando la LAN, y realizar venta, consulta e impresión.
- Imprimir un ticket real de 80 mm y verificar márgenes, importes y legibilidad.
- Restaurar una copia de ensayo y repetir consulta y venta.
- Verificar fallo de backup visible y recuperación de arranque tras corte de energía.

Estas comprobaciones de hardware quedan pendientes hasta disponer de la PC Windows y la impresora.
