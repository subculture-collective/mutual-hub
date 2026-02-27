FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/api/package.json ./services/api/package.json
COPY services/indexer/package.json ./services/indexer/package.json
COPY services/moderation-worker/package.json ./services/moderation-worker/package.json
COPY packages/at-lexicons/package.json ./packages/at-lexicons/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install --no-audit --no-fund

FROM deps AS source

WORKDIR /app
COPY . .

FROM source AS api-runtime

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@patchwork/api"]

FROM source AS indexer-runtime

ENV NODE_ENV=production
EXPOSE 4100
CMD ["npm", "run", "start", "-w", "@patchwork/indexer"]

FROM source AS moderation-runtime

ENV NODE_ENV=production
EXPOSE 4200
CMD ["npm", "run", "start", "-w", "@patchwork/moderation-worker"]

FROM source AS web-build

ARG VITE_APP_NAME=Patchwork
ARG VITE_API_BASE_URL=https://patchwork.subcult.tv/api
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build -w @patchwork/web

FROM nginx:1.27-alpine AS web-runtime

COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY ./docker/nginx/patchwork-web.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
