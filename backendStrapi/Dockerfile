# ---------------------------
# Dockerfile для Strapi (простой вариант с npm, как работало раньше)
# ---------------------------

# Используем официальный Node.js
FROM node:20-alpine

# Рабочая директория
WORKDIR /app

# Настройка npm для лучшей производительности
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set progress false && \
    npm config set loglevel error

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (npm install работает без package-lock.json)
RUN npm install --loglevel=error --progress=false --no-audit --no-fund

# Копируем весь исходный код
COPY . .

# Собираем Strapi
RUN npm run build

# Удаляем dev-зависимости для production
RUN npm prune --production

# Создаем нужные директории для Strapi
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт
EXPOSE 1337

# Запуск Strapi
CMD ["npm", "start"]
