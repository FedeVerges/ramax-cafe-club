FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack pnpm install --frozen-lockfile

COPY . .
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN corepack pnpm build

FROM postgres:17-bookworm

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build --chown=postgres:postgres /app /app
RUN mkdir -p /data/backups && chown postgres:postgres /data/backups

WORKDIR /app
USER postgres
ENTRYPOINT []
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
