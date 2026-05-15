'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TrashIcon } from '@phosphor-icons/react/ssr'
import { FavoriteButton } from './FavoriteButton'
import { cartApi, type CartItemDisplay } from '@/features/Cart/api/cartApi'
import { useAuthStore } from '@/features/Auth/model/store'
import { refreshCartCount } from '@/features/Cart/lib/useCartCount'

type CartItemCardProps = {
	cartItem: CartItemDisplay
	onUpdate?: () => void // Callback для обновления списка
	onRemove?: () => void // Callback для удаления
}

export const CartItemCard = ({
	cartItem,
	onUpdate,
	onRemove,
}: CartItemCardProps) => {
	const { jwt } = useAuthStore()
	const [isUpdating, setIsUpdating] = useState(false)
	const [imageError, setImageError] = useState(false)

	const product = cartItem.product
	const mainImage = product.images[0] || {
		url: '/NoProductImage.jpg',
		alt: product.name || 'Изображение товара',
	}

	const isSbisImage = 
		mainImage.url.includes('api.sbis.ru') || 
		mainImage.url.includes('disk.sbis.ru') ||
		mainImage.url.startsWith('/img?params=')
	const imageSrc = imageError ? '/NoProductImage.jpg' : mainImage.url

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price) + ' руб'
	}

	const handleQuantityChange = async (newQuantity: number) => {
		if (!jwt) return
		const max =
			typeof product.availableStock === 'number'
				? product.availableStock
				: typeof product.stock === 'number'
					? product.stock
					: undefined

		if (typeof max === 'number' && max > 0 && newQuantity > max) {
			return
		}

		// Если количество становится меньше 1 — удаляем товар из корзины
		if (newQuantity < 1) {
			await handleRemove()
			return
		}

		setIsUpdating(true)
		try {
			await cartApi.updateQuantity(cartItem.cartItemId, newQuantity, jwt)
			refreshCartCount(jwt)
			if (onUpdate) {
				onUpdate()
			}
		} catch (error) {
			// Best-effort: show a simple message without adding new UI libs.
			if (error instanceof Error) {
				alert(error.message)
			}
		} finally {
			setIsUpdating(false)
		}
	}

	const handleRemove = async () => {
		if (!jwt) return

		setIsUpdating(true)
		try {
			await cartApi.removeFromCart(cartItem.cartItemId, jwt)
			refreshCartCount(jwt)
			if (onRemove) {
				onRemove()
			}
		} catch {
		} finally {
			setIsUpdating(false)
		}
	}

	// Формируем строку атрибутов (размер и цвет)
	const attributes: string[] = []
	// TODO: Когда будут доступны размеры и цвета в API, добавить их сюда
	// Например: if (cartItem.size) attributes.push(cartItem.size)
	// Например: if (cartItem.color) attributes.push(cartItem.color)
	const attributesText = attributes.length > 0 ? attributes.join(' • ') : ''

	return (
		<div className="w-full flex flex-col sm:flex-row gap-3 max-sm:gap-2 p-5 max-sm:p-3 bg-white rounded-[4px]">
			{/* Изображение товара */}
			<Link
				href={`/product/${product.id}`}
				className="flex-shrink-0 w-full sm:w-[120px] h-[120px] max-sm:h-[200px] sm:h-[120px] relative rounded-[6px] overflow-hidden"
			>
				<Image
					src={imageSrc}
					alt={mainImage.alt}
					fill
					className="object-cover"
					sizes="(max-width: 640px) 100vw, 120px"
					unoptimized={isSbisImage} // Отключаем оптимизацию для api.sbis.ru чтобы избежать 404 ошибок
					onError={() => {
						if (!imageError) {
							setImageError(true)
						}
					}}
				/>
			</Link>

			{/* Информация о товаре */}
			<div className="flex-1 flex flex-col gap-3 max-sm:gap-2">
				{/* Название и атрибуты */}
				<div className="flex flex-col gap-3 max-sm:gap-2">
					<Link
						href={`/product/${product.id}`}
						className="text-base font-bold leading-[1.3125] text-[#121212] hover:text-[#7B1931] transition-colors max-sm:text-sm"
					>
						{product.name}
					</Link>
					{attributesText && (
						<p className="text-xs font-normal leading-[1.75] text-[#A0A4A8] max-sm:text-[10px]">
							{attributesText}
						</p>
					)}

					{/* Цена */}
					<div className="flex flex-col gap-2 max-sm:gap-1">
						{/* Если есть старая цена, показываем её зачеркнутой */}
						{/* TODO: Добавить поле oldPrice в Product, когда будет доступно */}
						{/* {product.oldPrice && product.oldPrice > product.price && (
							<p className="text-base font-normal leading-[1.3125] text-[#A0A4A8] line-through">
								{formatPrice(product.oldPrice)}
							</p>
						)} */}
						<p className="text-base font-bold leading-[1.3125] text-[#2A7D5A] max-sm:text-sm">
							{formatPrice(product.price)}
						</p>
					</div>
				</div>

				{/* Действия: избранное, удаление, количество */}
				<div className="flex items-center gap-2 max-sm:gap-1.5">
					{/* Кнопка избранного */}
					<FavoriteButton
						productId={product.id}
						className="w-8 h-8 max-sm:w-7 max-sm:h-7 flex items-center justify-center bg-[#F2E8EA] rounded-[2.87px] hover:bg-[#F2E8EA]/80 transition-colors"
					/>

					{/* Кнопка удаления */}
					<button
						onClick={handleRemove}
						disabled={isUpdating}
						className="w-8 h-8 max-sm:w-7 max-sm:h-7 flex items-center justify-center bg-[#F2E8EA] rounded-[4px] hover:bg-[#F2E8EA]/80 transition-colors disabled:opacity-50"
						aria-label="Удалить из корзины"
					>
						<TrashIcon size={16} weight="regular" className="text-[#121212] max-sm:w-3.5 max-sm:h-3.5" />
					</button>

					{/* Селектор количества */}
					<div className="flex items-center ml-auto">
						<button
							onClick={() => handleQuantityChange(cartItem.quantity - 1)}
							disabled={isUpdating}
							className="w-8 h-8 max-sm:w-7 max-sm:h-7 flex items-center justify-center bg-[#F2E8EA] rounded-[4px] rounded-r-none hover:bg-[#F2E8EA]/80 transition-colors disabled:opacity-50"
							aria-label="Уменьшить количество"
						>
							<span className="text-[#121212] font-bold max-sm:text-sm">-</span>
						</button>
						<div className="w-[48px] h-8 max-sm:w-[40px] max-sm:h-7 flex items-center justify-center bg-[#F2E8EA]">
							<span className="text-base font-normal leading-[1.3125] text-[#121212] max-sm:text-sm">
								{cartItem.quantity}
							</span>
						</div>
						<button
							onClick={() => handleQuantityChange(cartItem.quantity + 1)}
							disabled={
								isUpdating ||
								(typeof product.availableStock === 'number'
									? cartItem.quantity >= product.availableStock
									: typeof product.stock === 'number'
										? cartItem.quantity >= product.stock
										: false)
							}
							className="w-8 h-8 max-sm:w-7 max-sm:h-7 flex items-center justify-center bg-[#F2E8EA] rounded-[4px] rounded-l-none hover:bg-[#F2E8EA]/80 transition-colors disabled:opacity-50"
							aria-label="Увеличить количество"
						>
							<span className="text-[#121212] font-bold max-sm:text-sm">+</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
