# ---------------------------
# Dockerfile для Strapi (оптимизированный для малой памяти)
# ---------------------------

    FROM node:20

    WORKDIR /app
    
    # Ограничиваем память Node.js (1GB для установки)
    ENV NODE_OPTIONS="--max-old-space-size=1024"
    
    # Настройка npm
    RUN npm config set fetch-retries 3 && \
        npm config set fetch-retry-mintimeout 20000 && \
        npm config set fetch-retry-maxtimeout 60000 && \
        npm config set progress false && \
        npm config set loglevel error
    
    COPY package*.json ./
    
    # Устанавливаем зависимости с минимальным потреблением памяти
    RUN npm install --loglevel=error --progress=false --no-audit --no-fund --prefer-offline
    
    COPY . .
    
    # Увеличиваем лимит для сборки
    ENV NODE_OPTIONS="--max-old-space-size=1536"
    RUN npm run build
    
    # Удаляем dev-зависимости
    RUN npm prune --production
    
    RUN mkdir -p /app/.tmp /app/public/uploads /app/logs
    
    EXPOSE 1337
    
    CMD ["npm", "start"]