'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/features/Auth/model/store'
import { managementOrdersApi, type ManagementOrderEntity } from '@/features/ManagementOrders/api/managementOrdersApi'
import { OrderStatusBadge } from '@/features/Orders/ui/OrderStatusBadge'

type ManagementOrderDetailsPageProps = {
	params: Promise<{ id: string }>
}

export default function ManagementOrderDetailsPage({ params }: ManagementOrderDetailsPageProps) {
	const resolvedParams = use(params)
	const orderId = Number(resolvedParams.id)
	const { isAuthenticated, jwt } = useAuthStore()

	const [order, setOrder] = useState<ManagementOrderEntity | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!isAuthenticated || !jwt || Number.isNaN(orderId)) {
			setIsLoading(false)
			return
		}

		let cancelled = false
		const load = async () => {
			try {
				setIsLoading(true)
				const data = await managementOrdersApi.getOrderById(orderId, jwt)
				if (cancelled) return
				setOrder(data)
				setError(null)
			} catch (e: unknown) {
				if (cancelled) return
				setError(e instanceof Error ? e.message : 'Не удалось загрузить заказ')
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		load()
		return () => {
			cancelled = true
		}
	}, [isAuthenticated, jwt, orderId])

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<div>
					<Link href="/management/orders" className="text-sm text-gray-600 hover:underline">
						← К списку
					</Link>
					<h1 className="text-2xl font-bold text-black leading-[0.875] mt-2">
						Заказ №{order?.orderNumber || orderId}
					</h1>
					{order?.createdAt && (
						<p className="text-sm text-gray-500">
							Создан {new Date(order.createdAt).toLocaleString('ru-RU')}
						</p>
					)}
				</div>
				{order?.status && <OrderStatusBadge status={order.status} />}
			</div>

			{isLoading && (
				<div className="bg-white rounded-md p-4 border border-gray-100 text-sm text-gray-500">
					Загрузка...
				</div>
			)}

			{!isLoading && error && (
				<div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
					{error}
				</div>
			)}

			{!isLoading && !error && order && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
						<h2 className="text-lg font-semibold text-black mb-3">Сводка</h2>
						<div className="text-sm text-gray-700 space-y-2">
							<div><span className="text-gray-500">Сумма:</span> {order.totalAmount ?? '—'}</div>
							<div><span className="text-gray-500">Оплата:</span> {order.paymentMethod ?? '—'} {order.paymentProvider ? `(${order.paymentProvider})` : ''}</div>
							<div><span className="text-gray-500">Доставка:</span> {order.deliveryType ?? '—'}</div>
							<div><span className="text-gray-500">CDEK статус:</span> {order.cdekStatus ?? '—'}</div>
							<div><span className="text-gray-500">CDEK трек:</span> {order.cdekTrackNumber ?? '—'}</div>
							<div><span className="text-gray-500">Трек:</span> {order.trackingNumber ?? '—'}</div>
						</div>
					</div>

					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
						<h2 className="text-lg font-semibold text-black mb-3">Адрес/данные</h2>
						<pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 border border-gray-100 rounded p-3">
{JSON.stringify({ customerData: order.customerData, shippingAddress: order.shippingAddress }, null, 2)}
						</pre>
					</div>

					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm lg:col-span-2">
						<h2 className="text-lg font-semibold text-black mb-3">Состав заказа</h2>
						<pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 border border-gray-100 rounded p-3">
{JSON.stringify(order.items, null, 2)}
						</pre>
					</div>
				</div>
			)}
		</div>
	)
}

