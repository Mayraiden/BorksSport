FROM node:20

WORKDIR /app

# Ограничиваем память Node
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Копируем package.json и yarn.lock
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile --network-timeout 600000

# Копируем весь код
COPY . .

# Собираем Strapi
RUN yarn build

# Удаляем dev-зависимости
RUN yarn install --production --ignore-scripts --prefer-offline

EXPOSE 1337

CMD ["yarn", "start"]
