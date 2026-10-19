FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "server.mjs"]
