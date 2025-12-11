# Анализ проблем синхронизации товаров из СБИС

## Проблема
- **Ожидалось**: ~2400 товаров
- **Получено**: 10222 обработано (1731 сохранено + 8491 обновлено)
- **Вывод**: Товары обрабатываются несколько раз, что приводит к неправильной статистике

## Критические проблемы в коде

### 1. ❌ Неправильное использование параметра `position`

**Текущая логика** (строки 309-312):
```typescript
if (categoryId) {
    params.position = categoryId
    params.order = 'after'
}
```

**Проблема**: 
- `position` должен быть **иерархическим идентификатором последней записи** из предыдущей страницы, а не ID категории
- Используя `categoryId` как `position`, мы получаем непредсказуемые результаты

**По документации СБИС**:
> `position` - Иерархический идентификатор последней записи из предыдущей страницы. При получении первой страницы параметр не указывается

### 2. ❌ Отсутствие пагинации внутри категории

**Текущая логика**:
- Делается **один запрос** на категорию с `pageSize: 100`
- Не проверяется `outcome.hasMore` из ответа API
- Нет цикла по страницам внутри категории

**Проблема**:
- Если в категории больше 100 товаров, обрабатываются только первые 100
- Остальные товары теряются

**По документации СБИС**:
> `outcome` - Флаг наличия записей на следующих страницах (boolean)
> `pageSize` - Максимальное возможное значение — 1000

### 3. ❌ Дублирование товаров при рекурсивном обходе

**Текущая логика**:
- При запросе родительской категории API может возвращать товары из всех подкатегорий
- Затем при рекурсивном обходе дочерних категорий те же товары возвращаются снова
- Товары добавляются в `allProducts` **без проверки на дубликаты** по `sbisId`

**Проблема**:
- Один товар может попасть в массив несколько раз
- При сохранении: первый раз создается (savedCount++), последующие разы обновляется (updatedCount++)
- Это объясняет цифры: 1731 + 8491 = 10222, хотя реально товаров ~2400

### 4. ❌ Неправильная логика подсчета статистики

**Текущая логика** (строки 549-563):
```typescript
if (existingProduct.length > 0) {
    updatedCount++  // Считается как обновление
} else {
    savedCount++    // Считается как новый
}
```

**Проблема**:
- Если товар встречается в `allProducts` несколько раз:
  - Первый раз → создается (savedCount++)
  - Второй раз → обновляется (updatedCount++)
  - Третий раз → обновляется (updatedCount++)
- Статистика становится бессмысленной

## Правильная логика работы с API СБИС

### По документации: https://saby.ru/help/integration/api/app_sale/sale_delyvery/catalog

**Параметры пагинации**:
- `pageSize` - количество записей на странице (макс. 1000)
- `position` - иерархический ID последней записи из предыдущей страницы
- `order` - направление: "before" (назад) или "after" (вперед)
- `outcome` - флаг наличия записей на следующих страницах

**Правильный алгоритм пагинации**:
1. Первый запрос: без `position`, получаем первую страницу
2. Проверяем `outcome.hasMore`
3. Если `hasMore === true`:
   - Берем `hierarchicalId` последнего элемента из текущей страницы
   - Делаем следующий запрос с `position = lastItemHierarchicalId` и `order = 'after'`
   - Повторяем до тех пор, пока `hasMore === false`

### Правильная логика обхода категорий

**Вариант 1: Обход всех элементов без фильтрации по категориям**
- Запрашиваем все товары без указания `position` (или с корневой позицией)
- Обрабатываем пагинацию через `position` и `outcome.hasMore`
- Фильтруем товары по `isParent === false` и `id !== null`
- Группируем по категориям на основе `hierarchicalParent`

**Вариант 2: Рекурсивный обход с дедупликацией**
- Если используем рекурсивный обход категорий:
  - Добавлять товары в `Set` или `Map` по `sbisId` для предотвращения дубликатов
  - Обрабатывать пагинацию внутри каждой категории

## Рекомендации по исправлению

### 1. Дедупликация товаров перед сохранением
```typescript
// Создаем Map для уникальных товаров
const uniqueProducts = new Map<number, any>()
allProducts.forEach(product => {
    if (product.id && !uniqueProducts.has(product.id)) {
        uniqueProducts.set(product.id, product)
    }
})

// Используем только уникальные товары
const productsToSave = Array.from(uniqueProducts.values())
```

