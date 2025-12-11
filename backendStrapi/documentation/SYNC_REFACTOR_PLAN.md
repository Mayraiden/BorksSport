# План переработки синхронизации товаров из СБИС

## Цель
Исправить логику синхронизации для корректной обработки всех товаров без дубликатов и с правильной статистикой.

## Текущие проблемы
1. ❌ Неправильное использование `position` (используется `categoryId` вместо `hierarchicalId` последнего элемента)
2. ❌ Отсутствие обработки пагинации через `outcome.hasMore`
3. ❌ Дублирование товаров при рекурсивном обходе
4. ❌ Неправильная статистика (считаются дубликаты)
5. ❌ `pageSize` = 100 вместо максимальных 1000

## План работы

### Этап 1: Очистка данных
**Действие**: Очистить все товары и категории из Strapi
- **Endpoint**: `POST /api/sbis-sync/clear-all`
- **Ожидаемый результат**: 0 товаров, 0 категорий в БД
- **Время**: ~1 минута

### Этап 2: Переработка логики получения данных

#### 2.1. Упрощение подхода
**Решение**: Отказаться от рекурсивного обхода категорий, использовать простой обход всех товаров с правильной пагинацией.

**Причины**:
- Проще и надежнее
- Меньше дубликатов
- Легче отлаживать
- API СБИС возвращает все товары при запросе без `position`

#### 2.2. Новая функция получения всех товаров
**Файл**: `src/api/product/controllers/product.ts`

**Новая логика**:
```typescript
async fetchAllProductsWithPagination(accessToken: string) {
    const allItems: any[] = []
    let position: number | null = null
    let hasMore = true
    let pageCount = 0
    const maxPages = 100 // Защита от бесконечного цикла
    
    while (hasMore && pageCount < maxPages) {
        const params: any = {
            pointID: config.pointId,
            priceListId: config.priceListId,
            pageSize: 1000, // Максимум по документации
            withBalance: true,
            withBarcode: true,
        }
        
        // Добавляем position только если это не первая страница
        if (position !== null) {
            params.position = position
            params.order = 'after'
        }
        
        const response = await axios.get(`${config.apiUrl}/nomenclature/list`, {
            params,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: config.timeout,
        })
        
        const { nomenclatures, outcome } = response.data
        
        if (!Array.isArray(nomenclatures) || nomenclatures.length === 0) {
            break
        }
        
        allItems.push(...nomenclatures)
        pageCount++
        
        // Проверяем, есть ли еще страницы
        hasMore = outcome?.hasMore === true
        
        // Если есть еще страницы, берем hierarchicalId последнего элемента
        if (hasMore && nomenclatures.length > 0) {
            const lastItem = nomenclatures[nomenclatures.length - 1]
            position = lastItem.hierarchicalId
            strapi.log.info(`Page ${pageCount}: Got ${nomenclatures.length} items, hasMore: ${hasMore}, next position: ${position}`)
        } else {
            strapi.log.info(`Page ${pageCount}: Got ${nomenclatures.length} items, no more pages`)
            break
        }
    }
    
    return allItems
}
```

#### 2.3. Обработка категорий и товаров
**Логика**:
1. Получаем все элементы через пагинацию
2. Разделяем на категории (`isParent === true`) и товары (`isParent === false && id !== null`)
3. Строим иерархию категорий
4. Дедуплицируем товары по `sbisId`

**Код**:
```typescript
// Разделяем на категории и товары
const categories = allItems.filter(item => item.isParent === true)
const products = allItems.filter(item => !item.isParent && item.id !== null)

// Дедупликация товаров по sbisId
const uniqueProducts = new Map<number, any>()
products.forEach(product => {
    if (product.id && !uniqueProducts.has(product.id)) {
        uniqueProducts.set(product.id, product)
    } else if (product.id && uniqueProducts.has(product.id)) {
        // Логируем дубликат для анализа
        strapi.log.warn(`Duplicate product found: ID ${product.id}, name: ${product.name}`)
    }
})

const uniqueProductsArray = Array.from(uniqueProducts.values())
```

