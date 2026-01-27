# ---------------------------
# Dockerfile для Strapi (оптимизированный для малой памяти и быстрой сборки)
# ---------------------------

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Настройка npm для лучшей производительности
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm config set progress false && \
    npm config set loglevel error

# Копируем только файлы зависимостей для лучшего кэширования
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci --loglevel=error --progress=false || \
    npm install --loglevel=error --progress=false

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Настройка npm
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm config set progress false && \
    npm config set loglevel error

# Копируем только package.json для установки production зависимостей
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production --loglevel=error --progress=false || \
    npm install --only=production --loglevel=error --progress=false

# Копируем только необходимые файлы из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/config ./config
COPY --from=builder /app/types ./types
COPY --from=builder /app/favicon.png ./favicon.png

# Создаем необходимые директории
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Удаляем ненужные файлы для уменьшения размера образа
RUN rm -rf /app/node_modules/.cache && \
    find /app/node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type f -name "*.md" -delete 2>/dev/null || true && \
    find /app/node_modules -type f -name "*.map" -delete 2>/dev/null || true

EXPOSE 1337

# Запускаем Strapi
CMD sh -c "if [ \"$NODE_ENV\" = \"development\" ]; then npm run develop; else npm start; fi"