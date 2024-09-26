FROM node:20-alpine AS base
FROM nginxinc/nginx-unprivileged:1.26-alpine AS runner

FROM base AS deps
WORKDIR /var/www
COPY package.json package-lock.json ./
COPY plugins ./plugins/
RUN npm install

FROM base AS builder
WORKDIR /var/www
COPY --from=deps /var/www .
COPY . .
COPY --from=deps /var/www/plugins ./plugins/
ENV NODE_ENV=production
RUN npm run build

FROM runner
COPY --chown=101 --from=builder /var/www/dist /usr/share/nginx/html
COPY --chown=101 nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
