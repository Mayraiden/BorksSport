'use client'

import { useState } from 'react'
import type { Product } from '@/shared/types'
import { ProductSlider } from '@/shared/ui/ProductSlider'
import { ColorSelector } from '@/shared/ui/ColorSelector'
import { SizeSelector } from '@/shared/ui/SizeSelector'
import { BuyButton } from '@/shared/ui/BuyButton'
import { FavoriteButton } from '@/shared/ui/FavoriteButton'
import { ProductTabs } from '@/shared/ui/ProductTabs'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'

type ProductPageProps = {
	product: Product
	className?: string
}

export const ProductPage = ({ product, className = '' }: ProductPageProps) => {
	const [selectedColorId, setSelectedColorId] = useState(
		product.colors[0]?.id || undefined
	)
	const [selectedSizeId, setSelectedSizeId] = useState(
		product.sizes[0]?.id || undefined
	)

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price) + ' руб'
	}

	// Формируем breadcrumbs на основе категории товара
	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: 'Каталог', href: '/catalog' },
	]

	// Добавляем категории если есть в characteristics
	if (product.characteristics) {
		const category = product.characteristics['Категория']
		if (category && category !== 'Не указано') {
			breadcrumbItems.push({
				label: category,
				href: `/catalog?category=${encodeURIComponent(category)}`,
			})
		}

		const brand = product.brand || product.characteristics['Бренд']
		if (
			brand &&
			brand !== 'Не указано' &&
			brand !== product.characteristics['Категория']
		) {
			breadcrumbItems.push({
				label: brand,
				href: `/catalog?brand=${encodeURIComponent(brand)}`,
			})
		}
	}

	// Добавляем название товара в конце
	breadcrumbItems.push({ label: product.name, href: `#` })

	const handleAddToCart = () => {
		// Обработчик вызывается после успешного добавления в корзину
		// Логика добавления реализована в BuyButton
	}

	return (
		<div
			className={`w-full max-w-[1280px] mx-auto px-[60px] pt-5 pb-[60px] ${className}`}
		>
			{/* Breadcrumbs */}
			<Breadcrumbs items={breadcrumbItems} className="mb-5" />

			{/* Main product section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
				{/* Product images */}
				<div className="w-full">
					<ProductSlider images={product.images} />
				</div>

				{/* Product details */}
				<div className="flex flex-col gap-10 p-5 bg-transparent">
					{/* Product info - верхний блок с артикулом, названием, брендом и ценой */}
					<div className="flex flex-col gap-4">
						{/* Артикул, название, бренд */}
						<div className="flex flex-col gap-4">
							<p className="text-base font-normal leading-[1.3125] text-[#121212]">
								Артикул: {product.article}
							</p>
							<h1 className="text-2xl font-bold leading-[1.4] text-[#121212]">
								{product.name}
							</h1>
							<p className="text-base font-normal leading-[1.3125] text-[#A0A4A8]">
								{product.brand}
							</p>
						</div>

						{/* Цена - сразу после бренда, рядом со слайдером */}
						<div className="flex justify-start">
							<p className="text-2xl font-bold leading-[0.875] text-[#7B1931]">
								{formatPrice(product.price)}
							</p>
						</div>
					</div>

					{/* Color selection - показываем только если есть цвета */}
					{product.colors.length > 0 && (
						<ColorSelector
							colors={product.colors}
							selectedColorId={selectedColorId}
							onColorChange={setSelectedColorId}
						/>
					)}

					{/* Size selection - показываем только если есть размеры */}
					{product.sizes.length > 0 && (
						<SizeSelector
							sizes={product.sizes}
							selectedSizeId={selectedSizeId}
							onSizeChange={setSelectedSizeId}
						/>
					)}

					{/* Action buttons */}
					<div className="flex items-center gap-4">
						<BuyButton
							variant="product-page"
							type="button"
							text="Добавить в корзину"
							productId={product.id}
							onClick={handleAddToCart}
							className="flex-1"
						/>
						<FavoriteButton
							productId={product.id}
							checkOnMount={true}
							className="w-11 h-11 flex items-center justify-center bg-[#F2E8EA] rounded-md hover:bg-[#F2E8EA]/80 transition-colors"
						/>
					</div>
				</div>
			</div>

			{/* Product tabs */}
			<ProductTabs product={product} />
		</div>
	)
}
