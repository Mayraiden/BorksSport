# Используем официальный образ Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки TypeScript)
RUN npm install

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Удаляем dev зависимости после сборки
RUN npm prune --production

# Создаем необходимые директории
RUN mkdir -p /app/.tmp /app/public/uploads /app/logs

# Открываем порт
EXPOSE 1337

# Запускаем Strapi (в development режиме используем develop, в production - start)
CMD sh -c "if [ \"$NODE_ENV\" = \"development\" ]; then npm run develop; else npm start; fi"

