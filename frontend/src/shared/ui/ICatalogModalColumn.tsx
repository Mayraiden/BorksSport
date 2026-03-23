'use client'

import Link from 'next/link'
import { ICatalogModalLink } from './ICatalogModalLink'
import type { MainCategory } from '@/features/Filters/api/categoryApi'

type ICatalogModalColumnProps = {
	title: string
	categories: MainCategory[]
	level: number
	selectedPath: MainCategory[]
	onCategoryClick: (
		category: MainCategory,
		level: number,
		e: React.MouseEvent
	) => void
	onCategoryHover?: (
		category: MainCategory,
		level: number,
		e: React.MouseEvent
	) => void
	onClose?: () => void
}

export const ICatalogModalColumn = ({
	title,
	categories,
	level,
	selectedPath,
	onCategoryClick,
	onCategoryHover,
	onClose,
}: ICatalogModalColumnProps) => {
	// Определяем, какая категория выбрана на этом уровне
	const selectedCategory = selectedPath[level]

	return (
		<div className="p-3 sm:p-5 border-r border-inherit last:border-r-0 flex flex-col h-full min-h-0 overflow-hidden">
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
				{title && <h1 className="mb-5 text-base font-bold">{title}</h1>}
				<ul className="flex flex-col gap-1 pr-1">
					{categories.map((category) => {
						const isSelected = selectedCategory?.id === category.id
						const hasChildren = category.children && category.children.length > 0

						// Определяем href в зависимости от уровня
						let href = '/catalog'
						if (level === 0) {
							href = `/catalog?sport=${encodeURIComponent(category.name)}`
						} else if (level === 1) {
							href = `/catalog?category=${encodeURIComponent(category.name)}`
						} else if (level === 2) {
							href = `/catalog?brand=${encodeURIComponent(category.name)}`
						} else {
							href = `/catalog?category=${encodeURIComponent(category.name)}`
						}

						return (
							<li key={category.id}>
								<ICatalogModalLink
									href={href}
									text={category.name}
									isSelected={isSelected}
									hasChildren={hasChildren}
									onClick={(e) => {
										if (hasChildren) {
											// Если есть дети, показываем их в следующей колонке
											onCategoryClick(category, level, e)
										}
										// Если нет детей, Link сам перейдет в каталог и закроет модалку
									}}
									onMouseEnter={(e) => {
										if (hasChildren && onCategoryHover) {
											// При наведении раскрываем подкатегории
											onCategoryHover(category, level, e)
										}
									}}
									onClose={onClose}
								/>
							</li>
						)
					})}
				</ul>
			</div>
			{/* Кнопка только для первой колонки (level 0) */}
			{level === 0 && onClose && (
				<div className="mt-auto pt-4">
					<Link
						className="h-10 py-4 px-4 flex items-center justify-center bg-burgundy text-white rounded-md hover:bg-burgundy/90 transition-colors text-sm sm:text-base"
						href={'/catalog'}
						onClick={onClose}
					>
						смотреть все товары
					</Link>
				</div>
			)}
		</div>
	)
}
