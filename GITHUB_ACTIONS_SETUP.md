# Документация по настройке GitHub Actions CI/CD

## Обзор

Этот документ описывает пошаговую настройку автоматического развертывания проекта SportMagazine через GitHub Actions. При каждом push в ветку `main` будет автоматически происходить развертывание изменений на сервер.

## Архитектура

```
GitHub Push (main)
  ↓
GitHub Actions (проверка изменений)
  ↓
  ├─→ Изменения в frontend/ → Deploy Frontend
  └─→ Изменения в backendStrapi/ → Deploy Backend
  ↓
SSH подключение к серверу (185.251.88.214)
  ↓
Git Pull → Docker Build → Docker Restart
  ↓
Health Check
```

## Предварительные требования

- Репозиторий на GitHub
- Доступ к серверу по SSH
- Docker и Docker Compose установлены на сервере
- Git настроен на сервере

## Этап 1: Подготовка сервера

### 1.1 Создание SSH ключа для GitHub Actions

**На сервере выполните:**

```bash
# Создать директорию для ключей (если нет)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Сгенерировать SSH ключ
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""

# Добавить публичный ключ в authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Показать приватный ключ (нужен для GitHub Secrets)
cat ~/.ssh/github_actions
```

**Важно:** Скопируйте содержимое приватного ключа (`~/.ssh/github_actions`) - он понадобится для настройки GitHub Secrets.

### 1.2 Настройка доступа к Docker без sudo

**На сервере выполните:**

```bash
# Добавить пользователя в группу docker (если используете не root)
# sudo usermod -aG docker $USER

# Для root пользователя проверьте, что docker доступен
docker ps

# Проверьте, что docker-compose доступен
docker-compose --version
```

### 1.3 Настройка Git на сервере

**Проверьте, что Git настроен:**

```bash
# Проверьте версию Git
git --version

# Настройте Git (если еще не настроен)
git config --global user.name "Deploy Bot"
git config --global user.email "deploy@borkssport.ru"

# Проверьте доступ к репозиторию
cd ~/sportmagazine
git remote -v

# Если репозиторий еще не клонирован, клонируйте:
# git clone https://github.com/Mayraiden/FullStackMagazine.git .
# или через SSH:
# git clone git@github.com:Mayraiden/FullStackMagazine.git .
```

**Если репозиторий приватный, настройте SSH ключ для Git:**

```bash
# Создайте отдельный SSH ключ для Git (или используйте существующий)
ssh-keygen -t ed25519 -C "git-deploy" -f ~/.ssh/git_deploy -N ""

# Добавьте публичный ключ в GitHub (Settings → SSH and GPG keys)
cat ~/.ssh/git_deploy.pub

# Настройте SSH config для GitHub
nano ~/.ssh/config
```

Добавьте в `~/.ssh/config`:

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/git_deploy
    IdentitiesOnly yes
```

### 1.4 Проверка структуры проекта на сервере

**Убедитесь, что структура правильная:**

```bash
cd ~/sportmagazine
ls -la

# Должны быть папки:
# - frontend/
# - backendStrapi/
```

**Проверьте, что .env файлы на месте и не будут перезаписаны:**

```bash
# Frontend .env
ls -la ~/sportmagazine/frontend/.env

# Backend .env
ls -la ~/sportmagazine/backendStrapi/.env
```

**Важно:** Убедитесь, что `.env` файлы не отслеживаются Git (должны быть в `.gitignore`).

## Этап 2: Настройка GitHub Secrets

### 2.1 Доступ к настройкам репозитория

1. Откройте репозиторий на GitHub: `https://github.com/Mayraiden/FullStackMagazine`
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**

### 2.2 Добавление секретов

Добавьте следующие секреты:

#### `SERVER_HOST`

- **Name:** `SERVER_HOST`
- **Value:** `185.251.88.214`
- **Описание:** IP адрес сервера для развертывания

#### `SERVER_USER`

- **Name:** `SERVER_USER`
- **Value:** `root`
- **Описание:** Пользователь для SSH подключения

