# Документация по развертыванию проекта SportMagazine

## Обзор
Проект развернут на сервере с IP `185.251.88.214` и доменом `borkssport.ru`.
- Frontend: `http://borkssport.ru` (порт 3000)
- Backend API: `http://api.borkssport.ru` (порт 1337)
- Backend Admin: `https://api.borkssport.ru/admin`

## Структура проекта
```
~/sportmagazine/
├── frontend/          # Next.js приложение
├── backendStrapi/     # Strapi CMS
└── docker-compose.yml # (не используется, развертывание раздельное)
```

## 1. Подготовка сервера

### 1.1 Обновление системы
```bash
apt update
apt upgrade -y
```

### 1.2 Установка Docker и Docker Compose
```bash
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker
```

Проверка установки:
```bash
docker --version
docker-compose --version
```

### 1.3 Установка Nginx
```bash
apt install -y nginx certbot python3-certbot-nginx
systemctl start nginx
systemctl enable nginx
```

## 2. Загрузка проекта на сервер

### 2.1 Создание директории проекта
```bash
mkdir -p ~/sportmagazine
cd ~/sportmagazine
```

### 2.2 Загрузка файлов
Проект был загружен через SCP в виде zip-архивов:
- `backendStrapi.zip` - backend
- `frontend.zip` - frontend

Распаковка:
```bash
unzip backendStrapi.zip
unzip frontend.zip
```

## 3. Настройка Backend (Strapi)

### 3.1 Конфигурация .env
Файл: `~/sportmagazine/backendStrapi/.env`

Важные переменные:
```env
# Server
HOST=0.0.0.0
PORT=1337

# Database
DATABASE_CLIENT=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
DATABASE_SSL=false

# CORS (важно для работы с frontend)
CORS_ORIGIN=http://borkssport.ru,http://www.borkssport.ru,http://api.borkssport.ru,http://localhost:3000

# Public URL
PUBLIC_URL=https://api.borkssport.ru
```

**Важно:** В .env файле используется формат `KEY=value` (без двоеточия).

### 3.2 Конфигурация server.ts
Файл: `~/sportmagazine/backendStrapi/config/server.ts`

```typescript
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  proxy: true,
  url: env('PUBLIC_URL', 'https://api.borkssport.ru'),
  allowedHosts: [
    'localhost',
    'api.borkssport.ru',
    '185.251.88.214',
    'borkssport.ru',
    'www.borkssport.ru',
  ],
});
```

### 3.3 Конфигурация vite.config.ts для админ-панели
Файл: `~/sportmagazine/backendStrapi/src/admin/vite.config.ts`

```typescript
import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: [
        'api.borkssport.ru',
        'localhost',
        '185.251.88.214',
        'borkssport.ru',
        'www.borkssport.ru',
      ],
    },
  });
};
```

### 3.4 Конфигурация CORS в middlewares.ts
Файл: `~/sportmagazine/backendStrapi/config/middlewares.ts`

```typescript
{
  name: 'strapi::cors',
  config: {
    enabled: true,
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000', 'http://frontend:3000', 'http://127.0.0.1:3000'],
    headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    credentials: true,
  },
}
```

### 3.5 Docker Compose для Backend
Файл: `~/sportmagazine/backendStrapi/docker-compose.yml`

Важно: В секции `strapi` -> `environment` должны быть явно указаны переменные:
```yaml
environment:
  # ... другие переменные ...
  CORS_ORIGIN: http://borkssport.ru,http://www.borkssport.ru,http://api.borkssport.ru,http://localhost:3000
  PUBLIC_URL: https://api.borkssport.ru
  HOST: 0.0.0.0
```

И обязательно проброс портов:
```yaml
ports:
  - '1337:1337'
```

### 3.6 Запуск Backend
```bash
cd ~/sportmagazine/backendStrapi
docker-compose up -d
```

Проверка:
```bash
docker ps
docker logs sportmagazine_strapi --tail 50
curl http://localhost:1337
```

