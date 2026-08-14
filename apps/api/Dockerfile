# Development image. Production bundling is deferred to the deployment stage (T-17).
# Build context is the repo root — npm workspaces need the root lockfile.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api

CMD ["npm", "run", "dev"]
