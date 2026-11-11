# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN addgroup -S unfurler && adduser -S unfurler -G unfurler
USER unfurler

EXPOSE 3003

CMD ["node", "index.js"]
