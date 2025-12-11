# Analysis of Filter Problems

## Problem Summary

### 1. Filter "Вид спорта" (Sport Type) - Wrong Categories
**Expected**: Only level 0 categories (e.g., "Хоккей на траве", "Бейсбол и Софтбол")
**Actual**: Shows categories from different levels (brands, products, etc.)

### 2. Filter "Категория" (Category) - Working Correctly
**Status**: ✅ User confirmed it's working

### 3. Filter "Бренд" (Brand) - Wrong Categories
**Expected**: Only level 2 categories (brands like "Easton", "Rawlings")
**Actual**: Shows only 2 categories that don't match brands

### 4. Critical: Filters Don't Work
**Problem**: When applying filters (categories, brands, sport types), no products are shown
**Working**: Price filters, popularity, sorting work correctly

---

## Root Cause Analysis

### Problem 1 & 3: Wrong Categories in Filters

#### Hypothesis 1: Incorrect Level Assignment in Database
**Location**: `src/api/sbis-sync/services/sbis-sync.ts` - `saveCategories()`

**Issue**: Categories might be saved with incorrect `level` values during SBIS synchronization.

**Evidence**:
- Categories are saved with `level: categoryData.level || 0` (line 455)
- The `level` is set during recursive traversal in `getAllProductsRecursively()`
- If the level calculation is wrong, categories will appear in wrong filters

**Check Required**:
1. Query Strapi database: `SELECT id, name, level FROM categories ORDER BY level, name`
2. Verify that:
   - Level 0 categories are only main sport types (4 categories)
   - Level 1 categories are product categories (bags, balls, etc.)
   - Level 2 categories are brands (Easton, Rawlings, etc.)

#### Hypothesis 2: Frontend Fetching Wrong Level
**Location**: `src/widgets/Filters/Filters.tsx`

**Current Implementation**:
```typescript
const { data: sportTypes } = useMainCategories() // level 0
const { data: productCategories } = useCategoriesByLevel(1) // level 1
const { data: brands } = useCategoriesByLevel(2) // level 2
```

**Potential Issue**: 
- `useMainCategories()` calls `/api/categories/main` which filters by `level: 0`
- But if categories in DB have wrong levels, wrong categories will be returned

**Check Required**:
1. Open browser DevTools → Network tab
2. Check API responses:
   - `GET /api/categories/main` - should return only 4 sport types
   - `GET /api/categories/by-level/1` - should return product categories
   - `GET /api/categories/by-level/2` - should return brands
3. Verify the `level` field in each response

---

### Problem 4: Filters Don't Work (Critical)

#### Hypothesis 1: Wrong Field Used for Filtering
**Location**: `src/features/Product/api/productApi.ts` - `getProducts()`

**Current Implementation**:

**Category Filter** (lines 140-159):
```typescript
if (params.category) {
  // Uses rootCategoryName for filtering
  searchParams.append('filters[rootCategoryName][$eq]', categoryValue)
}
```

**Brand Filter** (lines 161-176):
```typescript
if (params.brand) {
  // Uses 'brand' field which doesn't exist in schema
  searchParams.append('filters[brand][$eq]', params.brand)
}
```

**Sport Type Filter**: NOT IMPLEMENTED (lines 59-63 in `types.ts`)

**Issues Identified**:

1. **Category Filter Problem**:
   - Uses `rootCategoryName` (string field) instead of `category` (relation)
   - `rootCategoryName` might not match the selected category name exactly
   - Should use relation: `filters[category][name][$eq]` or `filters[category][id][$eq]`

2. **Brand Filter Problem**:
   - Uses field `brand` which **doesn't exist** in product schema
   - Product schema has: `category` (relation), `categoryName` (string), `rootCategoryName` (string)
   - Should use relation: `filters[category][name][$eq]` with level 2 categories

3. **Sport Type Filter Problem**:
   - Not implemented at all in `productApi.ts`
   - Should use relation: `filters[category][parent][name][$eq]` or filter by root category

#### Hypothesis 2: Relation Filtering Not Working
**Location**: `src/api/product/controllers/product.ts` - `find()`

