FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci
COPY . .
# Pass TURN server config at build time (Vite bakes env vars into the client bundle)
ARG VITE_TURN_URL
ARG VITE_TURN_USER
ARG VITE_TURN_PASS
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 3000
CMD ["node", "server/src/index.js"]
