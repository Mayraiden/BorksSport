# Используем официальный образ Node.js
FROM node:20-alpine AS base

# Устанавливаем зависимости только если нужно
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируем файлы для установки зависимостей
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Сборка приложения
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Копируем все файлы сразу (кроме node_modules, который уже скопирован)
# Это гарантирует, что все файлы будут на месте с правильными именами
COPY . .

# Принимаем build аргументы для переменных окружения
ARG NEXT_PUBLIC_STRAPI_URL
ENV NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL

# Устанавливаем переменные окружения для сборки
ENV NEXT_TELEMETRY_DISABLED 1

# Отладочная проверка: убеждаемся, что файлы скопированы правильно
RUN echo "Checking if files exist..." && \
    ls -la src/features/Auth/ui/ && \
    ls -la src/shared/ui/ProfileDropdown.tsx && \
    ls -la src/shared/helpers/categoryImageMap.ts && \
    echo "Files check completed"

# Собираем приложение (используем next build напрямую без Turbopack для стабильности в Docker)
# Turbopack может иметь проблемы с разрешением путей в Docker окружении
RUN npx next build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем только необходимые файлы
COPY --from=builder /app/public ./public

# Копируем standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]

