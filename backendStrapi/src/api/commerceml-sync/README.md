# CommerceML Sync Module

Модуль для интеграции с СБИС через протокол CommerceML.

## Описание

Этот модуль принимает XML данные от Saby (СБИС) в формате CommerceML и синхронизирует товары в Strapi.

## Переменные окружения

Добавьте следующие переменные в ваш `.env` файл:

```env
# Basic Auth credentials для CommerceML эндпоинтов
COMMERCEML_BASIC_AUTH_USER=your_username
COMMERCEML_BASIC_AUTH_PASSWORD=your_password

# Логирование входящих XML файлов (для анализа)
# Установите в 'true' для сохранения всех входящих XML в logs/commerceml-sync/
COMMERCEML_LOG_REQUESTS=false
```

## Эндпоинты

### POST /api/commerceml-sync/catalog
Принимает catalog.xml от Saby. Обрабатывает товары и категории.

**Headers:**
- `Authorization: Basic <base64(username:password)>`
- `Content-Type: text/xml` или `application/xml`

**Body:** XML строка с каталогом товаров

### POST /api/commerceml-sync/offers
Принимает offers.xml от Saby. Обновляет цены товаров.

**Headers:**
- `Authorization: Basic <base64(username:password)>`
- `Content-Type: text/xml` или `application/xml`

**Body:** XML строка с предложениями (ценами)

### POST /api/commerceml-sync/rests
Принимает rests.xml от Saby. Обновляет остатки товаров (пока не реализовано).

**Headers:**
- `Authorization: Basic <base64(username:password)>`
- `Content-Type: text/xml` или `application/xml`

**Body:** XML строка с остатками

### GET /api/commerceml-sync/test
Тестовый эндпоинт для проверки подключения.

**Response:**
```json
{
  "success": true,
  "message": "CommerceML sync service is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "config": {
    "basicAuthConfigured": true,
    "logRequests": false
  }
}
```

### POST /api/commerceml-sync/upload
Ручная загрузка XML для тестирования.

**Headers:**
- `Authorization: Basic <base64(username:password)>`
- `Content-Type: application/json`

**Body:**
```json
{
  "type": "catalog",
  "xml": "<xml>...</xml>"
}
```

## Настройка в Saby

1. Откройте «Настройки/Интеграции» в Saby
2. Выберите «CommerceML»
3. Укажите адрес сервера: `https://your-domain.com/api/commerceml-sync/catalog`
4. Укажите логин и пароль (соответствуют `COMMERCEML_BASIC_AUTH_USER` и `COMMERCEML_BASIC_AUTH_PASSWORD`)
5. Включите «Выгружать на сайт» для синхронизации товаров
6. Настройте расписание автоматического обмена (опционально)

## Структура модуля

- `controllers/` - HTTP контроллеры для обработки запросов
- `services/` - Бизнес-логика:
  - `commerceml-sync.ts` - Основной сервис синхронизации
  - `xml-parser.ts` - Парсинг XML в JSON
  - `product-sync.ts` - Синхронизация товаров в БД
- `utils/` - Утилиты:
  - `auth-middleware.ts` - Проверка Basic Auth
  - `commerceml-mapper.ts` - Маппинг CommerceML → Strapi Product
- `routes/` - Определение роутов

## Маппинг полей

CommerceML → Strapi Product:
- `Ид` → `sbisExternalId` (для upsert)
- `Наименование` → `name`
- `Описание` → `description`
- `Артикул` → `article`
- `Цены/Цена` → `price`
- `Группы/Группа` → `category` (связь)
- `Характеристики` → `size`, `color`, `length`, `width`, `height`, `weight`
- `Картинки` → `images`

## Логирование

Если `COMMERCEML_LOG_REQUESTS=true`, все входящие XML файлы сохраняются в:
`logs/commerceml-sync/{type}-{timestamp}.xml`

Это полезно для анализа структуры данных от Saby.

## Примечания

- Текущая API интеграция (`sbis-sync`) остается без изменений
- Используется `sbisExternalId` для upsert операций
- Только товары синхронизируются, заказы не обрабатываются
