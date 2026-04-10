'use client'

import { use, useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthStore } from '@/features/Auth/model/store'
import { ProfileLayout } from '@/app/layouts/ProfileLayout'
import { ordersApi } from '@/features/Orders/api/ordersApi'
import { checkoutApi } from '@/features/Checkout/api/checkoutApi'
import type { OrderEntity, PaymentEntity } from '@/features/Orders/model/types'
import { OrderStatusBadge } from '@/features/Orders/ui/OrderStatusBadge'

interface OrderDetailsPageProps {
	params: Promise<{
		id: string
	}>
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

const formatDeliveryType = (value?: OrderEntity['deliveryType'] | null) => {
	switch (value) {
		case 'pvz':
			return 'ПВЗ'
		case 'door':
			return 'До двери'
		case 'pickup':
			return 'Самовывоз'
		default:
			return 'Уточняется'
	}
}

const formatPaymentProvider = (value?: OrderEntity['paymentProvider'] | null) => {
	switch (value) {
		case 'sbp':
			return 'СБП'
		case 'card':
			return 'Карта'
		case 'tochka':
			return 'Точка'
		default:
			return value || '—'
	}
}

const formatPaymentStatus = (value: PaymentEntity['status']) => {
	switch (value) {
		case 'pending':
			return 'Ожидает оплату'
		case 'paid':
			return 'Оплачен'
		case 'failed':
			return 'Ошибка оплаты'
		case 'refunded':
			return 'Возврат выполнен'
		default:
			return String(value)
	}
}

const formatPaymentStatusForOrder = (
	payment: PaymentEntity,
	orderStatus?: OrderEntity['status']
) => {
	if (orderStatus === 'cancelled') {
		// Don't confuse user with "pending payment" when order is already cancelled.
		if (payment.status === 'pending') return 'Отменён'
		if (payment.status === 'paid') return 'Оплачен'
		if (payment.status === 'refunded') return 'Возврат выполнен'
	}
	return formatPaymentStatus(payment.status)
}

const formatRefundStatus = (value?: PaymentEntity['refundStatus'] | null) => {
	switch (value) {
		case 'pending':
			return 'Возврат в обработке'
		case 'succeeded':
			return 'Возврат подтверждён'
		case 'failed':
			return 'Возврат не выполнен'
		case 'none':
		case null:
		case undefined:
			return null
		default:
			return String(value)
	}
}

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
	const resolvedParams = use(params)
	const { isAuthenticated, jwt } = useAuthStore()
	const searchParams = useSearchParams()
	const [order, setOrder] = useState<OrderEntity | null>(null)
	const [payments, setPayments] = useState<PaymentEntity[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [refundModal, setRefundModal] = useState<null | {
		title: string
		description?: string
	}>(null)

	const orderId = Number(resolvedParams.id)
	const paymentSuccess = searchParams?.get('payment') === 'success'

	const loadOrder = useCallback(async () => {
		if (!isAuthenticated || !jwt || Number.isNaN(orderId)) {
			setIsLoading(false)
			return
		}

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
	}, [isAuthenticated, jwt, orderId])

	useEffect(() => {
		loadOrder()
	}, [loadOrder])

	// Автоматическая проверка статуса платежа при возврате после оплаты
	useEffect(() => {
		if (!paymentSuccess || !isAuthenticated || !jwt || !order || isLoading) {
			return
		}

		const pendingPayment = payments.find((p) => p.status === 'pending' && p.provider === 'tochka')
		if (!pendingPayment) {
			return
		}

		// Проверяем статус платежа при возврате после оплаты
		const checkPaymentStatus = async () => {
			try {
				const statusResult = await checkoutApi.getTochkaPaymentStatus(pendingPayment.id, jwt)
				
				// Если статус изменился, перезагружаем заказ
				if (statusResult.status !== 'pending') {
					await loadOrder()
				}
			} catch (err) {
				console.error('Failed to check payment status', err)
			}
		}

		// Проверяем сразу и через 3 секунды
		checkPaymentStatus()
		const timeout = setTimeout(checkPaymentStatus, 3000)
		
		return () => clearTimeout(timeout)
	}, [paymentSuccess, isAuthenticated, jwt, order, payments, isLoading, loadOrder])

	const pendingPayment = useMemo(
		() => payments.find((payment) => payment.status === 'pending'),
		[payments]
	)

	const latestPayment = useMemo(() => payments[0], [payments])
	const latestPaidPayment = useMemo(
		() => payments.find((payment) => payment.status === 'paid'),
		[payments]
	)

	const refundStatusText = useMemo(() => {
		const value = latestPaidPayment?.refundStatus
		return formatRefundStatus(value)
	}, [latestPaidPayment?.refundStatus])

	const isRefundPending =
		latestPaidPayment?.refundStatus === 'pending'

	const canCancelUnpaid =
		order?.status === 'awaiting_payment' && order.paymentMethod === 'online'

	const canCancelPaid =
		order?.status === 'paid' &&
		order.paymentMethod === 'online' &&
		(latestPaidPayment?.refundStatus === 'none' ||
			!latestPaidPayment?.refundStatus)

	const handleCancelOrder = useCallback(async () => {
		if (!jwt || !order) return
		try {
			await ordersApi.cancelOrder(order.id, jwt)
			// Immediate UX feedback; refund may take a bit to confirm.
			if (order.status === 'paid') {
				setRefundModal({
					title: 'Возврат оформляется',
					description: 'Мы отправили запрос на возврат. Обычно это занимает несколько минут.',
				})
			}
			await loadOrder()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Не удалось отменить заказ.'
			setError(message)
		}
	}, [jwt, order, loadOrder])

	// When refund is confirmed later (cron/webhook), show a one-time confirmation modal.
	useEffect(() => {
		if (!order) return
		const p = payments.find((x) => x.refundStatus === 'succeeded' || x.status === 'refunded')
		if (!p) return
		// Avoid overriding user-dismissed state too aggressively
		setRefundModal((prev) => {
			if (prev?.title === 'Возврат оформлен') return prev
			return {
				title: 'Возврат оформлен',
				description: 'Заказ отменён, деньги возвращены тем же способом оплаты.',
			}
		})
	}, [order, payments])

	const deliveryAddressText = useMemo(() => {
		const address = order?.shippingAddress
		if (!address) return 'Уточняется'

		if (address.type === 'pickup') {
			return address.pickupAddress?.address || 'Уточняется'
		}

		if (!('deliveryAddress' in address)) {
			return 'Уточняется'
		}

		// PVZ delivery: show selected pickup point address instead of empty street/house.
		if (address.deliveryOption === 'pickup_point') {
			const name = address.selectedPvz?.name?.trim()
			const addr = address.selectedPvz?.address?.trim() || order?.cdekPvzAddress?.trim()
			if (name && addr) return `${name} — ${addr}`
			if (addr) return addr
		}

		const city = (address.deliveryAddress?.city || '').trim()
		const street = (address.deliveryAddress?.street || '').trim()
		const house = (address.deliveryAddress?.house || '').trim()
		const apartment = (address.deliveryAddress?.apartment || '').trim()

		const parts = [city, street, house ? `д. ${house}` : '', apartment ? `кв. ${apartment}` : ''].filter(
			(v) => v.length > 0
		)
		return parts.length ? parts.join(', ') : 'Адрес доставки уточняется'
	}, [order])

	return (
		<ProfileLayout>
			<div className="flex flex-col gap-5 max-sm:gap-3 pt-2.5 max-sm:pt-2">
				{refundModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div
							className="absolute inset-0 bg-black/30"
							onClick={() => setRefundModal(null)}
						/>
						<div className="relative w-full max-w-md bg-white rounded-md shadow-lg border border-gray-100 p-5">
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3 className="text-lg font-semibold text-black">{refundModal.title}</h3>
									{refundModal.description ? (
										<p className="text-sm text-gray-600 mt-1">{refundModal.description}</p>
									) : null}
								</div>
								<button
									type="button"
									onClick={() => setRefundModal(null)}
									className="text-gray-400 hover:text-gray-600 text-sm"
								>
									Закрыть
								</button>
							</div>
						</div>
					</div>
				)}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-sm:gap-2 flex-wrap">
					<div>
						<h1 className="text-2xl font-bold text-black leading-[0.875] max-sm:text-xl">
							Заказ №{order?.orderNumber || orderId}
						</h1>
						{order?.createdAt && (
							<p className="text-sm max-sm:text-xs text-gray-500">
								Оформлен {formatFullDate(order.createdAt)}
							</p>
						)}
					</div>
					{order && <OrderStatusBadge status={order.status} />}
				</div>

				{!isAuthenticated && (
					<div className="bg-white rounded-md p-6 max-sm:p-4 text-center text-sm max-sm:text-xs text-gray-500">
						Чтобы увидеть информацию о заказе, войдите в аккаунт.
					</div>
				)}

				{isAuthenticated && isLoading && (
					<div className="bg-white rounded-md p-6 max-sm:p-4 animate-pulse space-y-4 max-sm:space-y-3">
						<div className="h-4 max-sm:h-3 bg-gray-200 rounded w-1/2" />
						<div className="h-4 max-sm:h-3 bg-gray-200 rounded w-1/3" />
						<div className="h-32 max-sm:h-24 bg-gray-200 rounded" />
					</div>
				)}

				{isAuthenticated && !isLoading && error && (
					<div className="bg-red-50 border border-red-200 rounded-md p-4 max-sm:p-3 text-red-700 text-sm max-sm:text-xs">
						{error}
					</div>
				)}

				{isAuthenticated && !isLoading && !error && order && (
					<div className="flex flex-col gap-6 max-sm:gap-4">
						<div className="bg-white rounded-md p-5 max-sm:p-4 border border-gray-100 shadow-sm">
							<h2 className="text-lg max-sm:text-base font-semibold text-black mb-4 max-sm:mb-3">
								Сводка заказа
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-sm:gap-3 text-sm max-sm:text-xs text-gray-600">
								<div>
									<p className="font-medium text-black">Стоимость</p>
									<p className="mt-1 max-sm:mt-0.5">{formatCurrency(order.totalAmount)}</p>
									{typeof order.cdekDeliveryCost === 'number' && (
										<p className="text-xs max-sm:text-[10px] text-gray-400">
											Доставка: {formatCurrency(order.cdekDeliveryCost)}
										</p>
									)}
								</div>
								<div>
									<p className="font-medium text-black">Оплата</p>
									<p className="mt-1 max-sm:mt-0.5">
										{order.paymentMethod === 'online'
											? 'Онлайн'
											: 'При получении'}
									</p>
									{order.paymentProvider && (
										<p className="text-xs max-sm:text-[10px] text-gray-400">
											Способ: {formatPaymentProvider(order.paymentProvider)}
										</p>
									)}
									{latestPayment && (
										<p className="text-xs max-sm:text-[10px] text-gray-400">
											Статус оплаты: {formatPaymentStatusForOrder(latestPayment, order.status)}
											{refundStatusText ? ` • ${refundStatusText}` : ''}
										</p>
									)}
								</div>
								{order.shippingAddress && (
									<div className="md:col-span-2">
										<p className="font-medium text-black">Доставка</p>
										<p className="mt-1 max-sm:mt-0.5 text-sm max-sm:text-xs text-gray-600">
											{formatDeliveryType(order.deliveryType)} • {deliveryAddressText}
										</p>
										{order.cdekStatus && (
											<p className="text-xs max-sm:text-[10px] text-gray-400 mt-1">
												CDEK: {order.cdekStatus}
												{order.cdekTrackNumber ? ` • трек ${order.cdekTrackNumber}` : ''}
											</p>
										)}
									</div>
								)}
								{order.notes && (
									<div className="md:col-span-2">
										<p className="font-medium text-black">Комментарий</p>
										<p className="mt-1 max-sm:mt-0.5 text-sm max-sm:text-xs text-gray-600">{order.notes}</p>
									</div>
								)}
							</div>

							{canCancelUnpaid && (
								<div className="mt-4 max-sm:mt-3">
									<button
										type="button"
										onClick={handleCancelOrder}
										className="px-4 py-2 max-sm:px-3 max-sm:py-1.5 text-xs max-sm:text-[10px] border border-red-300 text-red-700 rounded-md hover:bg-red-50"
									>
										Отменить заказ
									</button>
									<p className="text-xs max-sm:text-[10px] text-gray-500 mt-2">
										Отмена доступна до оплаты.
									</p>
								</div>
							)}

							{order.status === 'paid' && order.paymentMethod === 'online' && (
								<div className="mt-4 max-sm:mt-3">
									<button
										type="button"
										onClick={handleCancelOrder}
										disabled={!canCancelPaid || isRefundPending}
										className="px-4 py-2 max-sm:px-3 max-sm:py-1.5 text-xs max-sm:text-[10px] border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
									>
										{latestPaidPayment?.refundStatus === 'succeeded' || latestPaidPayment?.status === 'refunded'
											? 'Возврат оформлен'
											: isRefundPending
											? 'Возврат оформляется'
											: 'Отменить заказ и оформить возврат'}
									</button>
									<p className="text-xs max-sm:text-[10px] text-gray-500 mt-2">
										{refundStatusText
											? refundStatusText
											: 'После отмены деньги будут возвращены тем же способом оплаты.'}
									</p>
								</div>
							)}

							{order.status === 'cancelled' && (order.cancelledAt || order.cancelReason) && (
								<div className="mt-4 max-sm:mt-3 text-xs max-sm:text-[10px] text-gray-500">
									{order.cancelReason ? <p>Причина: {order.cancelReason}</p> : null}
									{order.cancelledAt ? <p>Дата: {formatFullDate(order.cancelledAt)}</p> : null}
								</div>
							)}
						</div>

						<div className="bg-white rounded-md p-5 max-sm:p-4 border border-gray-100 shadow-sm">
							<h2 className="text-lg max-sm:text-base font-semibold text-black mb-4 max-sm:mb-3">Состав заказа</h2>
							<div className="flex flex-col gap-3 max-sm:gap-2">
								{order.items.map((item) => (
									<div
										key={`${order.id}-${item.productId}`}
										className="flex items-start justify-between gap-3 max-sm:gap-2 text-sm max-sm:text-xs text-gray-700"
									>
										<div className="flex items-start gap-3 max-sm:gap-2 flex-1 min-w-0">
											{item.image ? (
												<div className="relative w-14 h-14 max-sm:w-12 max-sm:h-12 rounded-md overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
													<Image
														src={item.image}
														alt={item.name}
														fill
														sizes="56px"
														className="object-cover"
													/>
												</div>
											) : (
												<div className="w-14 h-14 max-sm:w-12 max-sm:h-12 rounded-md border border-gray-100 bg-gray-50 flex-shrink-0" />
											)}
											<div className="min-w-0">
											<p className="text-black font-medium">{item.name}</p>
											<p className="text-xs max-sm:text-[10px] text-gray-400">
												{item.quantity} × {formatCurrency(item.price)}
											</p>
											</div>
										</div>
										<p className="font-semibold text-black flex-shrink-0">
											{formatCurrency(item.subtotal)}
										</p>
									</div>
								))}
							</div>
						</div>

						<div className="bg-white rounded-md p-5 max-sm:p-4 border border-gray-100 shadow-sm">
							<h2 className="text-lg max-sm:text-base font-semibold text-black mb-4 max-sm:mb-3">Платежи</h2>
							{payments.length === 0 && (
								<p className="text-sm max-sm:text-xs text-gray-500">
									Информация о платежах появится после создания оплачиваемого заказа.
								</p>
							)}

							{payments.length > 0 && (
								<div className="flex flex-col gap-3 max-sm:gap-2 text-sm max-sm:text-xs text-gray-700">
									{payments.map((payment) => (
										<div
											key={payment.id}
											className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 max-sm:gap-1.5 border border-gray-100 rounded-md p-3 max-sm:p-2"
										>
											<div>
												<p className="font-medium text-black">
													{formatCurrency(payment.amount)} ({payment.currency || 'RUB'})
												</p>
												<p className="text-xs max-sm:text-[10px] text-gray-400">
													Статус: {formatPaymentStatusForOrder(payment, order.status)}
													{formatRefundStatus(payment.refundStatus)
														? ` • ${formatRefundStatus(payment.refundStatus)}`
														: ''}
												</p>
											</div>
											{order.status !== 'cancelled' &&
												payment.paymentUrl &&
												payment.status === 'pending' && (
												<Link
													href={`/checkout/payment?orderId=${order.id}&paymentId=${payment.id}`}
													className="inline-flex items-center justify-center px-3 max-sm:px-2 py-2 max-sm:py-1.5 text-xs max-sm:text-[10px] border border-[#7B1931] text-[#7B1931] rounded-md hover:bg-[#f8f0f2] max-sm:w-full max-sm:justify-center"
												>
													Перейти к оплате
												</Link>
											)}
										</div>
									))}
								</div>
							)}
						</div>

						{order.status !== 'cancelled' && pendingPayment && (
							<div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 max-sm:p-3 text-sm max-sm:text-xs text-yellow-800">
								<p className="font-semibold mb-2 max-sm:mb-1.5">
									Оплата ожидает подтверждения
								</p>
								<p className="mb-2 max-sm:mb-1.5">
									Если вы уже оплатили заказ, ожидайте обновления статуса. Это
									обычно занимает до нескольких минут.
								</p>
								<Link
									href={`/checkout/payment?orderId=${order.id}&paymentId=${pendingPayment.id}`}
									className="inline-flex items-center justify-center px-4 max-sm:px-3 py-2 max-sm:py-1.5 text-xs max-sm:text-[10px] border border-[#7B1931] text-[#7B1931] rounded-md hover:bg-[#f8f0f2] max-sm:w-full max-sm:justify-center"
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


