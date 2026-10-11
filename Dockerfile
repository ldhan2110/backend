# syntax=docker/dockerfile:1

# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build && pnpm prune --prod

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

# Non-secret config passed from CI/CD (e.g. --build-arg NODE_ENV=production)
ARG NODE_ENV=production
ARG PORT=8080
ARG CORS_ORIGIN=*
ARG DB_TYPE=postgres
ARG DB_HOST=localhost
ARG DB_PORT=5432
ARG DB_USERNAME=postgres
ARG DB_NAME=postgres
ARG DB_LOGGING=true
ARG LOG_LEVEL=info
ARG JWT_ACCESS_TTL=15m
ARG JWT_REFRESH_TTL=7d

ENV NODE_ENV=${NODE_ENV} \
    PORT=${PORT} \
    CORS_ORIGIN=${CORS_ORIGIN} \
    DB_TYPE=${DB_TYPE} \
    DB_HOST=${DB_HOST} \
    DB_PORT=${DB_PORT} \
    DB_USERNAME=${DB_USERNAME} \
    DB_NAME=${DB_NAME} \
    DB_LOGGING=${DB_LOGGING} \
    LOG_LEVEL=${LOG_LEVEL} \
    JWT_ACCESS_TTL=${JWT_ACCESS_TTL} \
    JWT_REFRESH_TTL=${JWT_REFRESH_TTL}

# Secrets — pass at runtime, never baked into image:
#   -e DB_PASSWORD=... -e JWT_ACCESS_SECRET=... -e JWT_REFRESH_SECRET=... -e REDIS_URL=...

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE ${PORT}
CMD ["node", "dist/main"]
