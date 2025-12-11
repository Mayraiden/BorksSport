'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IBuyButtonProps } from '../types'
import { cartApi } from '@/features/Cart/api/cartApi'
import { useAuthStore } from '@/features/Auth/model/store'
import { useAuthModal } from '@/shared/lib/contexts/AuthModalContext'
import { refreshCartCount } from '@/features/Cart/lib/useCartCount'

// Main BuyButton component
export const BuyButton = ({ ...props }: IBuyButtonProps) => {
	const [isInCart, setIsInCart] = useState(false)
	const [quantity, setQuantity] = useState(props.quantity || 1)
	const [cartItemId, setCartItemId] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const { isAuthenticated, jwt } = useAuthStore()
	const { openModal } = useAuthModal()
	const router = useRouter()

	const handleAddToCart = async () => {
		// Если пользователь не авторизован, показываем модальное окно
		if (!isAuthenticated) {
			openModal()
			return
		}

		// Если нет productId, просто вызываем onClick (для обратной совместимости)
		if (!props.productId || !jwt) {
			props.onClick?.()
			return
		}

		setIsLoading(true)
		try {
			const cartItem = await cartApi.addToCart(props.productId, quantity, jwt)
			setIsInCart(true)
			setCartItemId(cartItem.cartItemId)
			setQuantity(cartItem.quantity)
			refreshCartCount(jwt)
			props.onClick?.()
		} catch (error) {
			console.error('Failed to add to cart:', error)
			if (error instanceof Error && error.message === 'Unauthorized') {
				openModal()
			}
		} finally {
			setIsLoading(false)
		}
	}

	const handleNavigateToCart = () => {
		router.push('/cart')
	}

	const handleIncrease = async () => {
		if (!isAuthenticated || !jwt || !props.productId) {
			setQuantity((prev) => prev + 1)
			return
		}

		const newQuantity = quantity + 1

		if (cartItemId === null) {
			// Если по каким-то причинам нет cartItemId, пробуем добавить еще раз
			await handleAddToCart()
			return
		}

		setIsLoading(true)
		try {
			const updatedItem = await cartApi.updateQuantity(cartItemId, newQuantity, jwt)
			setQuantity(updatedItem.quantity)
			refreshCartCount(jwt)
		} catch (error) {
			console.error('Failed to increase quantity:', error)
		} finally {
			setIsLoading(false)
		}
	}

	const handleDecrease = async () => {
		if (!isAuthenticated || !jwt || !props.productId) {
			setQuantity((prev) => Math.max(prev - 1, 1))
			return
		}

		if (cartItemId === null) {
			setIsInCart(false)
			setQuantity(1)
			return
		}

		if (quantity <= 1) {
			setIsLoading(true)
			try {
				await cartApi.removeFromCart(cartItemId, jwt)
				refreshCartCount(jwt)
				setIsInCart(false)
				setQuantity(1)
				setCartItemId(null)
			} catch (error) {
				console.error('Failed to remove from cart:', error)
			} finally {
				setIsLoading(false)
			}
			return
		}

		const newQuantity = quantity - 1
		setIsLoading(true)
		try {
			const updatedItem = await cartApi.updateQuantity(cartItemId, newQuantity, jwt)
			setQuantity(updatedItem.quantity)
			refreshCartCount(jwt)
		} catch (error) {
			console.error('Failed to decrease quantity:', error)
		} finally {
			setIsLoading(false)
		}
	}

	// For product page variant
	if (props.variant === 'product-page') {
		if (isInCart) {
			return (
				<div className="flex items-center gap-4">
					<button
						className="bg-[#7B1931] text-[#F5F5F5] px-6 h-11 rounded-[4px] hover:bg-[#7B1931]/90 transition-colors duration-200 text-base font-normal leading-[1.3125] flex items-center justify-center"
						type="button"
						onClick={handleNavigateToCart}
					>
						Перейти в корзину
					</button>
					<div className="flex items-center bg-[#F0F4F8] rounded-[4px] overflow-hidden h-11">
						<button
							onClick={handleDecrease}
							className="w-11 h-11 bg-[#F0F4F8] hover:bg-[#7B1931] text-[#121212] hover:text-[#F5F5F5] transition-colors duration-200 flex items-center justify-center"
							type="button"
							aria-label="Уменьшить количество"
						>
							-
						</button>
						<div className="h-11 px-4 bg-[#F0F4F8] text-[#121212] flex items-center justify-center font-normal min-w-[3rem] text-base leading-[1.3125]">
							{quantity}
						</div>
						<button
							onClick={handleIncrease}
							className="w-11 h-11 bg-[#F0F4F8] hover:bg-[#7B1931] text-[#121212] hover:text-[#F5F5F5] transition-colors duration-200 flex items-center justify-center"
							type="button"
							aria-label="Увеличить количество"
						>
							+
						</button>
					</div>
				</div>
			)
		}

		return (
			<button
				className={`bg-[#7B1931] text-[#F5F5F5] px-6 h-11 rounded-[4px] hover:bg-[#7B1931]/90 transition-colors duration-200 text-base font-normal leading-[1.3125] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
				type={props.type}
				onClick={handleAddToCart}
				disabled={props.disabled || props.loading || isLoading}
			>
				{props.loading || isLoading ? 'минутку..' : props.text}
			</button>
		)
	}

	// For card variant (existing behavior)
	if (isInCart) {
		return (
			<div className="w-30 h-8 flex items-center bg-[#f8f4f4] rounded-sm overflow-hidden">
				<button
					onClick={handleDecrease}
					className="w-8 h-8 bg-gray/20 hover:bg-burgundy text-gray-700 hover:text-white transition-colors duration-200 rounded-l-sm flex items-center justify-center"
					type="button"
				>
					-
				</button>
				<div className="h-full flex-1 bg-gray/20 text-gray-700 text-center flex items-center justify-center font-medium">
					{quantity}
				</div>
				<button
					onClick={handleIncrease}
					className="w-8 h-8 bg-gray/20 hover:bg-burgundy text-gray-700 hover:text-white transition-colors duration-200 rounded-r-sm flex items-center justify-center"
					type="button"
				>
					+
				</button>
			</div>
		)
	}

	return (
		<button
			className={`bg-burgundy text-white rounded-lg hover:bg-burgundy/90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
			type={props.type}
			onClick={handleAddToCart}
			disabled={props.disabled || props.loading || isLoading}
		>
			{props.loading || isLoading ? 'минутку..' : props.text}
		</button>
	)
}
