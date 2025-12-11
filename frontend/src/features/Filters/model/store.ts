import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FilterStoreState } from './types'
import {
	filterValuesToProductFilters,
	productFiltersToFilterValues,
} from './types'
import type { FilterValues } from '@/shared/types/filters.types'
import type { ProductFilters } from '@/shared/types'
import { FILTERS_CONFIG } from '../config/filter.config'

// Инициализация фильтров из конфига
const getInitialFilterValues = (): FilterValues => {
	const initialValues: FilterValues = {}
	FILTERS_CONFIG.forEach((section) => {
		section.filters.forEach((filter) => {
			if (filter.default !== undefined) {
				initialValues[filter.id] = filter.default
			}
		})
	})
	return initialValues
}

// Синхронизация с URL
const getFiltersFromUrl = (): Partial<ProductFilters> => {
	if (typeof window === 'undefined') return {}

	const params = new URLSearchParams(window.location.search)
	const filters: Partial<ProductFilters> = {}

	// Search
	const search = params.get('search')
	if (search) filters.search = search

	// Category
	const category = params.get('category')
	if (category) filters.category = category

	// Brand
	const brand = params.get('brand')
	if (brand) filters.brand = brand

	// Sport type
	const sport = params.get('sport')
	if (sport) filters.sport = sport

	// Price range
	const minPrice = params.get('minPrice')
	const maxPrice = params.get('maxPrice')
	if (minPrice) filters.minPrice = Number(minPrice)
	if (maxPrice) filters.maxPrice = Number(maxPrice)

	return filters
}

const updateUrl = (filters: Partial<ProductFilters>) => {
	if (typeof window === 'undefined') return

	const params = new URLSearchParams(window.location.search)

	// Удаляем все фильтры из URL
	params.delete('search')
	params.delete('category')
	params.delete('brand')
	params.delete('sport')
	params.delete('minPrice')
	params.delete('maxPrice')

	// Добавляем новые фильтры
	if (filters.search) params.set('search', filters.search)
	if (filters.category) params.set('category', filters.category)
	if (filters.brand) params.set('brand', filters.brand)
	if (filters.sport) params.set('sport', filters.sport)
	if (filters.minPrice !== undefined)
		params.set('minPrice', filters.minPrice.toString())
	if (filters.maxPrice !== undefined)
		params.set('maxPrice', filters.maxPrice.toString())

	// Обновляем URL без перезагрузки страницы
	const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
	window.history.pushState({}, '', newUrl)
}

export const useFiltersStore = create<FilterStoreState>()(
	devtools(
		(set, get) => ({
			filterValues: getInitialFilterValues(),
			appliedFilters: {},
			hasUnsavedChanges: false,

			setFilterValue: (filterId: string, value: FilterValues[string]) => {
				set(
					(state) => ({
						filterValues: {
							...state.filterValues,
							[filterId]: value,
						},
						hasUnsavedChanges: true,
					}),
					false,
					'setFilterValue'
				)
			},

		setFilterValues: (values: FilterValues) => {
			set(() => ({
				filterValues: values,
				hasUnsavedChanges: true,
					}),
					false,
					'setFilterValues'
				)
			},

			applyFilters: () => {
				const { filterValues } = get()
				const productFilters = filterValuesToProductFilters(filterValues)

				set(
					(state) => {
						const newAppliedFilters = {
							...state.appliedFilters,
							...productFilters,
						}

						// Синхронизируем с URL
						updateUrl(newAppliedFilters)

						return {
							appliedFilters: newAppliedFilters,
							hasUnsavedChanges: false,
						}
					},
					false,
					'applyFilters'
				)
			},

			resetFilters: () => {
				const initialValues = getInitialFilterValues()
				set(
					{
						filterValues: initialValues,
						hasUnsavedChanges: false,
					},
					false,
					'resetFilters'
				)
			},

			clearFilters: () => {
				const initialValues = getInitialFilterValues()
				set(
					{
						filterValues: initialValues,
						appliedFilters: {},
						hasUnsavedChanges: false,
					},
					false,
					'clearFilters'
				)
				// Очищаем URL
				updateUrl({})
			},

			updateAppliedFilters: (filters: Partial<ProductFilters>) => {
				set(
					(state) => {
						// Создаем новый объект фильтров
						const newAppliedFilters: Partial<ProductFilters> = {
							...state.appliedFilters,
						}

						// Обновляем или удаляем фильтры
						;(Object.keys(filters) as Array<keyof ProductFilters>).forEach(
							(filterKey) => {
								const value = filters[filterKey]
								// Если значение undefined, удаляем ключ
								if (value === undefined) {
									delete newAppliedFilters[filterKey]
								} else {
									// Используем Record для безопасного присваивания
									;(newAppliedFilters as Record<string, unknown>)[filterKey as string] = value
								}
							}
						)

						updateUrl(newAppliedFilters)
						return {
							appliedFilters: newAppliedFilters,
						}
					},
					false,
					'updateAppliedFilters'
				)
			},

			syncFromUrl: () => {
				const urlFilters = getFiltersFromUrl()
				if (Object.keys(urlFilters).length > 0) {
					const currentState = get()
					// Восстанавливаем appliedFilters из URL
					const newAppliedFilters = urlFilters
					// Восстанавливаем filterValues из appliedFilters для синхронизации UI
					const restoredFilterValues = productFiltersToFilterValues(
						newAppliedFilters,
						currentState.filterValues
					)

					set(
						{
							appliedFilters: newAppliedFilters,
							filterValues: restoredFilterValues,
							hasUnsavedChanges: false, // Фильтры уже применены (из URL)
						},
						false,
						'syncFromUrl'
					)
				}
			},

			syncToUrl: () => {
				const { appliedFilters } = get()
				updateUrl(appliedFilters)
			},
		}),
		{
			name: 'FiltersStore',
		}
	)
)
