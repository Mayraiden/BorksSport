'use client'

import { memo, useMemo } from 'react'
import { XIcon } from '@phosphor-icons/react/ssr'
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
	type: 'category' | 'brand' | 'price' | 'sport' | 'color' | 'size' | 'search'
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
					(section) => section.id === 'sportType'
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

		// Colors
		if (Array.isArray(appliedFiltersFromStore.colors) && appliedFiltersFromStore.colors.length > 0) {
			appliedFiltersFromStore.colors.forEach((color) => {
				const v = String(color || '').trim()
				if (!v) return
				tags.push({
					id: `color-${v}`,
					label: v,
					value: v,
					type: 'color',
				})
			})
		}

		// Sizes
		if (Array.isArray(appliedFiltersFromStore.sizes) && appliedFiltersFromStore.sizes.length > 0) {
			appliedFiltersFromStore.sizes.forEach((size) => {
				const v = String(size || '').trim()
				if (!v) return
				tags.push({
					id: `size-${v}`,
					label: v,
					value: v,
					type: 'size',
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
					label: `от ${formatPrice(min)} до ${formatPrice(max)}`,
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

			case 'color': {
				const colors = Array.isArray(newFilters.colors) ? newFilters.colors : appliedFiltersFromStore.colors || []
				const next = colors.map((c) => String(c).trim()).filter(Boolean).filter((c) => c !== tag.value)
				if (next.length > 0) {
					newFilters.colors = next
				} else {
					newFilters.colors = undefined
				}
				break
			}

			case 'size': {
				const sizes = Array.isArray(newFilters.sizes) ? newFilters.sizes : appliedFiltersFromStore.sizes || []
				const next = sizes.map((s) => String(s).trim()).filter(Boolean).filter((s) => s !== tag.value)
				if (next.length > 0) {
					newFilters.sizes = next
				} else {
					newFilters.sizes = undefined
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
					className="flex items-center gap-2 pl-4 pr-1.5 py-1.5 bg-burgundy rounded-full transition-colors duration-200"
				>
					<span className="text-sm text-white font-medium">{tag.label}</span>
					<button
						onClick={() => handleRemoveFilter(tag)}
						className="flex items-center justify-center w-7 h-7 rounded-full cursor-pointer text-white hover:bg-white hover:text-black transition-colors duration-200"
						aria-label={`Удалить фильтр ${tag.label}`}
					>
						<XIcon size={16} weight="bold" />
					</button>
				</div>
			))}
		</div>
	)
})

FilterCloud.displayName = 'FilterCloud'
