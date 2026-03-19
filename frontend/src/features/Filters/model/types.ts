import type { FilterValues } from '@/shared/types/filters.types'
import type { ProductFilters } from '@/shared/types'
import { FILTERS_CONFIG } from '../config/filter.config'

export type FilterStoreState = {
	// Фильтры из UI (FilterValues - внутренний формат)
	filterValues: FilterValues

	// Примененные фильтры для API (ProductFilters - формат для запросов)
	appliedFilters: ProductFilters

	// Флаг, были ли фильтры изменены, но не применены
	hasUnsavedChanges: boolean

	// Действия
	setFilterValue: (filterId: string, value: FilterValues[string]) => void
	setFilterValues: (values: FilterValues) => void
	applyFilters: () => void
	resetFilters: () => void
	clearFilters: () => void
	updateAppliedFilters: (filters: Partial<ProductFilters>) => void

	// Синхронизация с URL
	syncFromUrl: () => void
	syncToUrl: () => void
}

// Функция преобразования FilterValues в ProductFilters
export const filterValuesToProductFilters = (
	filterValues: FilterValues
): Partial<ProductFilters> => {
	const result: Partial<ProductFilters> = {}

	// Price range
	if (filterValues.priceRange) {
		const priceRange = filterValues.priceRange as { min: number; max: number }
		if (priceRange.min !== undefined) result.minPrice = priceRange.min
		if (priceRange.max !== undefined) result.maxPrice = priceRange.max
	}

	// Categories
	if (filterValues.categories && Array.isArray(filterValues.categories)) {
		const categories = filterValues.categories as string[]
		if (categories.length > 0) {
			// Объединяем множественные категории через запятую
			result.category = categories.join(',')
		}
	}

	// Brands
	if (filterValues.brands && Array.isArray(filterValues.brands)) {
		const brands = filterValues.brands as string[]
		if (brands.length > 0) {
			// Объединяем множественные бренды через запятую
			result.brand = brands.join(',')
		}
	}

	// Sports (sport types - level 0 categories)
	if (filterValues.sports && Array.isArray(filterValues.sports)) {
		const sports = filterValues.sports as string[]
		if (sports.length > 0) {
			// Объединяем множественные виды спорта через запятую
			result.sport = sports.join(',')
		}
	}

	// Colors (checkbox multi-select)
	if (filterValues.colors && Array.isArray(filterValues.colors)) {
		const colors = filterValues.colors as string[]
		if (colors.length > 0) {
			result.colors = colors
		}
	}

	// Sizes (checkbox multi-select)
	if (filterValues.sizes && Array.isArray(filterValues.sizes)) {
		const sizes = filterValues.sizes as string[]
		if (sizes.length > 0) {
			result.sizes = sizes
		}
	}

	return result
}

// Функция обратного преобразования ProductFilters в FilterValues
export const productFiltersToFilterValues = (
	productFilters: Partial<ProductFilters>,
	currentFilterValues: FilterValues
): FilterValues => {
	const result: FilterValues = { ...currentFilterValues }

	// Price range
	const priceConfig = FILTERS_CONFIG.find((section) => section.id === 'price')
	const defaultMin =
		(priceConfig?.filters[0]?.default as { min: number })?.min ?? 0
	const defaultMax =
		(priceConfig?.filters[0]?.default as { max: number })?.max ?? 300000

	if (
		productFilters.minPrice !== undefined ||
		productFilters.maxPrice !== undefined
	) {
		const min = productFilters.minPrice ?? defaultMin
		const max = productFilters.maxPrice ?? defaultMax

		// Если значения равны дефолтным, используем дефолтные
		if (min === defaultMin && max === defaultMax) {
			result.priceRange = { min: defaultMin, max: defaultMax }
		} else {
			result.priceRange = { min, max }
		}
	} else {
		// Если фильтр цены удален, сбрасываем на дефолт
		result.priceRange = { min: defaultMin, max: defaultMax }
	}

	// Categories
	if (productFilters.category) {
		const categories = productFilters.category
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean)
		result.categories = categories
	} else {
		// Если категории удалены, очищаем
		result.categories = []
	}

	// Brands
	if (productFilters.brand) {
		const brands = productFilters.brand
			.split(',')
			.map((b) => b.trim())
			.filter(Boolean)
		result.brands = brands
	} else {
		// Если бренды удалены, очищаем
		result.brands = []
	}

	// Sports (sport types)
	if (productFilters.sport) {
		const sports = productFilters.sport
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
		result.sports = sports
	} else {
		// Если виды спорта удалены, очищаем
		result.sports = []
	}

	// Colors
	if (productFilters.colors && Array.isArray(productFilters.colors)) {
		result.colors = productFilters.colors
	} else {
		result.colors = []
	}

	// Sizes
	if (productFilters.sizes && Array.isArray(productFilters.sizes)) {
		result.sizes = productFilters.sizes
	} else {
		result.sizes = []
	}

	// Search не хранится в filterValues, только в appliedFilters

	return result
}
