import { useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFiltersStore } from '../model/store'
import { useSearch } from '@/shared/lib/contexts/SearchContext'
import { productKeys } from '@/features/Product/lib/queries'
import type { ProductFilters } from '@/shared/types'

/**
 * Хук для работы с фильтрами продуктов
 * Объединяет Zustand store и SearchContext для единого интерфейса
 */
export const useFilters = () => {
	// Используем селекторы для получения только нужных частей состояния
	const filterValues = useFiltersStore((state) => state.filterValues)
	const appliedFilters = useFiltersStore((state) => state.appliedFilters)
	const hasUnsavedChanges = useFiltersStore((state) => state.hasUnsavedChanges)
	const setFilterValue = useFiltersStore((state) => state.setFilterValue)
	const setFilterValues = useFiltersStore((state) => state.setFilterValues)
	const applyFiltersStore = useFiltersStore((state) => state.applyFilters)
	const resetFilters = useFiltersStore((state) => state.resetFilters)
	const clearFiltersStore = useFiltersStore((state) => state.clearFilters)
	const syncFromUrl = useFiltersStore((state) => state.syncFromUrl)

	const queryClient = useQueryClient()
	const updateAppliedFiltersStore = useFiltersStore(
		(state) => state.updateAppliedFilters
	)
	const { debouncedSearchQuery, updateFilters: updateSearchFilters } =
		useSearch()

	// Синхронизируем с URL при загрузке страницы для восстановления состояния
	useEffect(() => {
		syncFromUrl()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Восстанавливаем фильтры из URL при монтировании

	// Объединение фильтров: поиск из SearchContext + фильтры из store
	const combinedFilters = useMemo((): ProductFilters => {
		return {
			...appliedFilters,
			search: debouncedSearchQuery || undefined,
		}
	}, [appliedFilters, debouncedSearchQuery])

	// Применение фильтров с инвалидацией React Query
	const applyFilters = useCallback(() => {
		applyFiltersStore()

		// Инвалидируем кеш продуктов для перезагрузки с новыми фильтрами
		// SearchContext будет автоматически синхронизирован через combinedFilters
		queryClient.invalidateQueries({ queryKey: productKeys.all })
	}, [applyFiltersStore, queryClient])

	// Обновление примененных фильтров (используется в FilterCloud)
	const updateAppliedFilters = useCallback(
		(filters: Partial<ProductFilters>) => {
			updateAppliedFiltersStore(filters)
			// Инвалидируем кеш для перезагрузки товаров
			queryClient.invalidateQueries({ queryKey: productKeys.all })
		},
		[updateAppliedFiltersStore, queryClient]
	)

	// Очистка всех фильтров
	const clearAllFilters = useCallback(() => {
		clearFiltersStore()
		updateSearchFilters({})
		// Инвалидируем кеш
		queryClient.invalidateQueries({ queryKey: productKeys.all })
	}, [clearFiltersStore, updateSearchFilters, queryClient])

	return {
		// Состояние
		filterValues,
		appliedFilters: combinedFilters,
		hasUnsavedChanges,

		// Действия
		setFilterValue,
		setFilterValues,
		applyFilters,
		resetFilters,
		clearFilters: clearAllFilters,
		updateAppliedFilters,
	}
}

/**
 * Хук для синхронизации фильтров с URL при изменении роутинга
 */
export const useFiltersSync = () => {
	const syncFromUrl = useFiltersStore((state) => state.syncFromUrl)

	useEffect(() => {
		// Синхронизация при изменении URL (например, при использовании браузерных кнопок назад/вперед)
		const handlePopState = () => {
			syncFromUrl()
		}

		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [syncFromUrl])
}
