'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FilterSection } from '@features/Filters/ui/FiltersSection'
import { FILTERS_CONFIG } from '@features/Filters/config/filter.config'
import { useFilters } from '@features/Filters/lib/hooks'
import { useMainCategories, useCategoriesByLevel } from '@features/Filters/lib/useCategories'
import type { FilterSection as FilterSectionType } from '@shared/types/filters.types'
import type { ApiResponse } from '@shared/types'

import './Filters.css'

type FiltersProps = {
	isMobile?: boolean
	onApply?: () => void
}

export const Filters = ({ isMobile = false, onApply }: FiltersProps) => {
	const {
		filterValues,
		hasUnsavedChanges,
		setFilterValues,
		applyFilters,
		clearFilters,
	} = useFilters()

	// Получаем категории по уровням:
	// level 0: Виды спорта (основные категории)
	// level 1: Категории товаров (сумки, мячи и т.д.)
	// level 2: Бренды
	const { data: sportTypes } = useMainCategories() // level 0
	const selectedSports = Array.isArray(filterValues.sports) ? filterValues.sports : []
	const { data: productCategories } = useCategoriesByLevel(
		1,
		'productType',
		selectedSports.length > 0 ? selectedSports : undefined
	) // level 1
	const { data: brands } = useCategoriesByLevel(2, 'brand') // level 2

	const selectedCategories = Array.isArray(filterValues.categories)
		? filterValues.categories
		: []
	const selectedBrands = Array.isArray(filterValues.brands) ? filterValues.brands : []

	const API_URL =
		process.env.NEXT_PUBLIC_STRAPI_URL ||
		process.env.NEXT_STRAPI_URL ||
		'http://localhost:1337'

	const { data: colorSizeOptions } = useQuery({
		queryKey: [
			'products',
			'filter-options',
			selectedSports.slice().sort().join('|'),
			selectedCategories.slice().sort().join('|'),
			selectedBrands.slice().sort().join('|'),
		],
		queryFn: async () => {
			const params = new URLSearchParams()
			if (selectedSports.length > 0) params.set('sport', selectedSports.join(','))
			if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','))
			if (selectedBrands.length > 0) params.set('brand', selectedBrands.join(','))

			const qs = params.toString()
			const url = `${API_URL}/api/products/filter-options${qs ? `?${qs}` : ''}`

			const response = await fetch(url)
			if (!response.ok) {
				throw new Error(`Failed to fetch filter options: ${response.status}`)
			}

			const data: ApiResponse<{ colors: string[]; sizes: string[] }> = await response.json()
			if (!data.success) {
				throw new Error('Failed to fetch filter options')
			}

			return data.data
		},
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		refetchOnWindowFocus: false,
	})

	// Очищаем старые значения фильтров при загрузке новых данных
	useEffect(() => {
		// Очистка старых значений категорий (level 1)
		if (
			productCategories &&
			productCategories.length > 0 &&
			filterValues.categories
		) {
			const validCategories = productCategories.map((cat) => cat.name)
			const currentCategories = Array.isArray(filterValues.categories) ? filterValues.categories : []
			const validSelectedCategories = currentCategories.filter((cat: string) => validCategories.includes(cat))

			if (validSelectedCategories.length !== currentCategories.length) {
				setFilterValues({
					...filterValues,
					categories: validSelectedCategories,
				})
			}
		}

		// Очистка старых значений видов спорта (level 0)
		if (
			sportTypes &&
			sportTypes.length > 0 &&
			filterValues.sports
		) {
			const validSports = sportTypes.map((cat) => cat.name)
			const currentSports = Array.isArray(filterValues.sports) ? filterValues.sports : []
			const validSelectedSports = currentSports.filter((sport: string) => validSports.includes(sport))

			if (validSelectedSports.length !== currentSports.length) {
				setFilterValues({
					...filterValues,
					sports: validSelectedSports,
				})
			}
		}

		// Очистка старых значений брендов (level 2)
		if (
			brands &&
			brands.length > 0 &&
			filterValues.brands
		) {
			const validBrands = brands.map((cat) => cat.name)
			const currentBrands = Array.isArray(filterValues.brands) ? filterValues.brands : []
			const validSelectedBrands = currentBrands.filter((brand: string) => validBrands.includes(brand))

			if (validSelectedBrands.length !== currentBrands.length) {
				setFilterValues({
					...filterValues,
					brands: validSelectedBrands,
				})
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [productCategories, sportTypes, brands])

	// Динамически обновляем конфиг с данными из API
	const filtersConfig = useMemo(() => {
		// Преобразуем виды спорта (level 0) в формат фильтров
		const sportTypeOptions = sportTypes
			? sportTypes.map((category) => ({
					value: category.name,
					label: category.name,
					id: category.id,
				}))
			: []

		// Преобразуем категории товаров (level 1) в формат фильтров
		const categoryOptions = productCategories
			? productCategories.map((category) => ({
					value: category.name,
					label: category.name,
					id: category.id,
				}))
			: []

		// Преобразуем бренды (level 2) в формат фильтров с дедупликацией
		const brandOptions = brands
			? (() => {
					// Нормализуем имена для дедупликации
					const normalizeName = (name: string) => {
						return name.trim().toLowerCase().replace(/\s+/g, ' ')
					}

					// Словарь для отслеживания уникальных брендов
					const uniqueBrandsMap = new Map<
						string,
						{ value: string; label: string; id: number }
					>()

					for (const category of brands) {
						const name = category.name || ''
						const normalizedName = normalizeName(name)

						// Если бренд с таким нормализованным именем уже есть, пропускаем
						if (!uniqueBrandsMap.has(normalizedName)) {
							uniqueBrandsMap.set(normalizedName, {
								value: name,
								label: name,
								id: category.id,
							})
						}
					}

					// Преобразуем Map в массив и сортируем по имени
					return Array.from(uniqueBrandsMap.values()).sort((a, b) => {
						return a.label.localeCompare(b.label, 'ru')
					})
				})()
			: []

		// Обновляем секции фильтров
		return FILTERS_CONFIG.map((section) => {
			// Обновляем секцию "Вид спорта"
			if (section.id === 'sportType') {
				return {
					...section,
					filters: section.filters.map((filter) => {
						if (filter.id === 'sports') {
							return {
								...filter,
								options: sportTypeOptions,
							}
						}
						return filter
					}),
				}
			}

			// Обновляем секцию "Категория"
			if (section.id === 'category') {
				return {
					...section,
					filters: section.filters.map((filter) => {
						if (filter.id === 'categories') {
							return {
								...filter,
								options: categoryOptions,
							}
						}
						return filter
					}),
				}
			}

			// Обновляем секцию "Бренд"
			if (section.id === 'brand') {
				return {
					...section,
					filters: section.filters.map((filter) => {
						if (filter.id === 'brands') {
							return {
								...filter,
								options: brandOptions,
							}
						}
						return filter
					}),
				}
			}

			// Обновляем секцию "Цвет"
			if (section.id === 'color') {
				return {
					...section,
					filters: section.filters.map((filter) => {
						if (filter.id === 'colors') {
							const options =
								colorSizeOptions?.colors?.map((v) => ({
									value: v,
									label: v,
								})) ?? []
							return {
								...filter,
								options,
							}
						}
						return filter
					}),
				}
			}

			// Обновляем секцию "Размер"
			if (section.id === 'size') {
				return {
					...section,
					filters: section.filters.map((filter) => {
						if (filter.id === 'sizes') {
							const options =
								colorSizeOptions?.sizes?.map((v) => ({
									value: v,
									label: v,
								})) ?? []
							return {
								...filter,
								options,
							}
						}
						return filter
					}),
				}
			}

			return section
		}) as FilterSectionType[]
	}, [sportTypes, productCategories, brands, colorSizeOptions])

	// Синхронизация при монтировании
	useEffect(() => {
		// Инициализация уже происходит в useFilters
	}, [])
	return (
		<aside
			className={`${
				isMobile
					? 'w-full h-full pt-3 p-4 bg-white flex flex-col'
					: 'sticky top-4 w-70 max-h-[calc(100vh-2rem)] pt-3 p-6 self-start shadow-lg bg-white flex flex-col max-sm:hidden'
			}`}
		>
			{/* <h2 className="text-xl font-bold mb-6 text-gray-900">ФИЛЬТРЫ</h2> */}

			<div className="flex-1 overflow-y-scroll space-y-2 filters-scroll min-h-0">
				<div className="filters-content">
					{filtersConfig.map((section) => (
						<FilterSection
							key={section.id}
							section={section}
							values={filterValues}
							onValuesChange={setFilterValues}
						/>
					))}
				</div>
			</div>

			{/* Fade-out эффект */}
			<div className="relative flex-shrink-0">
				<div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"></div>
			</div>

			{/* Фиксированные кнопки внизу */}
			<div className={`pt-4 space-y-3 flex-shrink-0 border-t border-gray-200 bg-white ${isMobile ? 'pb-safe pb-4' : ''}`}>
				<button
					onClick={() => {
						applyFilters()
						if (onApply) {
							onApply()
						}
					}}
					disabled={!hasUnsavedChanges}
					className={`w-full ${isMobile ? 'py-2.5 px-3 text-sm' : 'py-3 px-4'} rounded-md transition-colors duration-200 font-medium ${
						hasUnsavedChanges
							? 'bg-burgundy text-white hover:bg-burgundy/90'
							: 'bg-gray-300 text-gray-500 cursor-not-allowed'
					}`}
				>
					Показать
				</button>
				<button
					onClick={clearFilters}
					className={`w-full bg-white text-gray-700 ${isMobile ? 'py-2.5 px-3 text-sm' : 'py-3 px-4'} rounded-md border border-gray-300 hover:bg-gray-50 transition-colors duration-200 font-medium`}
				>
					Сбросить все фильтры
				</button>
			</div>
		</aside>
	)
}
