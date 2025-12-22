# Используем официальный образ Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Настройка npm для лучшей производительности и надежности
# Увеличиваем таймауты и количество повторов для медленных соединений
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set progress true && \
    npm config set loglevel info

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости с подробным выводом прогресса
# Используем npm ci для production (быстрее и надежнее, требует package-lock.json)
# Если npm ci не работает (нет lock файла), fallback на npm install
RUN npm ci --loglevel=info --progress=true || \
    npm install --loglevel=info --progress=true

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

