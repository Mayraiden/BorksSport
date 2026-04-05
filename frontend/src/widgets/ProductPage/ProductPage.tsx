'use client'

import { useState, useMemo, useEffect } from 'react'
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
	const currentColor = product.color || product.colors[0]?.name

	const [selectedColorId, setSelectedColorId] = useState(
		product.colors.find((c) => c.name === currentColor)?.id ||
			product.colors[0]?.id ||
			undefined
	)
	const [selectedSizeId, setSelectedSizeId] = useState<string | undefined>(undefined)

	const allVariants = useMemo(() => {
		const variants = product.variants || []
		if (product.stock && product.stock > 0) {
			return [product, ...variants]
		}
		return variants
	}, [product])

	// Цвета — первичный селектор: показываем все цвета, у которых есть хотя бы один
	// вариант с stock > 0 (независимо от выбранного размера)
	const availableColors = useMemo(() => {
		return product.colors.filter((color) =>
			allVariants.some(
				(v) => v.color === color.name && v.stock && v.stock > 0
			)
		)
	}, [product.colors, allVariants])

	// Размеры — вторичный селектор: показываем только размеры, доступные для выбранного цвета
	const availableSizes = useMemo(() => {
		const selectedColor = product.colors.find((c) => c.id === selectedColorId)
		if (!selectedColor) return product.sizes

		return product.sizes.filter((size) =>
			allVariants.some(
				(v) =>
					v.color === selectedColor.name &&
					v.size === size.value &&
					v.stock &&
					v.stock > 0
			)
		)
	}, [product, selectedColorId, allVariants])

	// При смене цвета: если текущий размер недоступен для нового цвета — выбираем первый доступный
	useEffect(() => {
		const currentSizeStillAvailable = availableSizes.some(
			(s) => s.id === selectedSizeId
		)
		if (!currentSizeStillAvailable && availableSizes.length > 0) {
			setSelectedSizeId(availableSizes[0].id)
		}
	}, [selectedColorId, availableSizes, selectedSizeId])

	const selectedVariant = useMemo(() => {
		if (!product.variants || product.variants.length === 0) {
			return product
		}

		const selectedColor = product.colors.find((c) => c.id === selectedColorId)
		const selectedSize = product.sizes.find((s) => s.id === selectedSizeId)

		const matchingVariant = allVariants.find((variant) => {
			const colorMatch = selectedColor
				? variant.color === selectedColor.name
				: !variant.color
			const sizeMatch = selectedSize
				? variant.size === selectedSize.value
				: !variant.size

			return colorMatch && sizeMatch && variant.stock && variant.stock > 0
		})

		return matchingVariant || product
	}, [product, selectedColorId, selectedSizeId, allVariants])

	const displayProduct = selectedVariant

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price) + ' руб'
	}

	// Обработчики изменения размера и цвета
	const handleColorChange = (colorId: string) => {
		setSelectedColorId(colorId)
	}

	const handleSizeChange = (sizeId: string) => {
		setSelectedSizeId(sizeId)
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
			className={`w-full max-w-[1280px] mx-auto px-[60px] pt-5 pb-[60px] max-sm:px-2 max-sm:pt-4 max-sm:pb-4 ${className}`}
		>
			{/* Breadcrumbs */}
			<Breadcrumbs items={breadcrumbItems} className="mb-5 max-sm:mb-2" />

			{/* Main product section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5 max-sm:gap-3 max-sm:mb-3">
				{/* Product images */}
				<div className="w-full">
					<ProductSlider images={displayProduct.images} />
				</div>

				{/* Product details */}
				<div className="flex flex-col gap-10 p-5 bg-transparent max-sm:gap-6 max-sm:p-0">
					{/* Product info - верхний блок с артикулом, названием, брендом и ценой */}
					<div className="flex flex-col gap-4 max-sm:gap-3">
						{/* Артикул, название, бренд */}
						<div className="flex flex-col gap-4 max-sm:gap-3">
							<p className="text-base font-normal leading-[1.3125] text-[#121212] max-sm:text-sm">
								Артикул: {displayProduct.article}
							</p>
							<h1 className="text-2xl font-bold leading-[1.4] text-[#121212] max-sm:text-xl">
								{displayProduct.name}
							</h1>
							<p className="text-base font-normal leading-[1.3125] text-[#A0A4A8] max-sm:text-sm">
								{displayProduct.brand}
							</p>
						</div>

						{/* Цена - сразу после бренда, рядом со слайдером */}
						<div className="flex flex-col gap-2">
							<p className="text-2xl font-bold leading-[0.875] text-[#7B1931] max-sm:text-xl">
								{formatPrice(displayProduct.price)}
							</p>
							{/* Остаток на складе */}
							{displayProduct.stock !== null && displayProduct.stock !== undefined && displayProduct.stock > 0 && (
								<p className="text-base text-gray max-sm:text-sm">
									Осталось: {displayProduct.stock} шт.
								</p>
							)}
						</div>
					</div>

					{/* Color selection - показываем только если есть цвета */}
					{product.colors.length > 0 && (
						<ColorSelector
							colors={product.colors}
							selectedColorId={selectedColorId}
							onColorChange={handleColorChange}
							availableColorIds={availableColors.map((c) => c.id)}
						/>
					)}

					{/* Size selection - показываем только если есть размеры */}
					{product.sizes.length > 0 && (
						<SizeSelector
							sizes={product.sizes}
							selectedSizeId={selectedSizeId}
							onSizeChange={handleSizeChange}
							availableSizeIds={availableSizes.map((s) => s.id)}
						/>
					)}

					{/* Action buttons */}
					<div className="flex items-center gap-4 max-sm:gap-3">
						<BuyButton
							variant="product-page"
							type="button"
							text="Добавить в корзину"
							productId={displayProduct.id}
							onClick={handleAddToCart}
							className="flex-1"
						/>
						<FavoriteButton
							productId={displayProduct.id}
							checkOnMount={true}
							className="w-11 h-11 flex items-center justify-center bg-[#F2E8EA] rounded-md hover:bg-[#F2E8EA]/80 transition-colors max-sm:w-10 max-sm:h-10"
						/>
					</div>
				</div>
			</div>

			{/* Product tabs */}
			<ProductTabs product={displayProduct} />
		</div>
	)
}