#### 2.4. Создание категорий
**Логика**: Остается прежней, но упрощается:
- Создаем все категории без связей (первый проход)
- Устанавливаем связи parent (второй проход)
- Сохраняем `categoryMap` для привязки товаров

#### 2.5. Сохранение товаров с дедупликацией
**Изменения**:
- Используем только уникальные товары из `uniqueProductsArray`
- Правильная статистика: считаем только уникальные товары
- Логирование реального количества

### Этап 3: Обновление функции `syncFromSbis`

**Файл**: `src/api/product/controllers/product.ts`
**Метод**: `syncFromSbis` (строки ~222-590)

**Изменения**:
1. Заменить рекурсивную функцию `getAllProductsRecursively` на `fetchAllProductsWithPagination`
2. Добавить дедупликацию товаров
3. Исправить статистику
4. Улучшить логирование

### Этап 4: Тестирование

#### 4.1. Проверка получения данных
- Проверить, что получаем все товары (должно быть ~2400)
- Проверить, что нет дубликатов в массиве `uniqueProductsArray`
- Проверить логи пагинации

#### 4.2. Проверка сохранения
- Проверить количество сохраненных товаров (должно быть ~2400)
- Проверить количество категорий
- Проверить статистику (saved + updated должно быть ~2400, а не 10000+)

#### 4.3. Проверка данных
- Проверить несколько товаров в БД
- Проверить привязку к категориям
- Проверить поля `size` и `color`

## Файлы для изменения

1. **`src/api/product/controllers/product.ts`**
   - Метод `syncFromSbis` (полная переработка)
   - Удалить рекурсивную функцию `getAllProductsRecursively`
   - Добавить функцию `fetchAllProductsWithPagination`
   - Добавить дедупликацию
   - Исправить статистику

## Риски и меры предосторожности

### Риски:
1. **Потеря данных**: Если что-то пойдет не так, данные будут очищены
   - **Мера**: Сделать бэкап БД перед очисткой (опционально)
   
2. **Превышение лимитов API**: Слишком много запросов
   - **Мера**: Использовать `pageSize: 1000` для минимизации запросов
   - **Мера**: Добавить задержки между запросами при необходимости

3. **Бесконечный цикл**: Если `outcome.hasMore` всегда `true`
   - **Мера**: Ограничение `maxPages = 100`

4. **Таймауты**: Долгая синхронизация
   - **Мера**: Увеличить `timeout` если нужно
   - **Мера**: Логировать прогресс

### Откат:
- Если что-то пойдет не так, можно вернуться к предыдущей версии через git
- Данные можно восстановить через повторную синхронизацию из СБИС

## Ожидаемые результаты

### После исправления:
- ✅ Получаем все товары из СБИС (~2400)
- ✅ Нет дубликатов в обработке
- ✅ Правильная статистика: `saved + updated ≈ 2400`
- ✅ Все товары привязаны к категориям
- ✅ Поля `size` и `color` заполнены из атрибутов

### Метрики успеха:
- Количество обработанных товаров ≈ количество товаров в СБИС
- `saved + updated` ≈ количество уникальных товаров
- Нет предупреждений о дубликатах в логах (или минимальное количество)

## Порядок выполнения

1. ✅ Очистить коллекции (`POST /api/sbis-sync/clear-all`)
2. ✅ Переработать код синхронизации
3. ✅ Запустить синхронизацию (`POST /api/products/sync-from-sbis`)
4. ✅ Проверить результаты
5. ✅ Сравнить с ожидаемыми значениями

## Время выполнения

- Очистка: ~1 минута
- Переработка кода: ~30-60 минут
- Синхронизация: ~5-10 минут (зависит от количества товаров)
- Проверка: ~5 минут

**Итого**: ~1-1.5 часа

## Вопросы для апрува

1. ✅ Подтверждаете очистку всех товаров и категорий?
2. ✅ Подтверждаете отказ от рекурсивного обхода в пользу простой пагинации?
3. ✅ Нужен ли бэкап БД перед очисткой?
4. ✅ Готовы к тестированию на реальных данных?

---

**Статус**: ⏳ Ожидает апрува

