'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CartItemCard } from '@/shared/ui/CartItemCard'
import { CartSummary } from '@/shared/ui/CartSummary'
import { useAuthStore } from '@/features/Auth/model/store'
import { cartApi, type CartItemDisplay } from '@/features/Cart/api/cartApi'

export const Cart = () => {
	const [cartItems, setCartItems] = useState<CartItemDisplay[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const { isAuthenticated, jwt } = useAuthStore()

	// Функция для обновления списка корзины
	const refreshCart = async () => {
		if (!jwt) return
		try {
			const items = await cartApi.getCart(jwt)
			setCartItems(items)
		} catch (err) {
			console.error('Failed to refresh cart:', err)
		}
	}

	useEffect(() => {
		const loadCart = async () => {
			if (!isAuthenticated || !jwt) {
				setError('Необходимо войти в аккаунт')
				setIsLoading(false)
				return
			}

			try {
				setIsLoading(true)
				setError(null)
				const items = await cartApi.getCart(jwt)
				setCartItems(items)
			} catch (err: unknown) {
				const errMsg = err instanceof Error ? err.message : String(err)
				if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
					setError('Нет доступа к корзине. Обратитесь к администратору.')
					console.warn('[Cart] Permission denied - check Strapi settings')
				} else if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
					setError('Необходимо войти в аккаунт')
				} else {
					console.error('Failed to load cart:', err)
					setError(errMsg || 'Не удалось загрузить корзину')
				}
				setCartItems([])
			} finally {
				setIsLoading(false)
			}
		}

		loadCart()
	}, [isAuthenticated, jwt])

	const handleCheckout = () => {
		// Переход к оформлению заказа
		window.location.href = '/checkout'
	}

	if (!isAuthenticated) {
		return (
			<section className="flex flex-col gap-5">
				<h1 className="text-2xl font-bold leading-[0.875] text-[#121212]">
					Корзина
				</h1>
				<div className="bg-white rounded-[4px] p-5 flex flex-col items-center gap-5">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212]">
						Необходимо войти в аккаунт
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center">
						Войдите в аккаунт, чтобы просмотреть корзину.
					</p>
				</div>
			</section>
		)
	}

	if (isLoading) {
		return (
			<section className="flex flex-col gap-5">
				<h1 className="text-2xl font-bold leading-[0.875] text-[#121212]">
					Корзина
				</h1>
				<div className="bg-white rounded-[4px] p-5 flex items-center justify-center">
					<span className="text-base text-[#A0A4A8]">Загрузка...</span>
				</div>
			</section>
		)
	}

	if (error) {
		return (
			<section className="flex flex-col gap-5">
				<h1 className="text-2xl font-bold leading-[0.875] text-[#121212]">
					Корзина
				</h1>
				<div className="bg-white rounded-[4px] p-5 flex flex-col items-center gap-5">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212]">
						Ошибка загрузки
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center">
						{error}
					</p>
				</div>
			</section>
		)
	}

	if (cartItems.length === 0) {
		return (
			<section className="flex flex-col gap-5">
				<h1 className="text-2xl font-bold leading-[0.875] text-[#121212]">
					Корзина
				</h1>
				<div className="bg-white rounded-[4px] p-5 flex flex-col items-center gap-5">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212]">
						Корзина пуста
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center">
						Перейдите в каталог, чтобы добавить товары в корзину.
					</p>
					<Link
						href="/catalog"
						className="px-6 py-4 bg-[#7B1931] text-[#F5F5F5] rounded-[4px] hover:bg-[#6a1529] transition-colors"
					>
						<span className="text-xs font-normal leading-[1.75]">
							Перейти в каталог
						</span>
					</Link>
				</div>
			</section>
		)
	}

	return (
		<section className="flex flex-col gap-5">
			<h1 className="text-2xl font-bold leading-[0.875] text-[#121212]">
				Корзина
			</h1>

			{/* Основной контент: список товаров и сводка */}
			<div className="flex gap-3">
				{/* Список товаров */}
				<div className="flex-1 flex flex-col gap-3">
					{cartItems.map((item) => (
						<CartItemCard
							key={item.id}
							cartItem={item}
							onUpdate={refreshCart}
							onRemove={refreshCart}
						/>
					))}
				</div>

				{/* Сводка заказа */}
				<div className="w-[440px] flex-shrink-0">
					<CartSummary cartItems={cartItems} onCheckout={handleCheckout} />
				</div>
			</div>
		</section>
	)
}
