# Ramax Café Club

Sistema para una sucursal: acceso del personal, productos, inventario, ventas, comprobantes, anulaciones y copias de seguridad. E0/E1 está implementado y probado en macOS. Socios, puntos, canjes y cloud quedan para E2/E3.

```text
Navegador → http://localhost:3000
                 ├─ Web React
                 └─ API /api/v1 → PostgreSQL 17 en Docker
                                      ↑
                            Backup y recuperación
```

## Requisitos en macOS

- Node.js 22.12 o posterior, con Corepack disponible.
- Docker Desktop instalado y abierto.
- Git. La versión de pnpm está fijada en `package.json`.

Ejecutar los comandos desde la raíz del repositorio. La aplicación usa el puerto `3000`; PostgreSQL usa `5433`.

## Primera instalación

### 1. Dependencias y configuración

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
cp .env.local.example .env.local
chmod 600 .env .env.local
```

Editar `.env` y completar `ADMIN_USERNAME`, `ADMIN_PASSWORD` y, opcionalmente, `ADMIN_NAME`. La contraseña debe tener al menos 8 caracteres. Las credenciales PostgreSQL `ramax:ramax` corresponden al contenedor de desarrollo incluido.

| Archivo | Variable | Valor local |
|---|---|---|
| `.env` | `DATABASE_URL` | `postgresql://ramax:ramax@localhost:5433/ramax` |
| `.env` | `ADMIN_USERNAME` | Usuario único, por ejemplo `admin` |
| `.env` | `ADMIN_PASSWORD` | Contraseña elegida para el primer administrador |
| `.env.local` | `WEB_ORIGIN` | `http://localhost:3000` |
| `.env.local` | `WEB_DIST_DIR` | `./apps/web/dist` |
| `.env.local` | `BACKUP_DIR` | `./var/local-backups` |
| `.env.local` | `PG_BIN_DIR` | `./scripts/local` |
| `.env.local` | `MIGRATIONS_DIR` | `./db/migrations` |

El arranque carga `.env`, luego `.env.local`. Las variables exportadas en la terminal tienen prioridad. Las rutas relativas se resuelven desde la raíz. E0/E1 no requiere credenciales de Google.

### 2. Base y administrador

```bash
docker compose up -d --wait postgres
node --env-file=.env apps/api/node_modules/drizzle-kit/bin.cjs migrate --config=apps/api/drizzle.production.config.ts
corepack pnpm --filter @ramax/api seed:admin
```

Las migraciones se aplican explícitamente. `seed:admin` crea una cuenta nueva y falla si el usuario existe; no restablece contraseñas. En una instalación ya configurada, pasar a **Ejecución diaria**.

