'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CartItemCard } from '@/shared/ui/CartItemCard'
import { CartSummary } from '@/shared/ui/CartSummary'
import { ProfileDropdown } from '@/shared/ui/ProfileDropdown'
import { useAuthStore } from '@/features/Auth/model/store'
import { useJwtWithRestore } from '@/features/Auth/lib/useJwtWithRestore'
import { cartApi, type CartItemDisplay } from '@/features/Cart/api/cartApi'

export const Cart = () => {
	const router = useRouter()
	const [cartItems, setCartItems] = useState<CartItemDisplay[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const { isAuthenticated } = useAuthStore()
	const { jwt } = useJwtWithRestore()

	// Функция для обновления списка корзины
	const refreshCart = async () => {
		if (!jwt) return
		try {
			const items = await cartApi.getCart(jwt)
			setCartItems(items)
		} catch {
		}
	}

	useEffect(() => {
		const loadCart = async () => {
			// Если пользователь не авторизован или нет jwt, не загружаем корзину
			if (!isAuthenticated || !jwt) {
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
				} else if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
					setError('Необходимо войти в аккаунт')
				} else {
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
		// Переход к оформлению заказа (используем router.push для сохранения состояния)
		router.push('/checkout')
	}

	if (!isAuthenticated) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold leading-[0.875] text-[#121212] max-sm:text-xl">
						Корзина
					</h1>
					<ProfileDropdown />
				</div>
				<div className="bg-white rounded-[4px] p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212] max-sm:text-lg">
						Необходимо войти в аккаунт
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center max-sm:text-sm">
						Войдите в аккаунт, чтобы просмотреть корзину.
					</p>
				</div>
			</section>
		)
	}

	if (isLoading) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold leading-[0.875] text-[#121212] max-sm:text-xl">
						Корзина
					</h1>
					<ProfileDropdown />
				</div>
				<div className="bg-white rounded-[4px] p-5 max-sm:p-4 flex items-center justify-center">
					<span className="text-base max-sm:text-sm text-[#A0A4A8]">Загрузка...</span>
				</div>
			</section>
		)
	}

	if (error) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold leading-[0.875] text-[#121212] max-sm:text-xl">
						Корзина
					</h1>
					<ProfileDropdown />
				</div>
				<div className="bg-white rounded-[4px] p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212] max-sm:text-lg">
						Ошибка загрузки
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center max-sm:text-sm">
						{error}
					</p>
				</div>
			</section>
		)
	}

	if (cartItems.length === 0) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold leading-[0.875] text-[#121212] max-sm:text-xl">
						Корзина
					</h1>
					<ProfileDropdown />
				</div>
				<div className="bg-white rounded-[4px] p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
					<h2 className="text-xl font-bold leading-[1.05] text-[#121212] max-sm:text-lg">
						Корзина пуста
					</h2>
					<p className="text-base font-normal leading-[1.3125] text-[#121212] text-center max-sm:text-sm">
						Перейдите в каталог, чтобы добавить товары в корзину.
					</p>
					<Link
						href="/catalog"
						className="px-6 py-4 max-sm:px-4 max-sm:py-3 max-sm:w-full max-sm:text-center bg-[#7B1931] text-[#F5F5F5] rounded-[4px] hover:bg-[#6a1529] transition-colors"
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
		<section className="flex flex-col gap-5 max-sm:gap-3">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold leading-[0.875] text-[#121212] max-sm:text-xl">
					Корзина
				</h1>
				<ProfileDropdown />
			</div>

			{/* Основной контент: список товаров и сводка */}
			<div className="flex flex-col lg:flex-row gap-3 max-sm:gap-3">
				{/* Список товаров */}
				<div className="flex-1 flex flex-col gap-3 max-sm:gap-2">
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
				<div className="w-full lg:w-[440px] lg:flex-shrink-0">
					<CartSummary cartItems={cartItems} onCheckout={handleCheckout} />
				</div>
			</div>
		</section>
	)
}
