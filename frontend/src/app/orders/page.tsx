'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProfileLayout } from '@/app/layouts/ProfileLayout'
import { ordersApi } from '@/features/Orders/api/ordersApi'
import type { OrderEntity } from '@/features/Orders/model/types'
import { useAuthStore } from '@/features/Auth/model/store'
import { OrderCard } from '@/features/Orders/ui/OrderCard'

const OrderCardSkeleton = () => (
	<div className="bg-white rounded-md border border-gray-100 shadow-sm p-5 max-sm:p-4 animate-pulse">
		<div className="flex justify-between mb-4 max-sm:mb-3">
			<div className="h-4 max-sm:h-3 w-40 max-sm:w-32 bg-gray-200 rounded" />
			<div className="h-6 max-sm:h-5 w-24 max-sm:w-20 bg-gray-200 rounded-full" />
		</div>
		<div className="flex gap-3 max-sm:gap-2">
			<div className="w-14 h-14 max-sm:w-12 max-sm:h-12 bg-gray-200 rounded" />
			<div className="flex-1 space-y-2 max-sm:space-y-1.5">
				<div className="h-4 max-sm:h-3 bg-gray-200 rounded w-3/4" />
				<div className="h-3 max-sm:h-2.5 bg-gray-200 rounded w-1/2" />
			</div>
		</div>
	</div>
)

export default function Orders() {
	const { isAuthenticated, jwt } = useAuthStore()
	const [orders, setOrders] = useState<OrderEntity[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!isAuthenticated || !jwt) {
			setIsLoading(false)
			return
		}

		const loadOrders = async () => {
			try {
				setIsLoading(true)
				const data = await ordersApi.getOrders(jwt)
				setOrders(data)
				setError(null)
			} catch (err: unknown) {
				console.error('Failed to load orders', err)
				const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить историю заказов.'
				setError(errorMessage)
			} finally {
				setIsLoading(false)
			}
		}

		loadOrders()
	}, [isAuthenticated, jwt])

	return (
		<ProfileLayout>
			<div className="flex flex-col gap-5 max-sm:gap-3 pt-2.5 max-sm:pt-2">
				<div className="flex flex-col gap-2 max-sm:gap-1.5">
					<h1 className="text-2xl font-bold text-black leading-[0.875] max-sm:text-xl">
						История заказов
					</h1>
					<p className="text-sm max-sm:text-xs text-gray-500">
						Здесь отображаются все ваши заказы, их статусы и детали.
					</p>
				</div>

				{!isAuthenticated && (
					<div className="bg-white rounded-md p-6 max-sm:p-4 flex flex-col items-center gap-3 max-sm:gap-2">
						<h2 className="text-lg font-semibold text-black max-sm:text-base">
							Необходимо войти в аккаунт
						</h2>
						<p className="text-sm max-sm:text-xs text-center text-gray-500">
							Войдите в аккаунт, чтобы просмотреть историю заказов и отследить
							статусы.
						</p>
					</div>
				)}

				{isAuthenticated && isLoading && (
					<div className="flex flex-col gap-4 max-sm:gap-3">
						<OrderCardSkeleton />
						<OrderCardSkeleton />
					</div>
				)}

				{isAuthenticated && !isLoading && error && (
					<div className="bg-red-50 border border-red-200 rounded-md p-4 max-sm:p-3 text-red-700 text-sm max-sm:text-xs">
						{error}
					</div>
				)}

				{isAuthenticated && !isLoading && !error && orders.length === 0 && (
					<div className="bg-white rounded-md p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
						<h2 className="text-xl font-bold text-black leading-[1.05] max-sm:text-lg">
							У вас пока нет заказов
						</h2>
						<p className="text-base max-sm:text-sm text-black leading-[1.31] text-center">
							Перейдите в каталог, чтобы добавить товары в корзину.
						</p>
						<Link
							href="/catalog"
							className="flex items-center justify-center px-6 max-sm:px-4 py-4 max-sm:py-3 max-sm:w-full bg-[#7B1931] text-white rounded-md hover:bg-[#6a1529] transition-colors duration-200"
							style={{ width: '160px' }}
						>
							<span className="text-xs leading-[1.75]">Перейти в каталог</span>
						</Link>
					</div>
				)}

				{isAuthenticated && !isLoading && !error && orders.length > 0 && (
					<div className="flex flex-col gap-4 max-sm:gap-3">
						{orders.map((order) => (
							<OrderCard key={order.id} order={order} />
						))}
					</div>
				)}
			</div>
		</ProfileLayout>
	)
}
