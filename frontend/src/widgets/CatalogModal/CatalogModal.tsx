'use client'

import { useState, useMemo } from 'react'
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
			<div className="fixed inset-0 bg-black/20 z-40" onClick={handleClose} />

			<aside className="absolute left-0 top-20 w-screen min-h-3/4 p-5 flex flex-col justify-between bg-white shadow-lg z-50">
				<div className="h-full grid grid-cols-6 border border-gray/20">
					{isLoading ? (
						<div className="col-span-6 p-5 text-center text-gray">
							Загрузка категорий...
						</div>
					) : columns.length === 0 ? (
						<div className="col-span-6 p-5 text-center text-gray">
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
								onClose={handleClose}
							/>
						))
					)}
				</div>
				<div className="flex gap-5 items-center">
					<Link
						className="h-10 py-4 px-6 flex items-center border-1 border-gray/20 rounded-md hover:bg-alt-white transition-colors"
						href={'/catalog'}
						onClick={handleClose}
					>
						смотреть все товары
					</Link>
				</div>
			</aside>
		</>
	)
}
