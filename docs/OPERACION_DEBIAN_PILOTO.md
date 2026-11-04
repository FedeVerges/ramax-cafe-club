# Piloto en Debian 13

Esta instalación coloca la caja y el club en una notebook. Usa dos bases PostgreSQL 17 separadas y un proxy HTTPS. Es una prueba de despliegue: si la notebook se apaga, ambas aplicaciones dejan de estar disponibles. La separación de bases permite mover el club a otro servidor más adelante.

```text
Navegador ─HTTPS─► Caddy ─► API local ─► PostgreSQL local
                         └─► API club  ─► PostgreSQL club
                                ▲
                     sincronización desde API local
```

## Requisitos antes de instalar

- Debian 13 de 64 bits, Docker Engine y el complemento Compose. Seguir la [guía oficial para Debian](https://docs.docker.com/engine/install/debian/).
- Para probar en la red local, usar la IP fija de la notebook como `PILOT_DOMAIN`. Caddy emite un certificado local; hay que instalar la raíz de confianza de Caddy en cada dispositivo del personal. [Caddy documenta este modo para direcciones IP privadas](https://caddyserver.com/docs/automatic-https#local-https). El acceso real con Google no funcionará con una IP privada.
- Para que entren socios desde Internet, usar un dominio o URL pública estable, HTTPS y un cliente OAuth de tipo "Aplicación web" con ese origen autorizado. [Google exige HTTPS y un nombre público fuera de localhost](https://developers.google.com/identity/gsi/web/guides/display-button). Según la forma de acceso elegida, habrá que abrir 80/443 o configurar un túnel.
- Espacio para dos bases, imágenes Docker y copias. La RAM informada de 5 GB sirve como punto de partida para el piloto; medir uso real con `docker stats` después del arranque.

No publicar los puertos de PostgreSQL ni de las API. El archivo `deploy/pilot/compose.yaml` solo publica 80 y 443 del proxy. El cambio `TRUST_PROXY_TLS=true` se usa únicamente cuando la API local está detrás de ese proxy y su puerto no está publicado.

## Preparar configuración

Desde la raíz del repositorio en Debian:

```bash
cp deploy/pilot/.env.example deploy/pilot/.env
chmod 600 deploy/pilot/.env
```

Completar la IP local o el dominio, un UUID para `CLUB_SOURCE_ID` y cuatro secretos distintos, incluido `PILOT_MEMBER_ACCESS_CODE`. Para generar contraseñas, el token y el código, usar `openssl rand -hex 32`. No copiar los valores de desarrollo ni subir `deploy/pilot/.env` a Git. `GOOGLE_CLIENT_ID` puede quedar vacío durante la prueba en LAN. Si se configura o cambia después, hay que reconstruir la imagen: Vite lo incorpora al navegador durante la compilación.

## Primer arranque

Los comandos siguientes parten de la raíz del repositorio. Ejecutar las migraciones **antes** de iniciar las API:

```bash
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml build
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml up -d local-db cloud-db
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml run --no-deps --rm --workdir /app/apps/api local-api node node_modules/drizzle-kit/bin.cjs migrate --config drizzle.config.ts
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml run --no-deps --rm --workdir /app/apps/api cloud-api node node_modules/drizzle-kit/bin.cjs migrate --config drizzle.cloud.config.ts
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml up -d cloud-api local-api recovery-worker caddy
```

Crear el primer administrador con una contraseña introducida en la consola, sin ponerla en el historial:

```bash
read -r -p "Usuario administrador: " ADMIN_USERNAME
read -r -s -p "Contraseña administrador: " ADMIN_PASSWORD
echo
export ADMIN_USERNAME ADMIN_PASSWORD
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml exec -T -e ADMIN_USERNAME -e ADMIN_PASSWORD local-api /app/apps/api/node_modules/.bin/tsx /app/apps/api/scripts/seed-admin.ts
unset ADMIN_USERNAME ADMIN_PASSWORD
```

Entrar por `https://IP-o-dominio/login`. El administrador guarda primero la regla de **$100 por punto** en `/club-admin`. Con `PILOT_MEMBER_LOGIN_ENABLED=true`, una persona de prueba ingresa por `/club/acceso` usando el código privado. La primera entrada crea un único socio de prueba; las siguientes usan esa misma cuenta y su número. Google se prueba cuando exista URL pública y cliente OAuth. Las maquetas siguen en `/maquetas`.

## Comprobación y operación

```bash
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml ps
docker compose --env-file deploy/pilot/.env -f deploy/pilot/compose.yaml logs --tail=100 local-api cloud-api recovery-worker caddy
docker stats --no-stream
```

Comprobar `https://IP-o-dominio/api/v1/health` y `https://IP-o-dominio/api/v1/club/auth/me`. El primero debe responder por la caja y el segundo por cloud. En LAN, instalar primero la raíz de confianza de Caddy en los navegadores del personal. Ingresar al club con el código, anotar el número de socio y hacer una venta de prueba asociada. Comprobar que el club muestre `piso(total / 100)` puntos una sola vez. Verificar también una venta sin conexión y su cobro. El ingreso real con Google queda pendiente.

Para actualizar, hacer copia y verificarla primero, detener las API, reconstruir la imagen, aplicar migraciones y volver a iniciar. No usar `docker compose down --volumes`: elimina las bases y las copias del piloto.

Las copias locales se guardan en el volumen `ramax-pilot_local_backups`. Ese volumen está en el mismo disco que las bases; una falla de disco puede perder todo. Antes de usar datos reales, copiar y probar una restauración en un medio fuera de la notebook. La copia central cifrada de E2 sigue pendiente.

## Prueba previa hecha en la Mac

La imagen Linux compiló con Node 22 y PostgreSQL 17. `argon2` y `pg_dump 17` funcionaron dentro del contenedor. Compose pasó la validación, ambas migraciones se aplicaron en bases aisladas y las dos API respondieron `200`; también se creó y autenticó un administrador ficticio. Falta repetir esas comprobaciones en la notebook y medir su consumo.
