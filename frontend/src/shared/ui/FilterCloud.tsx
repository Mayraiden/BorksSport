'use client'

import { memo, useMemo } from 'react'
import { X } from '@phosphor-icons/react'
import { useFilters } from '@/features/Filters/lib/hooks'
import { useFiltersStore } from '@/features/Filters/model/store'
import { useSearch } from '@/shared/lib/contexts/SearchContext'
import type { ProductFilters } from '@/shared/types'
import { FILTERS_CONFIG } from '@/features/Filters/config/filter.config'
import { productFiltersToFilterValues } from '@/features/Filters/model/types'

type FilterTag = {
	id: string
	label: string
	value: string
	type: 'category' | 'brand' | 'price' | 'sport' | 'search'
}

/**
 * Компонент облака фильтров для отображения активных фильтров
 */
export const FilterCloud = memo(() => {
	const { updateAppliedFilters } = useFilters()
	const { clearSearch, debouncedSearchQuery } = useSearch()
	const setFilterValues = useFiltersStore((state) => state.setFilterValues)
	const currentFilterValues = useFiltersStore((state) => state.filterValues)
	// Берем appliedFilters напрямую из store (без search, который в combinedFilters)
	const appliedFiltersFromStore = useFiltersStore(
		(state) => state.appliedFilters
	)

	// Преобразуем примененные фильтры в массив тегов
	const filterTags = useMemo((): FilterTag[] => {
		const tags: FilterTag[] = []

		// Поиск (из SearchContext, не из store)
		if (debouncedSearchQuery) {
			tags.push({
				id: 'search',
				label: `"${debouncedSearchQuery}"`,
				value: debouncedSearchQuery,
				type: 'search',
			})
		}

		// Категории
		if (appliedFiltersFromStore.category) {
			const categories = appliedFiltersFromStore.category
				.split(',')
				.filter(Boolean)
			categories.forEach((category) => {
				// Категории приходят как названия из базы (например "Одежда")
				tags.push({
					id: `category-${category}`,
					label: category.trim(),
					value: category.trim(),
					type: 'category',
				})
			})
		}

		// Бренды
		if (appliedFiltersFromStore.brand) {
			const brands = appliedFiltersFromStore.brand.split(',').filter(Boolean)
			brands.forEach((brand) => {
				// Найдем label из конфига
				const brandConfig = FILTERS_CONFIG.find(
					(section) => section.id === 'brand'
				)
				const brandOption = brandConfig?.filters
					.find((f) => f.id === 'brands')
					?.options?.find((opt) => opt.value === brand)

				tags.push({
					id: `brand-${brand}`,
					label: brandOption?.label || brand,
					value: brand,
					type: 'brand',
				})
			})
		}

		// Виды спорта
		if (appliedFiltersFromStore.sport) {
			const sports = appliedFiltersFromStore.sport.split(',').filter(Boolean)
			sports.forEach((sport) => {
				// Найдем label из конфига
				const sportConfig = FILTERS_CONFIG.find(
					(section) => section.id === 'sport'
				)
				const sportOption = sportConfig?.filters
					.find((f) => f.id === 'sports')
					?.options?.find((opt) => opt.value === sport)

				tags.push({
					id: `sport-${sport}`,
					label: sportOption?.label || sport,
					value: sport,
					type: 'sport',
				})
			})
		}

		// Цена
		if (
			appliedFiltersFromStore.minPrice !== undefined ||
			appliedFiltersFromStore.maxPrice !== undefined
		) {
			const min = appliedFiltersFromStore.minPrice ?? 0
			const max = appliedFiltersFromStore.maxPrice ?? 300000

			// Показываем только если диапазон не равен полному
			// Проверяем значения из конфига фильтров
			const priceConfig = FILTERS_CONFIG.find(
				(section) => section.id === 'price'
			)
			const defaultMin =
				(priceConfig?.filters[0]?.default as { min: number })?.min ?? 0
			const defaultMax =
				(priceConfig?.filters[0]?.default as { max: number })?.max ?? 300000

			if (min !== defaultMin || max !== defaultMax) {
				const formatPrice = (price: number) => {
					return price.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
				}
				tags.push({
					id: 'price',
					label: `от ${formatPrice(min)} - до ${formatPrice(max)}`,
					value: `price-${min}-${max}`,
					type: 'price',
				})
			}
		}

		return tags
	}, [appliedFiltersFromStore, debouncedSearchQuery])

	// Удаление фильтра
	const handleRemoveFilter = (tag: FilterTag) => {
		// Создаем новую копию фильтров из store (без search)
		const newFilters: Partial<ProductFilters> = {
			...appliedFiltersFromStore,
		}

		switch (tag.type) {
			case 'search':
				// Очищаем поиск через SearchContext
				clearSearch()
				// search не хранится в appliedFilters, только в SearchContext
				break

			case 'category': {
				// Удаляем конкретную категорию из списка
				const categories = (appliedFiltersFromStore.category || '')
					.split(',')
					.filter(Boolean)
					.map((c) => c.trim())
					.filter((c) => c !== tag.value)
				if (categories.length > 0) {
					newFilters.category = categories.join(',')
				} else {
					// Если это последняя категория, удаляем
					newFilters.category = undefined
				}
				break
			}

			case 'brand': {
				// Удаляем конкретный бренд из списка
				const brands = (appliedFiltersFromStore.brand || '')
					.split(',')
					.filter(Boolean)
					.map((b) => b.trim())
					.filter((b) => b !== tag.value)
				if (brands.length > 0) {
					newFilters.brand = brands.join(',')
				} else {
					// Если это последний бренд, удаляем
					newFilters.brand = undefined
				}
				break
			}

			case 'price':
				newFilters.minPrice = undefined
				newFilters.maxPrice = undefined
				break

			case 'sport': {
				// Удаляем конкретный вид спорта из списка
				const sports = (appliedFiltersFromStore.sport || '')
					.split(',')
					.filter(Boolean)
					.map((s) => s.trim())
					.filter((s) => s !== tag.value)
				if (sports.length > 0) {
					newFilters.sport = sports.join(',')
				} else {
					// Если это последний вид спорта, удаляем
					newFilters.sport = undefined
				}
				break
			}
		}

		// Обновляем appliedFilters
		updateAppliedFilters(newFilters)

		// Синхронизируем filterValues с новыми appliedFilters
		const updatedFilterValues = productFiltersToFilterValues(
			newFilters,
			currentFilterValues
		)
		setFilterValues(updatedFilterValues)
	}

	if (filterTags.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap gap-2">
			{filterTags.map((tag) => (
				<div
					key={tag.id}
					className="group flex items-center gap-2 px-3 py-1.5 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors duration-200"
				>
					<span className="text-sm text-gray-700 font-medium">{tag.label}</span>
					<button
						onClick={() => handleRemoveFilter(tag)}
						className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-400 transition-colors duration-200 text-gray-600 hover:text-gray-900"
						aria-label={`Удалить фильтр ${tag.label}`}
					>
						<X size={14} weight="bold" />
					</button>
				</div>
			))}
		</div>
	)
})

FilterCloud.displayName = 'FilterCloud'
