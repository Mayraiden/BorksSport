# Docker Setup для SportMagazine

Инструкция по запуску фронтенда и бэкенда в Docker-контейнерах.

## Предварительные требования

- Docker Desktop или Docker Engine установлен и запущен
- Docker Compose версии 3.8 или выше

## Структура проекта

```
SportMagazine/
├── frontend/          # Next.js приложение
├── backendStrapi/     # Strapi приложение
└── docker-compose.yml # Конфигурация Docker Compose
```

## Быстрый старт

### 1. Подготовка переменных окружения

#### Backend (.env файл)

**Если у вас уже есть `backendStrapi/.env` файл:**

- Используйте его как есть! Docker Compose автоматически загрузит все переменные из этого файла
- Убедитесь, что в файле есть все необходимые переменные (см. список ниже)
- **Важно:** В Docker контейнере переменная `DATABASE_HOST` будет автоматически переопределена на `postgres` (имя сервиса в Docker сети)

**Если файла нет, создайте его:**

```bash
cp backendStrapi/.env.example backendStrapi/.env
```

**Обязательные переменные в `backendStrapi/.env`:**

- `APP_KEYS` - 4 случайных ключа через запятую
- `API_TOKEN_SALT` - случайная строка
- `ADMIN_JWT_SECRET` - случайная строка
- `JWT_SECRET` - случайная строка
- `TRANSFER_TOKEN_SALT` - случайная строка
- `ENCRYPTION_KEY` - случайная строка
- `DATABASE_CLIENT=postgres` (или оставьте, будет переопределено)
- `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` (или оставьте значения по умолчанию)

**Что такое "секреты" и зачем они нужны?**

Секреты (secrets) — это криптографические ключи, которые Strapi использует для безопасности:

- **APP_KEYS** — ключи для шифрования данных приложения (куки, сессии)
- **JWT_SECRET** — ключ для подписи JWT токенов пользователей (авторизация)
- **ADMIN_JWT_SECRET** — ключ для подписи JWT токенов администраторов
- **API_TOKEN_SALT** — соль для хеширования API токенов
- **TRANSFER_TOKEN_SALT** — соль для токенов передачи данных
- **ENCRYPTION_KEY** — ключ для шифрования чувствительных данных

**Важно:** Эти ключи должны быть уникальными случайными строками. Не используйте одинаковые секреты на разных серверах (dev/production). Если секреты скомпрометированы, злоумышленник может подделать токены или расшифровать данные.

**Если у вас уже есть рабочий .env файл:** Секреты уже настроены, ничего менять не нужно.

**Если создаете новый .env:** Нужно сгенерировать новые случайные секреты (см. ниже).

**Примечание:** В `docker-compose.yml` переменные `DATABASE_HOST` и `DATABASE_PORT` автоматически переопределяются для работы в Docker сети, поэтому в вашем `.env` файле они могут быть любыми (или отсутствовать).

**Генерация секретов (Linux/Mac):**

```bash
# Используйте готовый скрипт
./generate-secrets.sh

# Или вручную для каждого секрета
openssl rand -base64 32
```

**Генерация секретов (Windows PowerShell):**

```powershell
# Используйте готовый скрипт
.\generate-secrets.ps1

# Или вручную для каждого секрета
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

#### Frontend (.env файл)

Создайте файл `frontend/.env` на основе `frontend/.env.example`:

```bash
cp frontend/.env.example frontend/.env
```

Для Docker окружения значения уже настроены правильно:

- `NEXT_PUBLIC_API_URL=http://backend:1337`
- `NEXT_STRAPI_URL=http://backend:1337`

### 2. Запуск контейнеров

Из корневой директории проекта выполните:

```bash
docker-compose up -d --build
```

Эта команда:

- Соберет образы для frontend и backend
- Создаст и запустит все контейнеры (postgres, backend, frontend)
- Запустит их в фоновом режиме

### 3. Проверка статуса

Проверьте, что все контейнеры запущены:

```bash
docker-compose ps
```

Вы должны увидеть 3 сервиса в статусе `Up`:

- `sportmagazine-postgres`
- `sportmagazine-backend`
- `sportmagazine-frontend`

### 4. Просмотр логов

**Все сервисы:**

```bash
docker-compose logs -f
```

**Отдельный сервис:**

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 5. Доступ к приложению

