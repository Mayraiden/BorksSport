# Используем официальный образ Node.js
FROM node:20-alpine

# Устанавливаем yarn глобально
RUN npm install -g yarn@1.22.22

# Устанавливаем рабочую директорию
WORKDIR /app

# Настройка yarn для лучшей производительности
RUN yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1

# Копируем файлы зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
# Используем yarn install --frozen-lockfile (аналог npm ci для yarn)
RUN yarn install --frozen-lockfile --production=false || \
    yarn install --production=false

# Копируем исходный код
COPY . .

# Собираем приложение
RUN yarn build

# Удаляем dev зависимости после сборки
RUN yarn install --production --frozen-lockfile

# Создаем необходимые директории
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт
EXPOSE 1337

# Запускаем Strapi (в development режиме используем develop, в production - start)
CMD sh -c "if [ \"$NODE_ENV\" = \"development\" ]; then yarn develop; else yarn start; fi"

