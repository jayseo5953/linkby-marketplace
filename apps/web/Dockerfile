# Development image — runs the Vite dev server (T-17).
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

WORKDIR /app/apps/web

CMD ["npm", "run", "dev"]
