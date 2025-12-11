# Документация модулей бэкенд приложения

## Общая информация

**Технологический стек:**
- Strapi 5.25.0 (Headless CMS)
- Node.js 18-22
- TypeScript 5
- SQLite (better-sqlite3) - база данных по умолчанию
- Axios - для HTTP запросов к внешним API

**Архитектура:** Strapi API (REST API) с кастомными сервисами и контроллерами

**Интеграции:**
- **СБИС** - синхронизация товаров и статистики продаж
- **СДЭК** - доставка (расчет стоимости, создание заказов, отслеживание)
- **Точка банк** - платежная система

---

## Структура проекта

```
src/
├── api/              # API модули (Content Types)
│   ├── address/      # Адреса доставки
│   ├── cart-item/    # Элементы корзины
│   ├── category/     # Категории товаров
│   ├── cdek-sync/    # Интеграция с СДЭК
│   ├── favorite/     # Избранные товары
│   ├── maintenance/  # Техническое обслуживание
│   ├── order/        # Заказы
│   ├── payment/      # Платежи
│   ├── product/      # Товары
│   ├── sbis-sync/    # Интеграция с СБИС
│   └── user/         # Расширение пользователей
├── admin/            # Кастомные компоненты админ-панели
├── bootstrap/        # Инициализация приложения
├── components/       # Переиспользуемые компоненты
├── extensions/       # Расширения плагинов
├── policies/        # Политики доступа
└── scripts/          # Скрипты для синхронизации
```

---

## 1. Модуль: Товары (Product)

### Описание
Управление товарами: CRUD операции, фильтрация, поиск, интеграция с Meilisearch.

### Структура
```
api/product/
├── content-types/
│   └── product/
│       └── schema.json        # Схема данных товара
├── controllers/
│   └── product.ts            # Контроллеры API
├── routes/
│   └── product.ts            # Маршруты API
└── services/
    ├── product.ts            # Бизнес-логика
    └── sbis.js               # Интеграция с СБИС (legacy)
```

### Поля Content Type
- `name` - Название товара
- `description` - Описание
- `price` - Цена
- `article` - Артикул
- `unit` - Единица измерения
- `images` - Изображения (массив URL)
- `published` - Опубликован ли товар
- `sbisId` - ID товара в СБИС
- `sbisExternalId` - Внешний ID в СБИС
- `sbisNomNumber` - Номер номенклатуры СБИС
- `categoryName` - Название категории
- `rootCategoryName` - Корневая категория
- `lastSyncAt` - Дата последней синхронизации
- `sbisSalesCount` - Количество продаж (статистика)
- `sbisTotalQuantitySold` - Общее количество проданных единиц
- `sbisTotalRevenue` - Общая выручка
- `sbisLastSoldAt` - Дата последней продажи
- `sbisPopularityScore` - Оценка популярности

### API Endpoints
- `GET /api/products` - Список товаров (с фильтрами, пагинацией, поиском)
- `GET /api/products/:id` - Детали товара
- `POST /api/products` - Создать товар
- `PUT /api/products/:id` - Обновить товар
- `DELETE /api/products/:id` - Удалить товар
- `GET /api/products/popular` - Популярные товары
- `GET /api/products/new` - Новинки

### Особенности
- Поддержка Meilisearch для полнотекстового поиска (опционально)
- Фильтрация по категориям, брендам, цене
- Сортировка по различным полям
- Пагинация через `start` и `limit`

---

## 2. Модуль: Заказы (Order)

### Описание
Управление заказами: создание, просмотр, обновление статусов, интеграция с доставкой и оплатой.

### Структура
```
api/order/
├── content-types/
│   └── order/
│       └── schema.json        # Схема данных заказа
├── controllers/
│   └── order.ts               # Контроллеры API
├── routes/
│   └── order.ts               # Маршруты API
└── services/
    └── order.ts               # Бизнес-логика
```