- **Frontend:** http://localhost:3000
- **Backend (Strapi Admin):** http://localhost:1337/admin
- **PostgreSQL:** localhost:5432

## Первоначальная настройка Strapi

После первого запуска:

1. Откройте http://localhost:1337/admin
2. Создайте администраторский аккаунт
3. Настройте необходимые Content Types и API

## Остановка контейнеров

```bash
docker-compose down
```

Для остановки и удаления volumes (⚠️ удалит данные БД):

```bash
docker-compose down -v
```

## Пересборка контейнеров

После изменений в коде:

```bash
docker-compose up -d --build
```

Или для конкретного сервиса:

```bash
docker-compose up -d --build frontend
docker-compose up -d --build backend
```

## Управление данными

### Volumes

Docker Compose создает следующие volumes:

- `postgres_data` - данные PostgreSQL
- `backend_uploads` - загруженные файлы Strapi
- `backend_data` - временные данные Strapi

### Резервное копирование БД

```bash
docker-compose exec postgres pg_dump -U strapi strapi > backup.sql
```

### Восстановление БД

```bash
docker-compose exec -T postgres psql -U strapi strapi < backup.sql
```

## Переменные окружения

### Backend (Strapi)

Все переменные окружения загружаются из файла `backendStrapi/.env` через `env_file` в docker-compose.yml.

**Критичные переменные для Docker автоматически переопределяются:**

- `DATABASE_HOST=postgres` (имя сервиса в Docker сети)
- `DATABASE_PORT=5432`
- `HOST=0.0.0.0` (для работы в контейнере)

**Приоритет переменных:**

1. Переменные в секции `environment` в docker-compose.yml (переопределяют .env)
2. Переменные из файла `backendStrapi/.env`
3. Значения по умолчанию в docker-compose.yml (через `${VAR:-default}`)

**Рекомендация:** Храните все секреты и настройки в `backendStrapi/.env` файле. В docker-compose.yml переопределяются только переменные, необходимые для работы в Docker сети.

### Frontend (Next.js)

Переменные с префиксом `NEXT_PUBLIC_` доступны в браузере.

Для Docker используйте `http://backend:1337` (имя сервиса).

## Troubleshooting

### Проблема: Backend не может подключиться к PostgreSQL

**Решение:**

1. Убедитесь, что postgres контейнер запущен: `docker-compose ps`
2. Проверьте логи: `docker-compose logs postgres`
3. Проверьте переменные окружения в `backendStrapi/.env`

### Проблема: Frontend не может подключиться к Backend

**Решение:**

1. Убедитесь, что используется правильный URL: `http://backend:1337` (не localhost)
2. Проверьте, что backend контейнер запущен: `docker-compose ps`
3. Проверьте CORS настройки в `backendStrapi/config/middlewares.ts`

### Проблема: Порт уже занят

**Решение:**
Измените порты в `docker-compose.yml`:

```yaml
ports:
  - '3001:3000' # Вместо 3000:3000
  - '1338:1337' # Вместо 1337:1337
```

### Проблема: Ошибки при сборке

**Решение:**

1. Очистите кэш Docker: `docker system prune -a`
2. Пересоберите без кэша: `docker-compose build --no-cache`

### Проблема: Изменения в коде не применяются

**Решение:**
В production режиме нужно пересобрать контейнер:

```bash
docker-compose up -d --build
```

## Разработка

Для разработки рекомендуется запускать сервисы локально:

- Frontend: `cd frontend && yarn dev`
- Backend: `cd backendStrapi && yarn dev`

Docker используется для тестирования production окружения.

## Production рекомендации

1. **Секреты:** Используйте Docker secrets или внешние системы управления секретами
2. **Пароли БД:** Используйте сильные пароли для PostgreSQL
3. **CORS:** Ограничьте CORS только нужными доменами
4. **Volumes:** Настройте backup для volumes с данными
5. **Мониторинг:** Добавьте health checks и мониторинг
6. **Reverse Proxy:** Используйте Nginx или Traefik перед контейнерами

## Полезные команды

```bash
# Просмотр использования ресурсов
docker stats

# Вход в контейнер
docker-compose exec backend sh
docker-compose exec frontend sh
docker-compose exec postgres psql -U strapi strapi

# Очистка неиспользуемых ресурсов
docker system prune

# Просмотр логов последних 100 строк
docker-compose logs --tail=100
```