## 4. Настройка Frontend (Next.js)

### 4.1 Конфигурация .env
Файл: `~/sportmagazine/frontend/.env`

```env
NEXT_PUBLIC_STRAPI_URL=http://api.borkssport.ru
NEXT_STRAPI_URL=http://api.borkssport.ru
```

**Важно:** В Next.js переменные с префиксом `NEXT_PUBLIC_` доступны в браузере и должны быть установлены на этапе сборки.

### 4.2 Конфигурация docker-compose.yml
Файл: `~/sportmagazine/frontend/docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_STRAPI_URL=http://api.borkssport.ru
    container_name: sportmagazine-frontend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: "0.0.0.0"
      NEXT_PUBLIC_STRAPI_URL: http://api.borkssport.ru
    ports:
      - '3000:3000'
    networks:
      - frontend-network

networks:
  frontend-network:
    driver: bridge
    external: false
```

### 4.3 Обновление API файлов
Все API файлы должны использовать переменную окружения вместо захардкоженного `localhost:1337`:

**Файлы, которые были обновлены:**
- `src/features/Product/api/productApi.ts`
- `src/features/Cart/api/cartApi.ts`
- `src/features/Favorites/api/favoritesApi.ts`
- `src/features/Filters/api/categoryApi.ts`
- `src/features/Checkout/api/checkoutApi.ts`
- `src/shared/lib/utils/searchDebug.ts`

