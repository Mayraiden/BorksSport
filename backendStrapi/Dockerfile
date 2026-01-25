# Используем официальный образ Node.js
FROM node:20

# Рабочая директория
WORKDIR /app

# Ограничиваем память Node (критично для npm/yarn install и build)
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем только файлы зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
# --frozen-lockfile — гарантирует соответствие yarn.lock
# --network-timeout — защита от долгих сетевых запросов
RUN yarn install --frozen-lockfile --network-timeout 600000

# Копируем исходный код
COPY . .

# Собираем Strapi
RUN yarn build

# Удаляем dev-зависимости
RUN yarn install --production --ignore-scripts --prefer-offline

# Создаём необходимые директории
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт Strapi
EXPOSE 1337

# Запуск
CMD sh -c "if [ \"$NODE_ENV\" = \"development\" ]; then yarn develop; else yarn start; fi"
