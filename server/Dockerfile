FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
COPY server/package.json ./server/package.json
RUN npm ci --workspace server --omit=dev

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY server ./server

WORKDIR /app/server
EXPOSE 4000 8080
CMD ["node", "src/index.js"]