**Current Implementation**:
- Backend uses Strapi's `entityService.findMany()` with filters
- Strapi should support relation filtering, but syntax might be wrong

**Check Required**:
1. Test relation filtering in Strapi:
   - `filters[category][name][$eq]` - filter by category name
   - `filters[category][id][$eq]` - filter by category ID
   - `filters[category][level][$eq]` - filter by category level

#### Hypothesis 3: Data Mismatch
**Issue**: Category names in filters don't match category names in products

**Check Required**:
1. Check a sample product in database:
   - What is `product.categoryName`?
   - What is `product.rootCategoryName`?
   - What is `product.category.name` (relation)?
2. Compare with category names in filters:
   - Are names exactly matching (case-sensitive)?
   - Are there extra spaces or special characters?

---

## Data Structure Analysis

### Product Schema (from `schema.json`):
```json
{
  "category": {
    "type": "relation",
    "relation": "manyToOne",
    "target": "api::category.category"
  },
  "categoryName": { "type": "string" },
  "rootCategoryName": { "type": "string" }
}
```

### Category Schema:
```json
{
  "name": { "type": "string" },
  "level": { "type": "integer" },
  "parent": { "type": "relation" },
  "children": { "type": "relation" }
}
```

### Current Filter Implementation:
- **Category Filter**: Filters by `rootCategoryName` (string) - WRONG
- **Brand Filter**: Filters by `brand` (field doesn't exist) - WRONG
- **Sport Type Filter**: Not implemented - MISSING

### Correct Implementation Should Be:
- **Category Filter**: Filter by `category.name` (relation) where `category.level = 1`
- **Brand Filter**: Filter by `category.name` (relation) where `category.level = 2`
- **Sport Type Filter**: Filter by `category.parent.name` (relation) where `category.parent.level = 0` OR filter by root category

---

## Verification Plan

### Step 1: Check Database Data
1. **Check Categories**:
   ```sql
   -- In Strapi admin or direct DB query
   SELECT id, name, level, "sbisId" FROM categories ORDER BY level, name;
   ```
   - Verify level 0 has only 4 sport types
   - Verify level 1 has product categories
   - Verify level 2 has brands

2. **Check Products**:
   ```sql
   -- Sample products
   SELECT id, name, "categoryName", "rootCategoryName", "category" FROM products LIMIT 10;
   ```
   - Check if `categoryName` and `rootCategoryName` are populated
   - Check if `category` relation is set

### Step 2: Check API Responses
1. **Categories API**:
   - `GET /api/categories/main` - should return 4 items with level 0
   - `GET /api/categories/by-level/1` - should return product categories
   - `GET /api/categories/by-level/2` - should return brands

2. **Products API with Filters**:
   - `GET /api/products?filters[rootCategoryName][$eq]=Бейсбол и Софтбол` - test current filter
   - `GET /api/products?filters[category][name][$eq]=Сумки` - test relation filter
   - Check if any products are returned

### Step 3: Check Frontend Filter Values
1. Open browser DevTools → Console
2. Apply a filter and check:
   - What values are in `filterValues`?
   - What values are sent to API in `appliedFilters`?
   - What URL parameters are generated?

---

## Fix Plan

### Fix 1: Correct Category Level Assignment
**If Hypothesis 1 is confirmed** (wrong levels in DB):
1. Check SBIS sync logic in `getAllProductsRecursively()`
2. Verify level calculation is correct
3. Re-sync categories if needed
4. Or manually fix levels in Strapi admin

### Fix 2: Fix Frontend Filter Data
**If Hypothesis 2 is confirmed** (wrong data fetched):
1. Verify API endpoints return correct data
2. Check if `useCategoriesByLevel()` is called correctly
3. Add logging to see what categories are fetched

### Fix 3: Fix Product Filtering Logic (CRITICAL)
**Required Changes**:

1. **Category Filter** (`productApi.ts` lines 140-159):
   ```typescript
   // Current (WRONG):
   searchParams.append('filters[rootCategoryName][$eq]', categoryValue)
   
   // Should be (using relation):
   searchParams.append('filters[category][name][$in]', categories.join(','))
   // OR by ID:
   searchParams.append('filters[category][id][$in]', categoryIds.join(','))
   ```

2. **Brand Filter** (`productApi.ts` lines 161-176):
   ```typescript
   // Current (WRONG - field doesn't exist):
   searchParams.append('filters[brand][$eq]', params.brand)
   
   // Should be (using relation):
   searchParams.append('filters[category][name][$in]', brands.join(','))
   // Where category.level = 2
   ```

3. **Sport Type Filter** (NOT IMPLEMENTED):
   ```typescript
   // Need to add:
   if (params.sport) {
     // Filter by root category or parent category
     searchParams.append('filters[category][parent][name][$in]', sports.join(','))
     // OR filter by rootCategoryName if it matches sport type
   }
   ```

4. **Backend Support** (`product.ts` controller):
   - Verify Strapi supports nested relation filtering
   - May need custom filtering logic if Strapi doesn't support it

### Fix 4: Use Category IDs Instead of Names
**Better Approach**: Use category IDs for filtering instead of names to avoid:
- Case sensitivity issues
- Special character issues
- Exact match problems

**Implementation**:
1. Store category IDs in filter values instead of names
2. Filter by `filters[category][id][$in]` instead of `filters[category][name][$eq]`

---

## Priority Order

1. **CRITICAL**: Fix product filtering logic (Fix 3) - filters don't work at all
2. **HIGH**: Fix category level assignment (Fix 1) - wrong categories in filters
3. **MEDIUM**: Use category IDs instead of names (Fix 4) - more reliable
4. **LOW**: Add logging and debugging (verification steps)

---

## Testing Checklist

After fixes:
- [ ] Filter "Вид спорта" shows only level 0 categories
- [ ] Filter "Категория" shows only level 1 categories (already working)
- [ ] Filter "Бренд" shows only level 2 categories
- [ ] Selecting sport type filter shows products
- [ ] Selecting category filter shows products
- [ ] Selecting brand filter shows products
- [ ] Multiple filters work together (AND logic)
- [ ] Price filters still work
- [ ] Sorting still works

---

## Notes

- The `rootCategoryName` field might be useful for sport type filtering if it's correctly populated
- Need to verify if Strapi supports nested relation filtering (`filters[category][parent][name]`)
- If Strapi doesn't support it, may need custom service method for filtering
- Consider adding indexes on `category.level` and `category.name` for performance

---

## UPDATE: Additional Findings from User

### Problem Identified

**User's observation**: 
- Filter request: `filters[rootCategoryName][$eq]=Easton` returns empty array
- "Easton" is a brand (level 2 category), NOT a root category
- Root category should be "Бейсбол и Софтбол" (level 0)

### Root Causes

1. **`rootCategoryName` is not populated correctly**:
   - In `saveProducts()` (line 562): `rootCategoryName: productData.rootCategoryName || null`
   - But `productData.rootCategoryName` is actually `rootCategorySbisId` (ID, not name)
   - Need to look up category name by `rootCategorySbisId` from `categoryMap`

2. **Wrong field used for brand filtering**:
   - Filter uses `rootCategoryName` for brand "Easton"
   - But "Easton" is a brand (level 2), not root category (level 0)
   - Should use `category.name` relation filter instead

3. **Two requests sent**:
   - One with filters (returns empty)
   - One without filters (returns products)
   - Likely due to React Query refetching or filter state management

### Fix Required

1. **Fix `rootCategoryName` population**:
   ```typescript
   // In saveProducts(), need to get root category name from categoryMap
   const rootCategoryName = productData.rootCategorySbisId 
     ? categoryMap.get(productData.rootCategorySbisId)?.name 
     : null
   ```

2. **Fix brand filter**:
   - Change from `filters[rootCategoryName][$eq]` to `filters[category][name][$eq]`
   - Or use `filters[category][id][$in]` with category IDs

3. **Fix category filter**:
   - For level 1 categories, use `filters[category][name][$eq]` or `filters[category][id][$in]`
   - NOT `rootCategoryName`

4. **Fix sport type filter**:
   - Use `filters[rootCategoryName][$eq]` with level 0 category names
   - OR use `filters[category][parent][name][$eq]` if supported

