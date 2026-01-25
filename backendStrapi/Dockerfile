# ---------------------------
# Dockerfile для Strapi + yarn (multi-stage для экономии памяти)
# ---------------------------

# Stage 1: Установка зависимостей
FROM node:20 AS deps
WORKDIR /app

# Ограничиваем память Node для установки зависимостей
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Копируем только package.json и yarn.lock
COPY package.json yarn.lock ./

# Устанавливаем зависимости с оптимизацией памяти
RUN yarn install --frozen-lockfile --network-timeout 60000 --ignore-engines --no-progress --silent || \
    (yarn cache clean && yarn install --frozen-lockfile --network-timeout 60000 --ignore-engines --no-progress --silent)

# Stage 2: Сборка приложения
FROM node:20 AS builder
WORKDIR /app

# Ограничиваем память Node для сборки
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Копируем зависимости из предыдущего stage
COPY --from=deps /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

# Собираем Strapi
RUN yarn build

# Stage 3: Production образ
FROM node:20 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Копируем зависимости и собранное приложение
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.strapi ./.strapi
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/config ./config
COPY --from=builder /app/database ./database
COPY --from=builder /app/src ./src

# Удаляем dev-зависимости для production
RUN yarn install --production --ignore-scripts --prefer-offline --frozen-lockfile --no-progress --silent || true

# Создаем нужные директории для Strapi
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт
EXPOSE 1337

# Запуск Strapi
CMD ["yarn", "start"]
