# Документация API SBIS для получения товаров

## Источник

[Официальная документация SBIS](https://saby.ru/help/integration/api/app_sale/sale_delyvery/catalog?tb=tab2)

## Endpoint

```
GET https://api.sbis.ru/retail/v2/nomenclature/list
```

## Параметры запроса

| Параметр       | Тип     | Описание                                                                                                                           |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pointId`      | integer | Идентификатор точки продаж                                                                                                         |
| `priceListId`  | integer | Идентификатор прайс-листа или колонки цен                                                                                          |
| `pageSize`     | integer | Количество записей на странице. **Максимальное значение: 1000**                                                                    |
| `position`     | integer | **Иерархический идентификатор последней записи из предыдущей страницы**. При получении первой страницы параметр **не указывается** |
| `order`        | string  | Направление выборки: `before` (записи до position) или `after` (записи после position)                                             |
| `withBalance`  | boolean | Передача остатков товаров                                                                                                          |
| `withBarcode`  | boolean | Передача штрихкодов                                                                                                                |
| `noStopList`   | boolean | Исключить позиции из стоп-листа                                                                                                    |
| `searchString` | string  | Поиск по названию                                                                                                                  |

## Структура ответа

### Основные поля элемента номенклатуры

| Параметр             | Тип     | Описание                                                    |
| -------------------- | ------- | ----------------------------------------------------------- |
| `id`                 | integer | Идентификатор номенклатуры (товара). **null для категорий** |
| `hierarchicalId`     | integer | Идентификатор в иерархии (используется для `position`)      |
| `hierarchicalParent` | integer | Идентификатор родительского раздела                         |
| `isParent`           | boolean | **true = категория, false = товар**                         |
| `name`               | string  | Название товара или категории                               |
| `published`          | boolean | Признак публикации                                          |
| `cost`               | integer | Цена товара                                                 |
| `outcome`            | object  | Флаг наличия записей на следующих страницах                 |
| `outcome.hasMore`    | boolean | Есть ли еще страницы                                        |

## Ключевые моменты

### 1. Пагинация через `position` и `order`

**Важно:** `position` - это НЕ ID категории для фильтрации, а `hierarchicalId` последнего элемента предыдущей страницы!

**Алгоритм пагинации:**

1. Первый запрос: БЕЗ параметра `position`

   ```
   GET /nomenclature/list?pointID=201&priceListId=24&pageSize=1000
   ```

2. Если `outcome.hasMore === true`, следующий запрос:

   ```
   GET /nomenclature/list?pointID=201&priceListId=24&position=LAST_HIERARCHICAL_ID&order=after&pageSize=1000
   ```

   где `LAST_HIERARCHICAL_ID` = `hierarchicalId` последнего элемента из предыдущей страницы

3. Повторять шаг 2, пока `outcome.hasMore === true`

### 2. Различение товаров и категорий

- **Категория:** `isParent === true`, `id === null`
- **Товар:** `isParent === false`, `id !== null`

### 3. Построение дерева категорий

После получения всех элементов через пагинацию, дерево строится по полю `hierarchicalParent`:

- Элемент с `hierarchicalParent === null` - корневая категория
- Элемент с `hierarchicalParent === X` - дочерний элемент категории с `hierarchicalId === X`

### 4. Максимальный размер страницы

**Максимальный `pageSize = 1000`** - используем это значение для минимизации запросов.

## Проблемы в старой реализации

### ❌ Неправильное использование `position`

**Было:**

```typescript
// Передавали ID категории для "фильтрации"
params.position = categoryId
params.order = 'after'
```

**Проблема:** `position` предназначен для пагинации, а не для фильтрации по категориям. Это приводило к:

- Пропуску товаров
- Неполному обходу иерархии
- Достижению лимита глубины рекурсии (20/20, 50/50)

### ❌ Рекурсивный обход категорий

**Было:** Рекурсивный обход каждой категории с запросом `position = categoryId`

**Проблема:**

- Много лишних запросов
- Неправильное понимание работы API
- Риск пропуска товаров при глубокой вложенности

## Правильный подход

### Алгоритм

1. **Получить все элементы через пагинацию:**

   - Начать без `position`
   - Использовать `pageSize = 1000`
   - Для каждой следующей страницы использовать `position = hierarchicalId` последнего элемента
   - Продолжать, пока `outcome.hasMore === true`

2. **Построить дерево категорий:**

   - Собрать все элементы с `isParent === true` в мапу по `hierarchicalId`
   - Установить связи parent-child по `hierarchicalParent`

3. **Собрать все товары:**

   - Отфильтровать элементы с `isParent === false` и `id !== null`
   - Привязать к категориям по `hierarchicalParent`

4. **Сохранить в Strapi:**
   - Сначала категории (с установкой связей parent-child)
   - Затем товары (с привязкой к категориям)

### Преимущества

✅ Получаем ВСЕ товары (не пропускаем ничего)  
✅ Минимум запросов к API (1000 элементов на страницу)  
✅ Правильное понимание работы API  
✅ Нет ограничений по глубине вложенности  
✅ Быстрее выполняется (меньше HTTP-запросов)

## Пример реализации

```typescript
async getAllProductsWithPagination() {
  const { accessToken } = await this.getAccessToken()
  const allItems: any[] = []
  let position: number | null = null
  let hasMore = true

  while (hasMore) {
    const params: any = {
      pointID: this.config.pointId,
      priceListId: this.config.priceListId,
      pageSize: 1000, // Максимальный размер
      withBalance: false,
      withBarcode: true,
    }

    // Для последующих страниц используем position
    if (position !== null) {
      params.position = position
      params.order = 'after'
    }

    const response = await axios.get(
      `${this.config.apiUrl}/nomenclature/list`,
      { params, headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const { nomenclatures, outcome } = response.data

    if (Array.isArray(nomenclatures) && nomenclatures.length > 0) {
      allItems.push(...nomenclatures)

      // Берем hierarchicalId последнего элемента для следующей страницы
      const lastItem = nomenclatures[nomenclatures.length - 1]
      position = lastItem.hierarchicalId
      hasMore = outcome?.hasMore === true
    } else {
      hasMore = false
    }
  }

  // Разделяем на категории и товары
  const categories = allItems.filter(item => item.isParent === true)
  const products = allItems.filter(item => item.isParent === false && item.id !== null)

  return { categories, products, total: allItems.length }
}
```
