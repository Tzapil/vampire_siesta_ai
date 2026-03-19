FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/

RUN npm install

FROM deps AS client-build

COPY apps/client apps/client
ENV NODE_OPTIONS=--max-old-space-size=384
RUN npm -w apps/client run build

FROM deps AS server-build

COPY apps/server apps/server
ENV NODE_OPTIONS=--max-old-space-size=384
RUN npm -w apps/server run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/

RUN npm install --omit=dev --workspace apps/server --include-workspace-root

COPY --from=server-build /app/apps/server/dist /app/apps/server/dist
COPY --from=client-build /app/apps/client/dist /app/client-dist

ENV PORT=4000
ENV CLIENT_DIST_PATH=/app/client-dist

EXPOSE 4000

CMD ["node", "apps/server/dist/index.js"]