### 2. Правильная пагинация внутри категории
```typescript
const fetchAllItemsFromCategory = async (categoryId: number | null) => {
    const allItems: any[] = []
    let position: number | null = null
    let hasMore = true
    
    while (hasMore) {
        const params: any = {
            pointID: config.pointId,
            priceListId: config.priceListId,
            pageSize: 1000, // Максимум по документации
            withBalance: true,
            withBarcode: true,
        }
        
        if (position) {
            params.position = position
            params.order = 'after'
        }
        
        const response = await axios.get(`${config.apiUrl}/nomenclature/list`, { params, ... })
        const { nomenclatures, outcome } = response.data
        
        if (!Array.isArray(nomenclatures)) break
        
        allItems.push(...nomenclatures)
        
        // Проверяем, есть ли еще страницы
        hasMore = outcome?.hasMore === true
        
        // Если есть еще страницы, берем ID последнего элемента
        if (hasMore && nomenclatures.length > 0) {
            const lastItem = nomenclatures[nomenclatures.length - 1]
            position = lastItem.hierarchicalId
        } else {
            break
        }
    }
    
    return allItems
}
```

### 3. Исправление статистики
```typescript
// Дедупликация перед сохранением
const uniqueProducts = new Map<number, any>()
allProducts.forEach(product => {
    if (product.id && !uniqueProducts.has(product.id)) {
        uniqueProducts.set(product.id, product)
    }
})

const productsToSave = Array.from(uniqueProducts.values())
let savedCount = 0
let updatedCount = 0

for (const productData of productsToSave) {
    const existingProduct = await strapi.entityService.findMany(
        'api::product.product',
        { filters: { sbisId: productData.id } }
    )
    
    if (existingProduct.length > 0) {
        await strapi.entityService.update(...)
        updatedCount++
    } else {
        await strapi.entityService.create(...)
        savedCount++
    }
}
```

## Дополнительные выводы из документации СБИС

**Источник**: https://saby.ru/help/integration/api/app_sale/sale_delyvery/catalog

### Ключевые моменты из документации:

1. **`position` параметр**:
   - Это **иерархический идентификатор последней записи** из предыдущей страницы
   - При получении первой страницы параметр **не указывается**
   - НЕ является ID категории!

2. **`outcome` параметр**:
   - Флаг наличия записей на следующих страницах (boolean)
   - Должен проверяться для определения необходимости следующего запроса

3. **`pageSize`**:
   - Максимальное значение: **1000** (мы используем 100)
   - Можно увеличить для уменьшения количества запросов

4. **`order` параметр**:
   - "before" - записи до указанного `position` (листание назад)
   - "after" - записи после указанного `position` (листание вперед)

### Правильный алгоритм работы с API:

```
1. Первый запрос: без position, pageSize = 1000
2. Получаем nomenclatures и outcome
3. Если outcome.hasMore === true:
   - Берем hierarchicalId последнего элемента из nomenclatures
   - Делаем запрос с position = lastItemHierarchicalId, order = 'after'
   - Повторяем до outcome.hasMore === false
4. Фильтруем: isParent === false && id !== null (только товары)
5. Дедуплицируем по id (sbisId)
```

## Выводы

1. **Неправильная пагинация**: Используем `categoryId` как `position`, что неправильно по документации
2. **Отсутствие обработки `outcome.hasMore`**: Не обрабатываем многостраничные ответы
3. **Дублирование товаров**: Нет дедупликации перед сохранением
4. **Неправильная статистика**: Считаем дубликаты как отдельные операции
5. **Неоптимальный pageSize**: Используем 100 вместо максимальных 1000

## Следующие шаги

1. ✅ Реализовать правильную пагинацию через `position` (ID последнего элемента) и `outcome.hasMore`
2. ✅ Добавить дедупликацию товаров по `sbisId` перед сохранением
3. ✅ Исправить логику подсчета статистики (считать только уникальные товары)
4. ✅ Увеличить `pageSize` до 1000 для оптимизации
5. ✅ Рассмотреть вариант обхода всех товаров без рекурсии по категориям (проще и надежнее)
6. ⏳ Протестировать на реальных данных

