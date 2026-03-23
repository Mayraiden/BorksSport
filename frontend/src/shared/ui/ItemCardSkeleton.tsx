'use client'

import { memo } from 'react'

type ItemCardSkeletonProps = {
	className?: string
}

export const ItemCardSkeleton = memo<ItemCardSkeletonProps>(
	({ className = '' }) => {
		return (
			<div
				className={`w-full min-w-0 flex flex-col bg-white shadow-md ${className}`}
			>
				{/* Изображение */}
				<div className="relative overflow-hidden h-[236px] bg-gray/20 animate-pulse" />

				{/* Контент */}
				<div className="w-full min-w-0 flex flex-col gap-1 p-3 flex-1">
					{/* Название товара - фиксированная высота на 2 строки */}
					<div className="h-12 flex flex-col justify-center gap-1">
						<div className="h-4 bg-gray/20 rounded animate-pulse w-full" />
						<div className="h-4 bg-gray/20 rounded animate-pulse w-3/4" />
					</div>

					{/* Бренд */}
					<div className="h-3 bg-gray/20 rounded animate-pulse w-1/3" />

					{/* Цена */}
					<div className="h-4 bg-gray/20 rounded animate-pulse w-1/2" />

					{/* Кнопки */}
					<div className="w-full min-w-0 flex justify-between items-center mt-auto gap-2">
						{/* Кнопка "В корзину" */}
						<div className="w-30 h-8 bg-gray/20 rounded-sm animate-pulse flex-shrink-0" />

						{/* Кнопка избранного */}
						<div className="w-8 h-8 bg-gray/20 rounded animate-pulse" />
					</div>
				</div>
			</div>
		)
	}
)

ItemCardSkeleton.displayName = 'ItemCardSkeleton'
