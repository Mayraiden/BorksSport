'use client'

import { memo, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/shared/types'

import { BuyButton } from './BuyButton'
import { FavoriteButton } from './FavoriteButton'

type ItemCardProps = {
	product?: Product
	onClick?: () => void
	className?: string
	checkFavoriteOnMount?: boolean // Флаг для проверки статуса избранного при загрузке (по умолчанию true)
	isFavorite?: boolean // Начальное состояние избранного (для страницы избранного)
	onFavoriteToggle?: () => void // Callback при изменении избранного (для обновления списка на странице избранного)
}

// Memoized ItemCard for better performance with large lists
export const ItemCard = memo<ItemCardProps>(
	({
		product,
		onClick,
		className = '',
		checkFavoriteOnMount = true, // По умолчанию проверяем статус избранного
		isFavorite = false,
		onFavoriteToggle,
	}) => {
		// Fallback data for development
		const fallbackProduct: Product = {
			id: '1',
			article: 'XXXXXX',
			name: 'Название товара',
			brand: 'Бренд',
			price: 19990,
			images: [{ id: '1', url: '/NoProductImage.jpg', alt: 'картинка товара' }],
			colors: [],
			sizes: [],
		}

		const displayProduct = product || fallbackProduct

		// Состояние для обработки ошибок загрузки изображений
		const [imageError, setImageError] = useState(false)

		// Memoize expensive calculations
		const mainImage = useMemo(
			() =>
				displayProduct.images[0] || {
					url: '/NoProductImage.jpg',
					alt: 'картинка товара',
				},
			[displayProduct.images]
		)

		// Определяем, нужно ли использовать unoptimized для api.sbis.ru
		const isSbisImage = mainImage.url.includes('api.sbis.ru')
		const imageSrc = imageError ? '/NoProductImage.jpg' : mainImage.url

		const formattedPrice = useMemo(
			() =>
				new Intl.NumberFormat('ru-RU').format(displayProduct.price) + ' руб',
			[displayProduct.price]
		)

		const productUrl = useMemo(
			() => `/product/${displayProduct.id}`,
			[displayProduct.id]
		)

		return (
			<div
				className={`w-full min-w-50 flex flex-col bg-white shadow-md hover:shadow-lg transition-shadow duration-200 max-sm:w-59 ${className}`}
			>
				<Link href={productUrl} onClick={onClick} className="block">
					<div className="relative">
						<Image
							className="w-full h-64 object-contain"
							src={imageSrc}
							width={236}
							height={256}
							alt={mainImage.alt}
							priority={false} // Don't prioritize images in grid
							loading="lazy" // Lazy load images
							sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
							unoptimized={isSbisImage} // Отключаем оптимизацию для api.sbis.ru чтобы избежать 404 ошибок
							onError={() => {
								// Fallback на дефолтное изображение при ошибке загрузки
								if (!imageError) {
									setImageError(true)
								}
							}}
						/>
					</div>
				</Link>
				<div className="w-full flex flex-col gap-1 p-3 flex-1">
					{/* Название товара - всегда фиксированная высота */}
					<Link
						href={productUrl}
						onClick={onClick}
						className="hover:text-burgundy transition-colors duration-200"
					>
						<h3 className="text-base font-bold line-clamp-2 min-h-[2.5rem]">
							{displayProduct.name}
						</h3>
					</Link>
					{/* Категория - всегда на одном месте */}
					<p className="text-gray text-sm">{displayProduct.brand}</p>
					{/* Цена - всегда на одном месте */}
					<p className="text-base font-normal text-black">{formattedPrice}</p>
					<div className="w-full flex justify-between items-center mt-auto">
						<BuyButton
							className="w-30 h-8 flex items-center justify-center rounded-sm text-white bg-burgundy cursor-pointer"
							type="button"
							text="В корзину"
							productId={displayProduct.id}
						/>
						<FavoriteButton
							productId={displayProduct.id}
							checkOnMount={checkFavoriteOnMount}
							initialFavorite={isFavorite}
							onToggle={onFavoriteToggle}
						/>
					</div>
				</div>
			</div>
		)
	}
)

ItemCard.displayName = 'ItemCard'
