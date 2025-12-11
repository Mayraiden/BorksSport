'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/features/Auth/model/store'
import { ProfileLayout } from '@/app/layouts/ProfileLayout'
import { ordersApi } from '@/features/Orders/api/ordersApi'
import type { OrderEntity, PaymentEntity } from '@/features/Orders/model/types'
import { OrderStatusBadge } from '@/features/Orders/ui/OrderStatusBadge'

interface OrderDetailsPageProps {
	params: {
		id: string
	}
}

const formatCurrency = (value: number) =>
	new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 2,
	}).format(value)

const formatFullDate = (iso: string) => {
	const date = new Date(iso)
	return date.toLocaleString('ru-RU', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
	const resolvedParams =
		typeof (params as { then?: unknown })?.then === 'function'
			? use(params as unknown as Promise<OrderDetailsPageProps['params']>)
			: params
	const { isAuthenticated, jwt } = useAuthStore()
	const [order, setOrder] = useState<OrderEntity | null>(null)
	const [payments, setPayments] = useState<PaymentEntity[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const orderId = Number(resolvedParams.id)

	useEffect(() => {
		if (!isAuthenticated || !jwt || Number.isNaN(orderId)) {
			setIsLoading(false)
			return
		}

		const loadOrder = async () => {
			try {
				setIsLoading(true)
				const [orderData, paymentData] = await Promise.all([
					ordersApi.getOrderById(orderId, jwt),
					ordersApi.getPaymentsForOrder(orderId, jwt),
				])
				setOrder(orderData)
				setPayments(paymentData)
				setError(null)
			} catch (err: unknown) {
				console.error('Failed to load order', err)
				const errorMessage = err instanceof Error ? err.message : 'Не удалось получить информацию о заказе.'
				setError(errorMessage)
			} finally {
				setIsLoading(false)
			}
		}

		loadOrder()
	}, [isAuthenticated, jwt, orderId])

	const pendingPayment = useMemo(
		() => payments.find((payment) => payment.status === 'pending'),
		[payments]
	)

	return (
		<ProfileLayout>
			<div className="flex flex-col gap-5 pt-2.5">
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div>
						<h1 className="text-2xl font-bold text-black leading-[0.875]">
							Заказ №{order?.orderNumber || orderId}
						</h1>
						{order?.createdAt && (
							<p className="text-sm text-gray-500">
								Оформлен {formatFullDate(order.createdAt)}
							</p>
						)}
					</div>
					{order && <OrderStatusBadge status={order.status} />}
				</div>

				{!isAuthenticated && (
					<div className="bg-white rounded-md p-6 text-center text-sm text-gray-500">
						Чтобы увидеть информацию о заказе, войдите в аккаунт.
					</div>
				)}

				{isAuthenticated && isLoading && (
					<div className="bg-white rounded-md p-6 animate-pulse space-y-4">
						<div className="h-4 bg-gray-200 rounded w-1/2" />
						<div className="h-4 bg-gray-200 rounded w-1/3" />
						<div className="h-32 bg-gray-200 rounded" />
					</div>
				)}

				{isAuthenticated && !isLoading && error && (
					<div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
						{error}
					</div>
				)}

				{isAuthenticated && !isLoading && !error && order && (
					<div className="flex flex-col gap-6">
						<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
							<h2 className="text-lg font-semibold text-black mb-4">
								Сводка заказа
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
								<div>
									<p className="font-medium text-black">Стоимость</p>
									<p className="mt-1">{formatCurrency(order.totalAmount)}</p>
									{typeof order.cdekDeliveryCost === 'number' && (
										<p className="text-xs text-gray-400">
											Доставка: {formatCurrency(order.cdekDeliveryCost)}
										</p>
									)}
								</div>
								<div>
									<p className="font-medium text-black">Оплата</p>
									<p className="mt-1">
										{order.paymentMethod === 'online'
											? 'Онлайн'
											: 'При получении'}
									</p>
									{order.paymentProvider && (
										<p className="text-xs text-gray-400">
											Провайдер: {order.paymentProvider === 'tochka' ? 'Точка банк' : order.paymentProvider}
										</p>
									)}
								</div>
								{order.shippingAddress && (
									<div className="md:col-span-2">
										<p className="font-medium text-black">Адрес доставки</p>
										<p className="mt-1 text-sm text-gray-600">
											{order.shippingAddress.type === 'pickup'
												? order.shippingAddress.pickupAddress.address
												: (() => {
													const address = order.shippingAddress
													if ('deliveryAddress' in address) {
														const { street, house, apartment } = address.deliveryAddress
														return `${street}, ${house}${apartment ? `, кв. ${apartment}` : ''}`
													}
													return 'Адрес доставки уточняется'
												})()}
										</p>
									</div>
								)}
								{order.notes && (
									<div className="md:col-span-2">
										<p className="font-medium text-black">Комментарий</p>
										<p className="mt-1 text-sm text-gray-600">{order.notes}</p>
									</div>
								)}
							</div>
						</div>

						<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
							<h2 className="text-lg font-semibold text-black mb-4">Состав заказа</h2>
							<div className="flex flex-col gap-3">
								{order.items.map((item) => (
									<div
										key={`${order.id}-${item.productId}`}
										className="flex justify-between gap-3 text-sm text-gray-700"
									>
										<div className="flex-1">
											<p className="text-black font-medium">{item.name}</p>
											<p className="text-xs text-gray-400">
												{item.quantity} × {formatCurrency(item.price)}
											</p>
										</div>
										<p className="font-semibold text-black">
											{formatCurrency(item.subtotal)}
										</p>
									</div>
								))}
							</div>
						</div>

						<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
							<h2 className="text-lg font-semibold text-black mb-4">Платежи</h2>
							{payments.length === 0 && (
								<p className="text-sm text-gray-500">
									Информация о платежах появится после создания оплачиваемого заказа.
								</p>
							)}

							{payments.length > 0 && (
								<div className="flex flex-col gap-3 text-sm text-gray-700">
									{payments.map((payment) => (
										<div
											key={payment.id}
											className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-100 rounded-md p-3"
										>
											<div>
												<p className="font-medium text-black">
													{formatCurrency(payment.amount)} ({payment.currency || 'RUB'})
												</p>
												<p className="text-xs text-gray-400">
													Статус: {payment.status === 'pending'
														? 'Ожидает оплату'
														: payment.status === 'paid'
														? 'Оплачен'
														: payment.status === 'failed'
														? 'Ошибка оплаты'
														: 'Возврат'}
												</p>
											</div>
											{payment.paymentUrl && payment.status === 'pending' && (
												<Link
													href={`/checkout/payment?orderId=${order.id}&paymentId=${payment.id}`}
													className="inline-flex items-center justify-center px-3 py-2 text-xs border border-[#7B1931] text-[#7B1931] rounded-md hover:bg-[#f8f0f2]"
												>
													Перейти к оплате
												</Link>
											)}
										</div>
									))}
								</div>
							)}
						</div>

						{pendingPayment && (
							<div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
								<p className="font-semibold mb-2">
									Оплата ожидает подтверждения
								</p>
								<p className="mb-2">
									Если вы уже оплатили заказ, ожидайте обновления статуса. Это
									обычно занимает до нескольких минут.
								</p>
								<Link
									href={`/checkout/payment?orderId=${order.id}&paymentId=${pendingPayment.id}`}
									className="inline-flex items-center justify-center px-4 py-2 text-xs border border-[#7B1931] text-[#7B1931] rounded-md hover:bg-[#f8f0f2]"
								>
									Проверить статус оплаты
								</Link>
							</div>
						)}
					</div>
				)}
			</div>
		</ProfileLayout>
	)
}