**Формат:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'
```

### 4.4 Запуск Frontend
```bash
cd ~/sportmagazine/frontend
docker-compose build --no-cache
docker-compose up -d
```

Проверка:
```bash
docker ps
docker logs sportmagazine-frontend --tail 50
curl http://localhost:3000
```

## 5. Настройка Nginx

### 5.1 Конфигурация для Frontend
Файл: `/etc/nginx/sites-available/borkssport`

```nginx
server {
    listen 80;
    server_name borkssport.ru www.borkssport.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активация:
```bash
ln -s /etc/nginx/sites-available/borkssport /etc/nginx/sites-enabled/
```

### 5.2 Конфигурация для Backend API
Файл: `/etc/nginx/sites-available/borkssport-api`

```nginx
# HTTP
server {
    listen 80;
    server_name api.borkssport.ru;

    location / {
        proxy_pass http://localhost:1337;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name api.borkssport.ru;

    ssl_certificate /etc/letsencrypt/live/api.borkssport.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.borkssport.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:1337;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активация:
```bash
ln -s /etc/nginx/sites-available/borkssport-api /etc/nginx/sites-enabled/
```

### 5.3 Проверка и перезапуск Nginx
```bash
nginx -t
systemctl reload nginx
```

## 6. Настройка DNS

### 6.1 DNS записи у регистратора домена
- `borkssport.ru` → A-запись → `185.251.88.214`
- `www.borkssport.ru` → A-запись → `185.251.88.214`
- `api.borkssport.ru` → A-запись → `185.251.88.214`

Проверка:
```bash
dig borkssport.ru +short
dig www.borkssport.ru +short
dig api.borkssport.ru +short
```

## 7. SSL сертификаты (Let's Encrypt)

### 7.1 Получение сертификата для API
```bash
certbot --nginx -d api.borkssport.ru
```

### 7.2 Получение сертификата для основного домена
**Важно:** Из-за лимитов Let's Encrypt (5 неудачных попыток в час) использовался standalone режим:

```bash
systemctl stop nginx
certbot certonly --standalone -d borkssport.ru -d www.borkssport.ru
systemctl start nginx
```

**Примечание:** На момент развертывания основной домен работает по HTTP. SSL сертификат можно получить позже через DNS challenge или после истечения лимита.

## 8. Проверка работы

### 8.1 Проверка контейнеров
```bash
docker ps
```

Должны быть запущены:
- `sportmagazine-frontend` (порт 3000)
- `sportmagazine_strapi` (порт 1337)
- `sportmagazine_postgres` (порт 5432)

### 8.2 Проверка доступности
```bash
# Frontend
curl http://borkssport.ru
curl http://localhost:3000

# Backend
curl http://api.borkssport.ru
curl http://api.borkssport.ru/api
curl http://localhost:1337
curl http://localhost:1337/api
```

### 8.3 Проверка CORS
```bash
curl -H "Origin: http://borkssport.ru" -I http://api.borkssport.ru/api/products/popular
```

Должен вернуть заголовок `Access-Control-Allow-Origin: http://borkssport.ru`

## 9. Типичные проблемы и решения

### 9.1 Ошибка 502 Bad Gateway
**Причина:** Nginx не может подключиться к backend/frontend.

**Решение:**
1. Проверить, что контейнеры запущены: `docker ps`
2. Проверить проброс портов в docker-compose.yml
3. Проверить логи: `docker logs sportmagazine_strapi`
4. Проверить логи Nginx: `tail -f /var/log/nginx/error.log`

### 9.2 CORS ошибки
**Причина:** Backend не разрешает запросы с frontend домена.

**Решение:**
1. Проверить `CORS_ORIGIN` в `.env` backend
2. Проверить `CORS_ORIGIN` в `docker-compose.yml` backend (секция environment)
3. Перезапустить backend: `docker-compose restart`

### 9.3 Frontend обращается к localhost вместо домена
**Причина:** Переменные окружения не применились при сборке.

**Решение:**
1. Проверить `.env` файл frontend
2. Проверить `docker-compose.yml` (build args и environment)
3. Пересобрать frontend: `docker-compose build --no-cache`

### 9.4 Ошибка "Connection refused" в Nginx
**Причина:** Backend не слушает на нужном интерфейсе или порт не проброшен.

**Решение:**
1. Проверить `HOST=0.0.0.0` в .env backend
2. Проверить проброс портов в docker-compose.yml
3. Проверить доступность: `curl http://localhost:1337`

## 10. Команды для управления

### 10.1 Backend
```bash
cd ~/sportmagazine/backendStrapi

# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Логи
docker logs sportmagazine_strapi --tail 50 -f

# Пересборка
docker-compose build --no-cache
docker-compose up -d
```

### 10.2 Frontend
```bash
cd ~/sportmagazine/frontend

# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Логи
docker logs sportmagazine-frontend --tail 50 -f

# Пересборка
docker-compose build --no-cache
docker-compose up -d
```

### 10.3 Nginx
```bash
# Проверка конфигурации
nginx -t

# Перезагрузка
systemctl reload nginx

# Перезапуск
systemctl restart nginx

# Логи
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## 11. Важные замечания

1. **Переменные окружения:** В `.env` файлах используется формат `KEY=value` (без двоеточия).

2. **CORS:** Должен быть настроен и в `.env`, и в `docker-compose.yml` (секция environment).

3. **Next.js переменные:** Переменные с префиксом `NEXT_PUBLIC_` должны быть доступны на этапе сборки (build args).

4. **Порты:** Backend должен пробрасывать порт 1337, frontend - порт 3000.

5. **Docker сети:** Backend и frontend в разных Docker сетях, поэтому используют `localhost` для связи через Nginx.

6. **SSL:** На момент развертывания только API имеет SSL сертификат. Основной домен работает по HTTP.

## 12. Обновление проекта

### 12.1 Обновление кода
1. Загрузить новые файлы на сервер (через SCP или Git)
2. Пересобрать соответствующий контейнер
3. Перезапустить контейнер

### 12.2 Обновление переменных окружения
1. Отредактировать `.env` файл
2. Обновить `docker-compose.yml` если нужно
3. Перезапустить контейнер (для runtime переменных) или пересобрать (для build-time переменных)

## 13. Контакты и доступы

- **Сервер:** `185.251.88.214`
- **Домен:** `borkssport.ru`
- **API:** `api.borkssport.ru`
- **SSH:** `root@185.251.88.214`

---

**Дата развертывания:** 11 декабря 2025
**Версия документации:** 1.0

