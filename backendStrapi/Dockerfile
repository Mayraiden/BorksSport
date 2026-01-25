# ---------------------------
# Dockerfile для Strapi + yarn
# ---------------------------

# Используем официальный Node.js
FROM node:20

# Рабочая директория
WORKDIR /app

# Ограничиваем память Node (критично для build на слабых серверах)
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем только package.json и yarn.lock, чтобы кешировать зависимости
COPY package.json yarn.lock ./

# Устанавливаем зависимости
# --frozen-lockfile — строго по lock файлу
# --network-timeout — защита от долгих сетевых запросов
RUN yarn install --frozen-lockfile --network-timeout 600000

# Копируем весь исходный код
COPY . .

# Собираем Strapi
RUN yarn build

# Удаляем dev-зависимости для production
RUN yarn install --production --ignore-scripts --prefer-offline

# Создаем нужные директории для Strapi
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт
EXPOSE 1337

# Запуск Strapi
CMD ["yarn", "start"]