Si una base anterior tiene otro historial, revisar [la adaptación local](docs/OPERACION_MAC_LOCAL.md#adaptación-de-la-base-anterior) antes de migrar. El arranque no recrea datos ni aplica migraciones automáticamente.

### 3. Compilar e iniciar

```bash
corepack pnpm build
corepack pnpm start:local
```

Abrir **[http://localhost:3000](http://localhost:3000)** e ingresar con el administrador configurado. Web y API comparten origen; esta modalidad no necesita iniciar Vite.

El comando espera que PostgreSQL esté saludable e inicia API y copias. Detecta el contenedor aunque la carpeta del proyecto tenga otro nombre. Mantener la terminal abierta. `Ctrl+C` detiene ambos procesos y conserva la base.

## Ejecución diaria

Abrir Docker Desktop y ejecutar:

```bash
corepack pnpm start:local
```

Si cambió el código: detener, ejecutar `corepack pnpm build` y volver a iniciar. Aplicar las migraciones nuevas por separado, después de verificar una copia.

La caja funciona sin internet mientras el servidor local esté disponible. El indicador verifica una conexión externa independiente; no participa del cobro. Esta instalación HTTP es para pruebas en la Mac. HTTPS y arranque automático del negocio se describen en [Operación Windows](docs/OPERACION_WINDOWS.md).

## Datos de prueba

Con la aplicación en ejecución, en otra terminal:

```bash
corepack pnpm seed:demo --confirm
```

El seed utiliza el acceso privado ya guardado en esta Mac o `ADMIN_USERNAME`/`ADMIN_PASSWORD` de `.env`. Para otro administrador local, definir `SEED_USERNAME` y `SEED_PASSWORD` en la terminal. No crea ni cambia la contraseña del administrador.

| Datos agregados | Cantidad |
|---|---:|
| Productos en cinco categorías | 18 |
| Empleados activos / cuenta desactivada | 2 / 1 |
| Ventas en efectivo / transferencia simulada | 16 / 8 |
| Ventas finalizadas / anuladas | 20 / 4 |

Incluye stock bajo, agotados, un producto inactivo, ingresos, merma y precios históricos. No realiza pagos ni devoluciones externos.

- Accesos de empleados: `var/demo/access.json`.
- Registro para reanudar: `var/demo/seed.json`.
- En esta Mac, acceso del administrador: `var/local-adaptation/access.json`.

Repetir conserva datos y no duplica pasos registrados. No borrar el registro para recargar stock. Después de crear cuentas y poblar datos, quitar `ADMIN_PASSWORD` de `.env`. Para repetir el seed en una instalación nueva, proporcionar el acceso del administrador mediante las variables `SEED_*`.

## Backup y recuperación

El proceso comprueba cada minuto si falta la copia del día de San Luis. Valida cada copia restaurándola temporalmente, conserva 30 días y depura copias antiguas solo después de validar una nueva. Los archivos y registros se guardan fuera de PostgreSQL.

En macOS, `scripts/local/pg_dump` y `pg_restore` usan las herramientas del contenedor. `BACKUP_DIR` permite elegir otra carpeta. Desde **Copias de seguridad**, el administrador puede consultar y solicitar restauraciones. El reemplazo bloquea escrituras y revoca sesiones.

La base vive en el volumen `ramax_postgres`. `docker compose down` conserva el volumen; `docker compose down -v` lo elimina. Git no traslada volúmenes ni archivos de `var/`: usar un backup para llevar datos a otra máquina.

## Desarrollo y pruebas

Para recarga automática, detener la modalidad compilada y mantener `WEB_ORIGIN=http://localhost:5173` en `.env`:

```bash
corepack pnpm dev:api
# En otra terminal:
corepack pnpm dev:web
```

Web: `http://localhost:5173`. API: `http://localhost:3000/api/v1`. Estos comandos no inician el proceso de copias.

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

Las integraciones requieren bases aisladas cuyo nombre termine en `_test`. La suite operativa vacía sus tablas: no configurar la base cotidiana como `TEST_DATABASE_URL`. Sin esas variables, `test` ejecuta unitarias y omite integraciones.

Para Playwright, instalar Chromium y usar una base de prueba ya migrada:

```bash
corepack pnpm --filter @ramax/web exec playwright install chromium
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:PORT/ramax_test corepack pnpm test:e2e
```

Ejecutar integración y E2E en secuencia si comparten base. Consultar [los pasos de verificación y recuperación](docs/IMPLEMENTACION_E0_E1.md).

## Problemas frecuentes

| Síntoma | Comprobación |
|---|---|
| Docker no responde | Abrir o reiniciar Docker Desktop; ejecutar `docker info` |
| Puerto 3000 ocupado | Detener otra API o la modalidad de desarrollo |
| Puerto 5433 ocupado | Revisar otro PostgreSQL o contenedor |
| Servidor local no disponible | Revisar terminal y `/api/v1/health` |
| Interfaz desactualizada | Compilar, reiniciar y recargar |
| Copia fallida | Revisar Docker, espacio y permisos de `BACKUP_DIR` |
| Usuario existente al hacer seed | Ingresar con esa cuenta; no se sobrescribe su contraseña |

## Estructura y documentación

```text
apps/web            React 19 + Vite
apps/api            NestJS y scripts de base
packages/contracts  Tipos compartidos
db/schema           Esquema Drizzle
db/migrations       Migraciones versionadas
scripts/local       Arranque, herramientas PostgreSQL y seed
scripts/windows     Instalación y certificados
docs                Alcance, decisiones, operación y maquetas
```

- [Plan de desarrollo](docs/PLAN_DESARROLLO_INCREMENTAL.md).
- [Registro de la réplica macOS](docs/OPERACION_MAC_LOCAL.md).
- [Instalación y recuperación Windows](docs/OPERACION_WINDOWS.md).
- [Implementación y pruebas E0/E1](docs/IMPLEMENTACION_E0_E1.md).

## Preparar cambios para Git

Versionar código, migraciones, documentación, `.env.example`, `.env.local.example` y `pnpm-lock.yaml`. `.gitignore` excluye credenciales, entornos locales, dependencias, compilados, backups y resultados. No forzar su inclusión con `git add -f`.

```bash
git status --short
git diff --check
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

La aceptación en el negocio todavía requiere Windows, certificados, impresión física y pruebas reales de reinicio y caída de internet.
