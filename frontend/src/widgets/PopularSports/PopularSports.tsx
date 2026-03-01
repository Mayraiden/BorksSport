'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useMainCategories } from '@/features/Filters/lib/useCategories'
import { getCategoryImage } from '@/shared/helpers/categoryImageMap'

export const PopularSports = () => {
	const { data: categories, isLoading, error } = useMainCategories()
	const uniqueCategories = useMemo(() => {
		if (!categories) return []
		const seen = new Set<string>()
		return categories.filter((category) => {
			const key = (category.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
			if (!key || seen.has(key)) {
				return false
			}
			seen.add(key)
			return true
		})
	}, [categories])

	// Определяем классы контейнера в зависимости от количества категорий
	const containerClasses = useMemo(() => {
		if (!uniqueCategories || uniqueCategories.length === 0) return ''

		const count = uniqueCategories.length

		if (count <= 2) {
			// 1-2 элемента: большие карточки по центру с ограничением ширины
			return 'flex flex-wrap justify-center gap-3 max-sm:gap-3'
		} else if (count <= 5) {
			// 3-5 элементов: адаптивная сетка с оптимальным количеством колонок
			if (count === 3) {
				return 'grid grid-cols-1 md:grid-cols-3 gap-3 max-sm:gap-3'
			} else if (count === 4) {
				return 'grid grid-cols-2 md:grid-cols-4 gap-3 max-sm:gap-3'
			} else {
				// 5 элементов
				return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-sm:gap-3'
			}
		} else {
			// 6+ элементов: стандартная сетка
			return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-sm:gap-3'
		}
	}, [uniqueCategories])

	// Определяем классы карточек в зависимости от количества
	const cardClasses = useMemo(() => {
		if (!uniqueCategories || uniqueCategories.length === 0) return ''

		const count = uniqueCategories.length
		const baseClasses = 'h-59 pb-5 flex bg-center bg-no-repeat bg-cover rounded-lg overflow-hidden transition-transform duration-300 ease-in-out hover:scale-105 max-sm:h-40'

		if (count <= 2) {
			// 1-2 элемента: большие карточки с ограничением максимальной ширины
			return `${baseClasses} w-full max-w-[400px]`
		} else {
			// 3+ элементов: стандартные карточки
			return baseClasses
		}
	}, [uniqueCategories])

	if (isLoading) {
		return (
			<section className="w-full px-20 pt-15 max-sm:px-2 max-sm:pt-4">
				<h2 className="text-3xl font-bold mb-5 max-sm:text-2xl">
					Популярные виды спорта
				</h2>
				<div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-sm:gap-3">
					{Array.from({ length: 5 }).map((_, index) => (
						<div
							key={index}
							className="h-59 bg-gray/20 rounded-lg animate-pulse max-sm:h-40"
						/>
					))}
				</div>
			</section>
		)
	}

	if (error || !uniqueCategories || uniqueCategories.length === 0) {
		return null
	}

	return (
		<section className="w-full px-20 pt-15 max-sm:px-2 max-sm:pt-4">
			<h2 className="text-3xl font-bold mb-5 max-sm:text-2xl">
				Популярные виды спорта
			</h2>

			<ul className={`w-full ${containerClasses} text-[#f5f5f5]`}>
				{uniqueCategories.map((category) => {
					const imageUrl = getCategoryImage(category.name)
					const catalogUrl = `/catalog?sport=${encodeURIComponent(category.name)}`

					return (
						<li
							key={category.id}
							className={cardClasses}
							style={{ backgroundImage: `url('${imageUrl}')` }}
						>
							<Link
								href={catalogUrl}
								className="w-full h-full text-center flex justify-center"
							>
								<div className="self-end">{category.name}</div>
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
