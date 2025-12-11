'use client'

import { useState, memo, useMemo } from 'react'
import { InfiniteProductGrid } from '@/features/Product/ui/InfiniteProductGrid'
import { SearchResults } from '@/shared/ui/SearchResults'
import { FilterCloudWithSeparator } from '@/shared/ui/FilterCloudWithSeparator'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import type { SelectOption } from '@/shared/ui/CustomSelect'
import { useFilters, useFiltersSync } from '@/features/Filters/lib/hooks'
import type { ProductFilters } from '@/shared/types'

type CatalogContentProps = {
	className?: string
}

export const CatalogContent = memo(
	({ className = '' }: CatalogContentProps) => {
		const [sortBy, setSortBy] = useState<'name' | 'price' | 'createdAt'>(
			'createdAt'
		)
		const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
		const { appliedFilters } = useFilters()

		// Синхронизация фильтров с URL при изменении роутинга
		useFiltersSync()

		const sortOptions: SelectOption[] = [
			{ value: 'популярности', label: 'популярные' },
			{ value: 'дешевле', label: 'дешевле' },
			{ value: 'дороже', label: 'дороже' },
		]

		const handleSortChange = (value: string) => {
			switch (value) {
				case 'популярности':
					setSortBy('createdAt')
					setSortOrder('desc')
					break
				case 'дешевле':
					setSortBy('price')
					setSortOrder('asc')
					break
				case 'дороже':
					setSortBy('price')
					setSortOrder('desc')
					break
				default:
					setSortBy('createdAt')
					setSortOrder('desc')
			}
		}

		const currentSortValue = useMemo(() => {
			if (sortBy === 'createdAt' && sortOrder === 'desc') return 'популярности'
			if (sortBy === 'price' && sortOrder === 'asc') return 'дешевле'
			if (sortBy === 'price' && sortOrder === 'desc') return 'дороже'
			return 'популярности'
		}, [sortBy, sortOrder])

		// Объединяем фильтры из store с сортировкой (мемоизируем для предотвращения лишних ре-рендеров)
		const currentFilters: ProductFilters = useMemo(
			() => ({
				...appliedFilters,
				sortBy,
				sortOrder,
			}),
			[appliedFilters, sortBy, sortOrder]
		)

		return (
			<div className={`flex-1 flex flex-col gap-5 ${className}`}>
				<h2 className="text-2xl font-bold text-black">Каталог</h2>

				{/* Search results */}
				<SearchResults />

				{/* Sort controls and filter cloud in one block */}
				<div className="w-full bg-white rounded-md">
					{/* Sort controls */}
					<div
						className="px-5 py-3 flex items-center gap-3 relative z-10"
						style={{ overflow: 'visible' }}
					>
						<span className="text-sm font-medium text-gray-700">
							Сортировка:
						</span>
						<CustomSelect
							options={sortOptions}
							value={currentSortValue}
							onChange={handleSortChange}
							className="min-w-[180px]"
						/>
					</div>

					{/* Filter cloud section - only show if there are active filters */}
					<FilterCloudWithSeparator />
				</div>

				{/* Products grid with infinite scroll */}
				<InfiniteProductGrid filters={currentFilters} />
			</div>
		)
	}
)

CatalogContent.displayName = 'CatalogContent'
