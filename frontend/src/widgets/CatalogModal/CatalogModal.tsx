'use client'

import { useState, useMemo, useEffect } from 'react'
import { ICatalogModalColumn } from '@/shared/ui/ICatalogModalColumn'
import Link from 'next/link'
import { useMainCategories } from '@/features/Filters/lib/useCategories'
import type { MainCategory } from '@/features/Filters/api/categoryApi'

type ICatalogModalProps = {
	isOpen: boolean
	onClose: () => void
}

type SelectedCategoryPath = MainCategory[]

export const CatalogModal = ({ isOpen, onClose }: ICatalogModalProps) => {
	const { data: mainCategories, isLoading } = useMainCategories()
	const [selectedPath, setSelectedPath] = useState<SelectedCategoryPath>([])

	// Блокируем прокрутку страницы, пока открыта модалка каталога.
	useEffect(() => {
		if (!isOpen) return

		const scrollY = window.scrollY
		const originalOverflow = document.body.style.overflow
		const originalPosition = document.body.style.position
		const originalTop = document.body.style.top
		const originalWidth = document.body.style.width

		document.body.style.overflow = 'hidden'
		document.body.style.position = 'fixed'
		document.body.style.top = `-${scrollY}px`
		document.body.style.width = '100%'

		return () => {
			document.body.style.overflow = originalOverflow
			document.body.style.position = originalPosition
			document.body.style.top = originalTop
			document.body.style.width = originalWidth
			window.scrollTo(0, scrollY)
		}
	}, [isOpen])

	// Сбрасываем путь при закрытии модалки
	const handleClose = () => {
		setSelectedPath([])
		onClose()
	}

	// Обработчик клика по категории
	const handleCategoryClick = (
		category: MainCategory,
		level: number,
		e: React.MouseEvent
	) => {
		e.preventDefault()
		// Обрезаем путь до текущего уровня и добавляем новую категорию
		const newPath = selectedPath.slice(0, level)
		newPath[level] = category
		setSelectedPath(newPath)
	}

	// Обработчик наведения на категорию
	const handleCategoryHover = (
		category: MainCategory,
		level: number,
		e: React.MouseEvent
	) => {
		// Обрезаем путь до текущего уровня и добавляем новую категорию
		const newPath = selectedPath.slice(0, level)
		newPath[level] = category
		setSelectedPath(newPath)
	}

	// Формируем колонки на основе выбранного пути
	const columns = useMemo(() => {
		const result: Array<{
			title: string
			categories: MainCategory[]
			level: number
		}> = []

		// Колонка 1: главные категории (level 0)
		if (mainCategories && mainCategories.length > 0) {
			result.push({
				title: 'Виды спорта',
				categories: mainCategories,
				level: 0,
			})
		}

		// Последующие колонки: подкатегории выбранных категорий
		for (let i = 0; i < selectedPath.length; i++) {
			const selectedCategory = selectedPath[i]
			if (selectedCategory?.children && selectedCategory.children.length > 0) {
				result.push({
					title: selectedCategory.name,
					categories: selectedCategory.children,
					level: i + 1,
				})
			}
		}

		return result
	}, [mainCategories, selectedPath])

	if (!isOpen) return null

	return (
		<>
			{/* Overlay для закрытия по клику вне модала */}
			<div className="fixed inset-0 bg-black/20 z-[100]" onClick={handleClose} style={{ WebkitBackfaceVisibility: 'visible', backfaceVisibility: 'visible' }} />

			<aside className="fixed left-0 right-0 top-20 w-screen h-[calc(100vh-5rem)] min-h-[420px] p-3 sm:p-4 bg-white shadow-lg z-[101] overflow-hidden" style={{ WebkitBackfaceVisibility: 'visible', backfaceVisibility: 'visible' }}>
				<div className="h-full border border-gray/20 grid overflow-hidden grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
					{isLoading ? (
						<div className="col-span-full p-5 text-center text-gray">
							Загрузка категорий...
						</div>
					) : columns.length === 0 ? (
						<div className="col-span-full p-5 text-center text-gray">
							Категории не найдены
						</div>
					) : (
						columns.map((column, index) => (
							<ICatalogModalColumn
								key={`column-${column.level}-${index}`}
								title={column.title}
								categories={column.categories}
								level={column.level}
								selectedPath={selectedPath}
								onCategoryClick={handleCategoryClick}
								onCategoryHover={handleCategoryHover}
								onClose={handleClose}
							/>
						))
					)}
				</div>
			</aside>
		</>
	)
}