#### `SSH_PRIVATE_KEY`

- **Name:** `SSH_PRIVATE_KEY`
- **Value:** Содержимое файла `~/.ssh/github_actions` с сервера (весь ключ, включая `-----BEGIN OPENSSH PRIVATE KEY-----` и `-----END OPENSSH PRIVATE KEY-----`)
- **Описание:** Приватный SSH ключ для подключения к серверу

#### `SSH_KNOWN_HOSTS` (опционально, но рекомендуется)

- **Name:** `SSH_KNOWN_HOSTS`
- **Value:** Результат команды `ssh-keyscan 185.251.88.214` (выполнить на локальной машине)
- **Описание:** Известные хосты для безопасности SSH

**Как получить SSH_KNOWN_HOSTS:**

```bash
# На вашем локальном компьютере
ssh-keyscan 185.251.88.214
```

Скопируйте весь вывод и добавьте как секрет.

## Этап 3: Создание workflow файлов

### 3.1 Структура папок

Создайте следующую структуру в репозитории:

```
.github/
└── workflows/
    ├── deploy-frontend.yml
    └── deploy-backend.yml
```

### 3.2 Workflow для Frontend

**Файл:** `.github/workflows/deploy-frontend.yml`

**Логика:**

- Триггер: push в `main` с изменениями в `frontend/**`
- Ручной запуск через GitHub UI
- Подключение к серверу по SSH
- Git pull в папку frontend
- Пересборка и перезапуск Docker контейнера
- Проверка здоровья приложения

**Основные шаги:**

1. Checkout кода
2. Setup SSH connection
3. Подключение к серверу
4. Выполнение команд деплоя:
   - `cd ~/sportmagazine/frontend`
   - `git pull origin main`
   - `docker-compose down`
   - `docker-compose build --no-cache`
   - `docker-compose up -d`
   - Проверка логов
   - Health check

### 3.3 Workflow для Backend

**Файл:** `.github/workflows/deploy-backend.yml`

**Логика:**

- Триггер: push в `main` с изменениями в `backendStrapi/**`
- Ручной запуск через GitHub UI
- Подключение к серверу по SSH
- Git pull в папку backendStrapi
- Пересборка и перезапуск Docker контейнера
- Проверка здоровья API

**Основные шаги:**

1. Checkout кода
2. Setup SSH connection
3. Подключение к серверу
4. Выполнение команд деплоя:
   - `cd ~/sportmagazine/backendStrapi`
   - `git pull origin main`
   - `docker-compose down`
   - `docker-compose build --no-cache`
   - `docker-compose up -d`
   - Проверка логов
   - Health check: `curl http://localhost:1337/api`

## Этап 4: Детали реализации workflow

### 4.1 Общие настройки для обоих workflow

- **Использование SSH action:** `appleboy/ssh-action@v1.0.0` или встроенный SSH
- **Таймауты:** 10 минут на job, 5 минут на SSH команды
- **Уведомления:** Автоматические в GitHub (можно добавить Telegram/Discord webhook)

### 4.2 Особенности Frontend workflow

- **Условие запуска:** `paths: ['frontend/**']`
- **Переменные окружения:** Используются из `.env` файла на сервере
- **Build args:** `NEXT_PUBLIC_STRAPI_URL` передается при сборке
- **Health check:** Проверка доступности `http://localhost:3000`

### 4.3 Особенности Backend workflow

- **Условие запуска:** `paths: ['backendStrapi/**']`
- **Переменные окружения:** Используются из `.env` файла на сервере
- **База данных:** PostgreSQL контейнер должен оставаться запущенным
- **Health check:** Проверка доступности `http://localhost:1337/api`

### 4.4 Обработка ошибок

- При ошибке SSH подключения - уведомление и остановка
- При ошибке git pull - уведомление и остановка
- При ошибке Docker build - уведомление и остановка
- При ошибке health check - уведомление, но не откат (требует ручного вмешательства)

## Этап 5: Тестирование

### 5.1 Тестирование на тестовой ветке

