# Category Filters Implementation

## Problem Analysis

The application has a hierarchical category structure from SBIS with 4 levels:
- **Level 0**: Sport types (main categories) - e.g., "Хоккей на траве", "Бейсбол и Софтбол"
- **Level 1**: Product categories - e.g., "Сумки" (Bags), "Мячи" (Balls)
- **Level 2**: Brands - e.g., "Easton", "Diamond", "Rawlings"
- **Level 3**: Individual products

### Issues Identified

1. **Category Filter Problem**: The "Категория" (Category) filter was showing all categories from all levels instead of only level 1 categories (product categories like bags, balls, etc.)

2. **Brand Filter Problem**: The "Бренд" (Brand) filter had hardcoded placeholder values instead of real brands from the category structure (level 2)

3. **Sport Type Filter Problem**: The "Вид спорта" (Sport Type) filter had hardcoded placeholder values instead of real main categories (level 0)

## Solution

### Backend Changes

#### 1. New API Endpoint

Added a new endpoint to fetch categories by level:

**Route**: `GET /api/categories/by-level/:level`

**Controller Method**: `findByLevel(ctx)`

**Parameters**:
- `level` (path parameter): The hierarchy level (0, 1, 2, etc.)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Category Name",
      "level": 1,
      "sbisId": 12345,
      "isActive": true,
      ...
    }
  ],
  "meta": {
    "count": 10,
    "level": 1
  }
}
```

**Implementation Location**:
- Controller: `src/api/category/controllers/category.ts`
- Route: `src/api/category/routes/category.ts`

#### 2. Category Level Storage

Categories are stored with a `level` field that indicates their position in the hierarchy:
- Level is set during SBIS synchronization in `saveCategories()` method
- Level is calculated during recursive traversal in `getAllProductsRecursively()`

### Frontend Changes

#### 1. API Client Updates

**File**: `src/features/Filters/api/categoryApi.ts`

Added new method:
```typescript
async getCategoriesByLevel(level: number): Promise<MainCategory[]>
```

This method fetches categories filtered by their hierarchy level.

#### 2. React Hooks

**File**: `src/features/Filters/lib/useCategories.ts`

Added new hook:
```typescript
export const useCategoriesByLevel = (level: number)
```

This hook uses React Query to fetch and cache categories by level.

#### 3. Filter Configuration Updates

**File**: `src/widgets/Filters/Filters.tsx`

Updated the `Filters` component to:
- Fetch categories for each filter level:
  - `sportTypes`: Level 0 (sport types)
  - `productCategories`: Level 1 (product categories)
  - `brands`: Level 2 (brands)
- Dynamically populate filter options from API data
- Clean up old filter values when new data is loaded

**Filter Mapping**:
- **Sport Type Filter** (`sportType`): Uses `sportTypes` (level 0)
- **Category Filter** (`category`): Uses `productCategories` (level 1)
- **Brand Filter** (`brand`): Uses `brands` (level 2)

## Implementation Details

### Backend Implementation

```typescript
// src/api/category/controllers/category.ts
async findByLevel(ctx) {
  const { level } = ctx.params
  const levelNumber = parseInt(level, 10)
  
  const filters: any = {
    level: levelNumber,
    isActive: true,
  }
  
  const categories = await strapi.entityService.findMany(
    'api::category.category',
    {
      filters,
      sort: 'sortOrder:asc,name:asc',
    }
  )
  
  ctx.body = {
    success: true,
    data: categories,
    meta: { count: categories.length, level: levelNumber },
  }
}
```

### Frontend Implementation

```typescript
// src/widgets/Filters/Filters.tsx
const { data: sportTypes } = useMainCategories() // level 0
const { data: productCategories } = useCategoriesByLevel(1) // level 1
const { data: brands } = useCategoriesByLevel(2) // level 2

const filtersConfig = useMemo(() => {
  const sportTypeOptions = sportTypes?.map(cat => ({
    value: cat.name,
    label: cat.name,
    id: cat.id,
  })) || []
  
  const categoryOptions = productCategories?.map(cat => ({
    value: cat.name,
    label: cat.name,
    id: cat.id,
  })) || []
  
  const brandOptions = brands?.map(cat => ({
    value: cat.name,
    label: cat.name,
    id: cat.id,
  })) || []
  
  // Update filter sections with dynamic options
  return FILTERS_CONFIG.map(section => {
    if (section.id === 'sportType') {
      // Update with sportTypeOptions
    }
    if (section.id === 'category') {
      // Update with categoryOptions
    }
    if (section.id === 'brand') {
      // Update with brandOptions
    }
    return section
  })
}, [sportTypes, productCategories, brands])
```

## API Endpoints Summary

| Endpoint | Method | Description | Level |
|----------|--------|-------------|-------|
| `/api/categories/main` | GET | Get main categories (sport types) | 0 |
| `/api/categories/by-level/:level` | GET | Get categories by hierarchy level | 0, 1, 2, ... |
| `/api/categories` | GET | Get all categories (with filters) | All |

## Testing

To test the implementation:

1. **Backend**: 
   - Call `GET /api/categories/by-level/0` - should return sport types
   - Call `GET /api/categories/by-level/1` - should return product categories
   - Call `GET /api/categories/by-level/2` - should return brands

2. **Frontend**:
   - Open the catalog page
   - Check that "Вид спорта" filter shows only level 0 categories
   - Check that "Категория" filter shows only level 1 categories
   - Check that "Бренд" filter shows only level 2 categories

## Benefits

1. **Dynamic Data**: Filters are now populated from actual category data instead of hardcoded values
2. **Correct Filtering**: Each filter shows only the appropriate level of categories
3. **Maintainability**: When categories are synced from SBIS, filters automatically update
4. **Scalability**: Easy to add new filter levels if needed in the future

## Notes

- Categories must be synced from SBIS first before filters will show data
- The `level` field is set during SBIS synchronization
- Filter options are cached for 10 minutes using React Query
- Old filter values are automatically cleaned up when new data is loaded

