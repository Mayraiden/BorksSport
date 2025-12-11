'use client'

import { memo } from 'react'
import { FilterCloud } from './FilterCloud'
import { useFilters } from '@/features/Filters/lib/hooks'

/**
 * Обертка для FilterCloud с разделителем
 * Показывает разделитель и область фильтров только если есть активные фильтры
 */
export const FilterCloudWithSeparator = memo(() => {
	const { appliedFilters } = useFilters()

	// Проверяем, есть ли активные фильтры (кроме сортировки)
	const hasActiveFilters = !!(
		appliedFilters.search ||
		appliedFilters.category ||
		appliedFilters.brand ||
		appliedFilters.minPrice !== undefined ||
		appliedFilters.maxPrice !== undefined
	)

	if (!hasActiveFilters) {
		return null
	}

	return (
		<>
			{/* Gray separator line */}
			<div className="border-t border-gray-200"></div>

			{/* Filter cloud */}
			<div className="px-5 py-3 bg-gray-50">
				<FilterCloud />
			</div>
		</>
	)
})

FilterCloudWithSeparator.displayName = 'FilterCloudWithSeparator'