### Поля Content Type
- `orderNumber` - Номер заказа
- `status` - Статус заказа (pending, awaiting_payment, paid, processing, shipped, delivered, cancelled)
- `totalAmount` - Общая сумма заказа
- `deliveryType` - Тип доставки (door, pvz, pickup)
- `cdekDeliveryCost` - Стоимость доставки СДЭК
- `cdekTariffCode` - Код тарифа СДЭК
- `cdekPvzCode` - Код ПВЗ СДЭК
- `cdekPvzAddress` - Адрес ПВЗ
- `cdekOrderUuid` - UUID заказа в СДЭК
- `cdekStatus` - Статус в СДЭК
- `paymentMethod` - Способ оплаты (online, cash, card)
- `paymentProvider` - Провайдер оплаты (tochka, sbp)
- `shippingAddress` - Адрес доставки (JSON)
- `customerData` - Данные клиента (JSON)
- `items` - Товары в заказе (JSON массив)
- `notes` - Примечания
- `user` - Связь с пользователем

### API Endpoints
- `GET /api/orders` - Список заказов пользователя
- `GET /api/orders/:id` - Детали заказа
- `POST /api/orders` - Создать заказ
- `PUT /api/orders/:id` - Обновить заказ

### Особенности
- Автоматическая генерация номера заказа
- Расчет общей суммы на основе товаров
- Интеграция с СДЭК для доставки
- Интеграция с Точка банк для оплаты

---

## 3. Модуль: Корзина (Cart Item)

### Описание
Управление корзиной покупок: добавление, удаление, изменение количества товаров.

### Структура
```
api/cart-item/
├── content-types/
│   └── cart-item/
│       └── schema.json        # Схема данных элемента корзины
├── controllers/
│   └── cart-item.ts          # Контроллеры API
├── routes/
│   └── cart-item.ts          # Маршруты API
└── services/
    └── cart-item.ts          # Бизнес-логика
```

### Поля Content Type
- `product` - Связь с товаром
- `quantity` - Количество
- `user` - Связь с пользователем

### API Endpoints
- `GET /api/cart-items` - Получить корзину пользователя
- `POST /api/cart-items` - Добавить товар в корзину
- `PUT /api/cart-items/:id` - Обновить количество
- `DELETE /api/cart-items/:id` - Удалить товар из корзины
- `DELETE /api/cart-items` - Очистить корзину

### Особенности
- Автоматическая привязка к пользователю через JWT токен
- Валидация наличия товара
- Автоматическое обновление количества при повторном добавлении

---

## 4. Модуль: Платежи (Payment)

### Описание
Управление платежами: создание платежных сессий, обработка webhook'ов, проверка статусов. Интеграция с Точка банк.

### Структура
```
api/payment/
├── content-types/
│   └── payment/
│       └── schema.json        # Схема данных платежа
├── controllers/
│   └── payment.ts            # Контроллеры API
├── routes/
│   └── payment.ts            # Маршруты API
└── services/
    ├── payment.ts            # Бизнес-логика
    └── tochka-pay.ts         # Интеграция с Точка банк
```

### Поля Content Type
- `order` - Связь с заказом
- `paymentId` - ID платежа (внешний)
- `amount` - Сумма платежа
- `currency` - Валюта (RUB)
- `status` - Статус (pending, paid, failed, refunded)
- `paymentMethod` - Способ оплаты
- `provider` - Провайдер (tochka)
- `paymentUrl` - URL для оплаты
- `sessionId` - ID сессии оплаты
- `externalId` - Внешний ID
- `expiresAt` - Срок действия платежной ссылки
- `paymentData` - Дополнительные данные (JSON)

### API Endpoints
- `GET /api/payments` - Список платежей (с фильтром по orderId)
- `POST /api/payments` - Создать платеж
- `PUT /api/payments/:id` - Обновить платеж
- `POST /api/payments/tochka/session` - Создать сессию оплаты Точка банк
- `GET /api/payments/tochka/:id/status` - Проверить статус платежа
- `POST /api/payments/tochka/webhook` - Webhook от Точка банк