1. Создать тестовую ветку: `git checkout -b test-deployment`
2. Внести небольшое изменение в frontend или backend
3. Закоммитить и запушить: `git push origin test-deployment`
4. Создать Pull Request в main
5. После merge проверить выполнение workflow в GitHub Actions

### 5.2 Проверка workflow

**В GitHub:**

1. Откройте вкладку **Actions** в репозитории
2. Найдите выполненный workflow
3. Проверьте логи каждого шага
4. Убедитесь, что все шаги выполнены успешно

**На сервере:**

1. Проверьте логи контейнеров: `docker logs sportmagazine-frontend --tail 50`
2. Проверьте, что изменения применились
3. Проверьте доступность приложения в браузере

### 5.3 Тестирование ручного запуска

1. В GitHub Actions выберите workflow
2. Нажмите **Run workflow**
3. Выберите ветку (main)
4. Нажмите **Run workflow**
5. Проверьте выполнение

## Этап 6: Безопасность

### 6.1 Защита секретов

- ✅ Секреты хранятся в GitHub Secrets (зашифрованы)
- ✅ SSH ключи не коммитятся в репозиторий
- ✅ .env файлы не коммитятся в репозиторий

### 6.2 Ограничение доступа

- Workflow запускается только при push в `main` (или по ручному запуску)
- Можно добавить проверку подписи коммитов (опционально)
- Можно ограничить запуск только для определенных пользователей (опционально)

### 6.3 Мониторинг

- Все логи доступны в GitHub Actions
- Можно добавить уведомления в Telegram/Discord (опционально)
- Можно настроить мониторинг здоровья приложения (опционально)

## Этап 7: Оптимизация (будущее)

### 7.1 Кэширование Docker слоев

- Использовать Docker layer caching для ускорения сборки
- Настроить cache для node_modules

### 7.2 Blue-Green Deployment

- Развертывание в параллельный контейнер
- Переключение трафика после проверки
- Откат при ошибках

### 7.3 Автоматическое тестирование

- Запуск тестов перед деплоем
- Проверка типов TypeScript
- Линтинг кода

## Команды для проверки на сервере

После настройки можно проверить вручную:

```bash
# Проверка SSH ключа
ssh -i ~/.ssh/github_actions root@185.251.88.214 "echo 'SSH works'"

# Проверка Git
cd ~/sportmagazine/frontend && git pull origin main

# Проверка Docker
cd ~/sportmagazine/frontend && docker-compose ps
```

## Устранение проблем

### Проблема: SSH подключение не работает

**Решение:**

1. Проверьте SSH ключ в GitHub Secrets
2. Проверьте права доступа: `chmod 600 ~/.ssh/github_actions`
3. Проверьте SSH config на сервере
4. Проверьте firewall правила

### Проблема: Git pull требует пароль

**Решение:**

1. Настройте SSH ключ для Git
2. Или используйте Personal Access Token
3. Или используйте HTTPS с токеном

### Проблема: Docker команды не выполняются

**Решение:**

1. Проверьте, что пользователь в группе docker
2. Проверьте права доступа к Docker socket
3. Проверьте, что docker-compose доступен

### Проблема: .env файлы перезаписываются

**Решение:**

1. Убедитесь, что .env в .gitignore
2. Используйте `git pull --no-ff` или настройте git config
3. Добавьте проверку существования .env перед pull

## Чек-лист перед запуском

- [ ] SSH ключ создан на сервере
- [ ] SSH ключ добавлен в GitHub Secrets
- [ ] Git настроен на сервере
- [ ] Доступ к репозиторию работает (git pull)
- [ ] Docker доступен без sudo
- [ ] Workflow файлы созданы
- [ ] Тестирование на тестовой ветке пройдено
- [ ] Документация обновлена

## Следующие шаги после настройки

1. Протестировать на тестовой ветке
2. Сделать первый автоматический деплой
3. Настроить уведомления (опционально)
4. Добавить мониторинг (опционально)

---

**Дата создания:** 11 декабря 2025
**Версия:** 1.0
**Статус:** Готов к реализации
