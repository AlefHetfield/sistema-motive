FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer fonts-crosextra-carlito fonts-crosextra-caladea \
    fonts-liberation fonts-dejavu-core ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY --chown=node:node api ./api
COPY --chown=node:node assets ./assets
COPY --chown=node:node scripts ./scripts
USER node
ENV NODE_ENV=production
ENV LIBREOFFICE_PATH=/usr/bin/soffice
CMD ["sh", "-c", "npm run db:migrate:deploy && node api/server.js"]