### Интеграция: Точка банк

**Сервис:** `api::payment.tochka-pay`

**Функции:**
- `createPaymentSession(options)` - Создание платежной сессии
- `getPaymentStatus(invoiceId)` - Проверка статуса платежа
- `verifyWebhookSignature(payload, signature)` - Проверка подписи webhook
- `mapWebhookEvent(body)` - Парсинг события webhook

**Переменные окружения:**
- `TOCHKA_PAY_SANDBOX` - Режим песочницы (true/false)
- `TOCHKA_PAY_BASE_URL` - Базовый URL API
- `TOCHKA_PAY_API_KEY` - API ключ
- `TOCHKA_PAY_AUTH_TOKEN` - Токен авторизации
- `TOCHKA_PAY_SECRET_KEY` - Секретный ключ для подписи
- `TOCHKA_PAY_MERCHANT_ID` - ID мерчанта
- `TOCHKA_PAY_TERMINAL_ID` - ID терминала
- `TOCHKA_PAY_CUSTOMER_CODE` - Код клиента
- `TOCHKA_PAY_SUCCESS_URL` - URL успешной оплаты
- `TOCHKA_PAY_FAILURE_URL` - URL неудачной оплаты
- `TOCHKA_PAY_WEBHOOK_SECRET` - Секрет для проверки webhook
- `TOCHKA_PAY_USE_RECEIPT` - Использовать чек (true/false)

**Особенности:**
- Поддержка sandbox режима
- Автоматическая генерация подписей запросов
- Обработка webhook'ов с проверкой подписи
- Поддержка различных способов оплаты (СБП, карта, Тинькофф, Долями)

---

## 5. Модуль: Доставка СДЭК (CDEK Sync)

### Описание
Интеграция с API СДЭК: расчет стоимости доставки, поиск городов, список ПВЗ, создание заказов, отслеживание.

### Структура
```
api/cdek-sync/
├── controllers/
│   └── cdek-sync.ts          # Контроллеры API
├── routes/
│   └── cdek-sync.ts          # Маршруты API
└── services/
    └── cdek-sync.ts          # Интеграция с API СДЭК
```

### API Endpoints
- `GET /api/cdek-sync/test-auth` - Тест авторизации
- `GET /api/cdek-sync/cities?query=Москва` - Поиск городов
- `GET /api/cdek-sync/pvz-list?cityCode=270` - Список ПВЗ по коду города
- `POST /api/cdek-sync/calculate` - Расчет стоимости доставки
- `POST /api/cdek-sync/create-order` - Создание заказа в СДЭК
- `GET /api/cdek-sync/track/:trackNumber` - Отслеживание заказа
- `POST /api/cdek-sync/webhook` - Webhook от СДЭК

### Сервис: CDEK Sync

**Функции:**
- `getAccessToken()` - Получение OAuth токена (с кэшированием)
- `searchCities(query)` - Поиск городов по названию
- `getPvzList(cityCode)` - Получение списка ПВЗ
- `calculateDelivery(toLocation, packages, tariffCode?)` - Расчет стоимости
- `createOrder(orderData)` - Создание заказа в СДЭК
- `trackOrder(trackNumber)` - Отслеживание заказа

**Переменные окружения:**
- `CDEK_API_URL` - URL API СДЭК (по умолчанию: https://api.edu.cdek.ru/v2)
- `CDEK_CLIENT_ID` - Client ID для OAuth
- `CDEK_CLIENT_SECRET` - Client Secret для OAuth
- `CDEK_TEST_MODE` - Режим тестирования (true/false)

**Особенности:**
- Автоматическое кэширование OAuth токенов
- Автоматический поиск кода города по названию
- Поддержка различных тарифов доставки (139 - до двери, 138 - ПВЗ)
- Обработка webhook'ов для обновления статусов заказов

---

## 6. Модуль: Синхронизация СБИС (SBIS Sync)

### Описание
Интеграция с API СБИС: синхронизация товаров, категорий, статистики продаж.

### Структура
```
api/sbis-sync/
├── controllers/
│   ├── sbis-sync.ts          # Контроллеры API (TypeScript)
│   └── sbis-sync.js          # Контроллеры API (JavaScript, legacy)
├── routes/
│   ├── sbis-sync.ts          # Маршруты API (TypeScript)
│   └── sbis-sync.js          # Маршруты API (JavaScript, legacy)
└── services/
    └── sbis-sync.ts          # Интеграция с API СБИС
```

### API Endpoints
- `GET /api/sbis-sync/sync-products` - Синхронизация товаров
- `POST /api/sbis-sync/sync-products` - Синхронизация товаров
- `GET /api/sbis-sync/fetch-products` - Получить товары из СБИС (без сохранения)
- `GET /api/sbis-sync/test-auth` - Тест авторизации
- `GET /api/sbis-sync/status` - Статус синхронизации
- `GET /api/sbis-sync/sample-products` - Получить примеры товаров
- `GET /api/sbis-sync/test-sales` - Тест получения продаж
- `POST /api/sbis-sync/sync-sales-stats` - Синхронизация статистики продаж
- `GET /api/sbis-sync/sync-sales-stats` - Синхронизация статистики продаж
- `POST /api/sbis-sync/clear-all` - Очистить все товары и категории
- `GET /api/sbis-sync/analyze-price-list` - Анализ прайс-листа

### Сервис: SBIS Sync

**Функции:**
- `getAccessToken()` - Получение OAuth токена
- `fetchProducts(page, pageSize)` - Получение товаров с пагинацией
- `getAllProducts()` - Получение всех товаров
- `getSampleProducts(count, includeCategories)` - Получение примеров товаров
- `saveProducts(products)` - Сохранение товаров в Strapi
- `syncProducts()` - Полная синхронизация товаров
- `clearProducts()` - Очистка всех товаров
- `clearCategories()` - Очистка всех категорий
- `clearAll()` - Очистка всего
- `fetchSales(fromDate, toDate?, page, pageSize)` - Получение продаж
- `getAllSales(fromDate, toDate?)` - Получение всех продаж за период
- `syncSalesStatistics(days)` - Синхронизация статистики продаж

**Конфигурация:**
- `oauthUrl`: https://online.sbis.ru/oauth/service/
- `apiUrl`: https://api.sbis.ru/retail/v2
- `appClientId`: ID приложения СБИС
- `appSecret`: Секрет приложения
- `secretKey`: Секретный ключ
- `pointId`: ID точки продаж (201)
- `priceListId`: ID прайс-листа (24)

**Особенности:**
- Автоматическое обновление существующих товаров по `sbisId`
- Извлечение размеров и цветов из атрибутов товаров
- Синхронизация статистики продаж для расчета популярности
- Поддержка пагинации при загрузке больших объемов данных
- Анализ структуры товаров для выявления вариантов (цвета, размеры)

---

## 7. Модуль: Избранное (Favorite)

### Описание
Управление избранными товарами пользователей.

### Структура
```
api/favorite/
├── content-types/
│   └── favorite/
│       └── schema.json        # Схема данных избранного
├── controllers/
│   └── favorite.ts           # Контроллеры API
├── routes/
│   └── favorite.ts           # Маршруты API
└── services/
    └── favorite.ts           # Бизнес-логика
```

### Поля Content Type
- `product` - Связь с товаром
- `user` - Связь с пользователем

### API Endpoints
- `GET /api/favorites` - Список избранного пользователя
- `POST /api/favorites` - Добавить в избранное
- `POST /api/favorites/toggle` - Переключить избранное
- `GET /api/favorites/check/:productId` - Проверить статус
- `DELETE /api/favorites/:id` - Удалить из избранного

---

## 8. Модуль: Адреса (Address)

### Описание
Управление адресами доставки пользователей.

### Структура
```
api/address/
├── content-types/
│   └── address/
│       └── schema.json        # Схема данных адреса
├── controllers/
│   └── address.ts            # Контроллеры API
├── routes/
│   └── address.ts            # Маршруты API
└── services/
    └── address.ts            # Бизнес-логика
```

### Поля Content Type
- `user` - Связь с пользователем
- `type` - Тип адреса (home, work, other)
- `city` - Город
- `street` - Улица
- `house` - Дом
- `apartment` - Квартира
- `postalCode` - Почтовый индекс
- `isDefault` - Адрес по умолчанию

### API Endpoints
- `GET /api/addresses` - Список адресов пользователя
- `POST /api/addresses` - Создать адрес
- `PUT /api/addresses/:id` - Обновить адрес
- `DELETE /api/addresses/:id` - Удалить адрес

---

## 9. Модуль: Категории (Category)

### Описание
Управление категориями товаров.

### Структура
```
api/category/
├── content-types/
│   └── category/
│       └── schema.json        # Схема данных категории
├── controllers/
│   └── category.ts           # Контроллеры API
├── routes/
│   └── category.ts           # Маршруты API
└── services/
    └── category.ts           # Бизнес-логика
```

### Поля Content Type
- `name` - Название категории
- `slug` - URL-слаг
- `description` - Описание
- `parent` - Родительская категория
- `products` - Товары в категории

### API Endpoints
- `GET /api/categories` - Список категорий
- `GET /api/categories/:id` - Детали категории
- `POST /api/categories` - Создать категорию
- `PUT /api/categories/:id` - Обновить категорию
- `DELETE /api/categories/:id` - Удалить категорию

---

## 10. Модуль: Пользователи (User)

### Описание
Расширение функциональности пользователей Strapi.

### Структура
```
api/user/
├── controllers/
│   └── user.ts               # Контроллеры API
└── routes/
    └── user.ts               # Маршруты API

extensions/users-permissions/
└── content-types/
    └── user/
        └── schema.json       # Расширенная схема пользователя
```

### Расширенные поля пользователя
- `firstName` - Имя
- `lastName` - Фамилия
- `phone` - Телефон
- `addresses` - Адреса доставки
- `orders` - Заказы пользователя
- `cartItems` - Элементы корзины
- `favorites` - Избранные товары

### API Endpoints
- `GET /api/users/me` - Получить данные текущего пользователя
- `PUT /api/users/me` - Обновить данные пользователя
- `POST /api/auth/local/register` - Регистрация
- `POST /api/auth/local` - Вход

---

## 11. Модуль: Техническое обслуживание (Maintenance)

### Описание
Технические endpoints для обслуживания системы.

### Структура
```
api/maintenance/
├── controllers/
│   └── maintenance.ts        # Контроллеры API
└── routes/
    └── maintenance.ts        # Маршруты API
```

### API Endpoints
- Технические endpoints для проверки работоспособности системы

---

## Схема зависимостей модулей

```
Strapi Core
  ├── Users & Permissions (базовая авторизация)
  ├── Content Types (Product, Order, Cart, Payment, etc.)
  │   ├── Controllers (обработка запросов)
  │   ├── Services (бизнес-логика)
  │   └── Routes (маршрутизация)
  └── Custom Services (интеграции)
      ├── CDEK Sync (доставка)
      ├── Tochka Pay (платежи)
      └── SBIS Sync (синхронизация товаров)
```

---

## Переменные окружения

### Общие
- `HOST` - Хост сервера (по умолчанию: 0.0.0.0)
- `PORT` - Порт сервера (по умолчанию: 1337)
- `APP_KEYS` - Ключи приложения (для JWT)
- `API_TOKEN_SALT` - Соль для API токенов
- `ADMIN_JWT_SECRET` - Секрет для JWT админ-панели
- `JWT_SECRET` - Секрет для JWT пользователей
- `DATABASE_CLIENT` - Клиент БД (sqlite, postgres, mysql)
- `DATABASE_FILENAME` - Путь к файлу SQLite

### СДЭК
- `CDEK_API_URL` - URL API СДЭК
- `CDEK_CLIENT_ID` - Client ID
- `CDEK_CLIENT_SECRET` - Client Secret
- `CDEK_TEST_MODE` - Режим тестирования

### Точка банк
- `TOCHKA_PAY_SANDBOX` - Режим песочницы
- `TOCHKA_PAY_BASE_URL` - Базовый URL API
- `TOCHKA_PAY_API_KEY` - API ключ
- `TOCHKA_PAY_AUTH_TOKEN` - Токен авторизации
- `TOCHKA_PAY_SECRET_KEY` - Секретный ключ
- `TOCHKA_PAY_MERCHANT_ID` - ID мерчанта
- `TOCHKA_PAY_TERMINAL_ID` - ID терминала
- `TOCHKA_PAY_CUSTOMER_CODE` - Код клиента
- `TOCHKA_PAY_SUCCESS_URL` - URL успешной оплаты
- `TOCHKA_PAY_FAILURE_URL` - URL неудачной оплаты
- `TOCHKA_PAY_WEBHOOK_SECRET` - Секрет для webhook
- `TOCHKA_PAY_USE_RECEIPT` - Использовать чек

### СБИС
Конфигурация СБИС находится в коде сервиса (можно вынести в переменные окружения):
- `SBIS_APP_CLIENT_ID`
- `SBIS_APP_SECRET`
- `SBIS_SECRET_KEY`
- `SBIS_POINT_ID`
- `SBIS_PRICE_LIST_ID`

### Frontend
- `FRONTEND_URL` - URL фронтенд приложения
- `NEXT_PUBLIC_APP_URL` - URL Next.js приложения

---

## Формат ответов API

Все API endpoints возвращают единый формат:

**Успешный ответ:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // опционально
}
```

**Ошибка:**
```json
{
  "success": false,
  "message": "Описание ошибки",
  "error": "Детали ошибки"
}
```

---

## Авторизация

Большинство endpoints требуют JWT токен в заголовке:
```
Authorization: Bearer <token>
```

Токен получается через:
- `POST /api/auth/local` - Вход
- `POST /api/auth/local/register` - Регистрация

---

## Особенности реализации

### 1. Синхронизация товаров из СБИС
- Автоматическое обновление существующих товаров
- Извлечение изображений из параметров СБИС
- Сохранение статистики продаж для расчета популярности

### 2. Интеграция с СДЭК
- Кэширование OAuth токенов
- Автоматический поиск кода города
- Поддержка различных тарифов доставки

### 3. Интеграция с Точка банк
- Поддержка sandbox режима
- Автоматическая генерация подписей
- Обработка webhook'ов с проверкой подписи

### 4. Поиск товаров
- Поддержка Meilisearch (опционально)
- Fallback на стандартный поиск Strapi
- Фильтрация по множественным значениям

---

## Админ-панель

Кастомные компоненты в `src/admin/`:
- `ClearCollectionButton` - Очистка коллекции
- `ClearProductsButton` - Очистка товаров
- `SyncProductsButton` - Синхронизация товаров

Доступ: `http://localhost:1337/admin`

---

## Скрипты

### Синхронизация товаров
```bash
# Через API
GET /api/sbis-sync/sync-products

# Или через скрипт
node src/scripts/sync-products.js
```

---

## Примечания

- Все интеграции используют axios для HTTP запросов
- Ошибки логируются через `strapi.log`
- Поддержка TypeScript и JavaScript (legacy код)
- База данных по умолчанию: SQLite (можно переключить на PostgreSQL/MySQL)

