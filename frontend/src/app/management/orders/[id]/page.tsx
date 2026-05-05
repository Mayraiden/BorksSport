'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthStore } from '@/features/Auth/model/store'
import {
	managementOrdersApi,
	type ManagementOrderEntity,
	type ManagementPaymentEntity,
} from '@/features/ManagementOrders/api/managementOrdersApi'
import { OrderStatusBadge } from '@/features/Orders/ui/OrderStatusBadge'
import type { PaymentEntity } from '@/features/Orders/model/types'

type ManagementOrderDetailsPageProps = {
	params: Promise<{ id: string }>
}

const formatCurrency = (value: number) =>
	new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 2,
	}).format(value)

const formatDeliveryType = (value?: ManagementOrderEntity['deliveryType'] | null) => {
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

const formatPaymentProvider = (value?: ManagementOrderEntity['paymentProvider'] | null) => {
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

export default function ManagementOrderDetailsPage({ params }: ManagementOrderDetailsPageProps) {
	const resolvedParams = use(params)
	const orderId = Number(resolvedParams.id)
	const { isAuthenticated, jwt } = useAuthStore()

	const [order, setOrder] = useState<ManagementOrderEntity | null>(null)
	const [payments, setPayments] = useState<ManagementPaymentEntity[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isSyncingPaymentId, setIsSyncingPaymentId] = useState<number | null>(null)
	const [error, setError] = useState<string | null>(null)

	const customer = useMemo(() => {
		const raw = order?.customerData
		if (raw && typeof raw === 'object') {
			return raw as { name?: unknown; email?: unknown; phone?: unknown }
		}
		return {}
	}, [order?.customerData])

	const deliveryAddressText = useMemo(() => {
		const address = order?.shippingAddress
		if (!address) return 'Уточняется'

		if (address.type === 'pickup') {
			return address.pickupAddress?.address || 'Уточняется'
		}

		if (!('deliveryAddress' in address)) return 'Уточняется'

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

		const parts = [
			city,
			street,
			house ? `д. ${house}` : '',
			apartment ? `кв. ${apartment}` : '',
		].filter((v) => v.length > 0)

		return parts.length ? parts.join(', ') : 'Адрес доставки уточняется'
	}, [order])

	const formatDateTime = (value?: string | null) => {
		if (!value) return '—'
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return value
		return date.toLocaleString('ru-RU')
	}

	const getTochkaMeta = (payment: ManagementPaymentEntity) => {
		const data = (payment.paymentData ?? {}) as {
			lastPolledStatus?: unknown
			lastStatusSyncAt?: unknown
		}
		const rawStatus = data.lastPolledStatus as
			| {
					Data?: {
						Operation?: Array<{
							status?: string
							paidAt?: string
							paymentId?: string
							operationId?: string
						}>
					}
				}
			| undefined

		const operation = Array.isArray(rawStatus?.Data?.Operation)
			? rawStatus?.Data?.Operation?.[0]
			: undefined

		return {
			rawStatus: operation?.status || '—',
			paidAt: operation?.paidAt || null,
			operationId: operation?.operationId || payment.sessionId || null,
			providerPaymentId: operation?.paymentId || payment.paymentId || null,
			lastStatusSyncAt:
				typeof data.lastStatusSyncAt === 'string' ? data.lastStatusSyncAt : null,
		}
	}

	const loadOrderData = useCallback(async () => {
		if (!isAuthenticated || !jwt || Number.isNaN(orderId)) {
			setIsLoading(false)
			return
		}

		setIsLoading(true)
		try {
			const orderData = await managementOrdersApi.getOrderById(orderId, jwt)
			let paymentsData: ManagementPaymentEntity[] = []
			try {
				paymentsData = await managementOrdersApi.getOrderPayments(orderId, jwt)
			} catch (paymentsError) {
				console.warn('Management payments endpoint unavailable, continue without payments', paymentsError)
				paymentsData = []
			}
			setOrder(orderData)
			setPayments(paymentsData)
			setError(null)
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Не удалось загрузить заказ')
		} finally {
			setIsLoading(false)
		}
	}, [isAuthenticated, jwt, orderId])

	useEffect(() => {
		if (!isAuthenticated || !jwt || Number.isNaN(orderId)) {
			setIsLoading(false)
			return
		}

		loadOrderData()
	}, [isAuthenticated, jwt, orderId, loadOrderData])

	const handleSyncPaymentStatus = async (paymentId: number) => {
		if (!jwt) return
		try {
			setIsSyncingPaymentId(paymentId)
			await managementOrdersApi.syncTochkaPaymentStatus(paymentId, jwt)
			await loadOrderData()
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Не удалось синхронизировать статус платежа')
		} finally {
			setIsSyncingPaymentId(null)
		}
	}

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
							<div>
								<span className="text-gray-500">Сумма:</span>{' '}
								{typeof order.totalAmount === 'number' ? formatCurrency(order.totalAmount) : (order.totalAmount ?? '—')}
							</div>
							<div>
								<span className="text-gray-500">Оплата:</span>{' '}
								{order.paymentMethod ?? '—'} {order.paymentProvider ? `(${formatPaymentProvider(order.paymentProvider)})` : ''}
							</div>
							<div>
								<span className="text-gray-500">Доставка:</span>{' '}
								{formatDeliveryType(order.deliveryType)} • {deliveryAddressText}
							</div>
							<div>
								<span className="text-gray-500">CDEK статус:</span> {order.cdekStatus ?? '—'}
							</div>
							<div>
								<span className="text-gray-500">CDEK трек:</span> {order.cdekTrackNumber ?? '—'}
							</div>
							<div><span className="text-gray-500">Трек:</span> {order.trackingNumber ?? '—'}</div>
						</div>
					</div>

					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm">
						<h2 className="text-lg font-semibold text-black mb-3">Адрес/данные</h2>
						<div className="text-sm text-gray-700 space-y-2">
							<div><span className="text-gray-500">Имя:</span> {String(customer.name || '—')}</div>
							<div><span className="text-gray-500">Email:</span> {String(customer.email || '—')}</div>
							<div><span className="text-gray-500">Телефон:</span> {String(customer.phone || '—')}</div>
							{order.notes ? (
								<div><span className="text-gray-500">Комментарий:</span> {order.notes}</div>
							) : null}
							{order.status === 'cancelled' && (order.cancelReason || order.cancelledAt) ? (
								<div className="pt-2 text-xs text-gray-500">
									{order.cancelReason ? <div>Причина: {order.cancelReason}</div> : null}
									{order.cancelledAt ? <div>Дата: {new Date(order.cancelledAt).toLocaleString('ru-RU')}</div> : null}
								</div>
							) : null}
						</div>
					</div>

					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm lg:col-span-2">
						<h2 className="text-lg font-semibold text-black mb-3">Состав заказа</h2>
						<div className="flex flex-col gap-3 text-sm text-gray-700">
							{order.items?.map((item) => (
								<div key={`${order.id}-${item.productId}`} className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-3 flex-1 min-w-0">
										{item.image ? (
											<div className="relative w-14 h-14 rounded-md overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
												<Image
													src={item.image}
													alt={item.name}
													fill
													sizes="56px"
													className="object-cover"
												/>
											</div>
										) : (
											<div className="w-14 h-14 rounded-md border border-gray-100 bg-gray-50 flex-shrink-0" />
										)}
										<div className="min-w-0">
											<div className="text-black font-medium truncate">{item.name}</div>
											<div className="text-xs text-gray-400">
												{item.quantity} × {formatCurrency(item.price)}
											</div>
										</div>
									</div>
									<div className="font-semibold text-black flex-shrink-0">
										{formatCurrency(item.subtotal)}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="bg-white rounded-md p-5 border border-gray-100 shadow-sm lg:col-span-2">
						<h2 className="text-lg font-semibold text-black mb-3">Платежи</h2>
						{payments.length === 0 ? (
							<p className="text-sm text-gray-500">Платежи не найдены.</p>
						) : (
							<div className="flex flex-col gap-3 text-sm text-gray-700">
								{payments.map((payment) => {
									const canSyncTochka = payment.provider === 'tochka'
									const isSyncing = isSyncingPaymentId === payment.id
									const refundLabel = formatRefundStatus(payment.refundStatus)
									const tochkaMeta = getTochkaMeta(payment)

									return (
										<div
											key={payment.id}
											className="border border-gray-100 rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
										>
											<div className="min-w-0">
												<p className="font-medium text-black">
													{formatCurrency(payment.amount)} ({payment.currency || 'RUB'})
												</p>
												<p className="text-xs text-gray-500">
													Статус: {formatPaymentStatus(payment.status)}
													{refundLabel ? ` • ${refundLabel}` : ''}
												</p>
												<p className="text-xs text-gray-400">
													Провайдер: {payment.provider || '—'}
												</p>
												{payment.provider === 'tochka' ? (
													<div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
														<div>Статус в Точке: {tochkaMeta.rawStatus}</div>
														<div>Оплачен в: {formatDateTime(tochkaMeta.paidAt)}</div>
														<div className="truncate">
															operationId: {tochkaMeta.operationId || '—'}
														</div>
														<div className="truncate">
															paymentId: {tochkaMeta.providerPaymentId || '—'}
														</div>
														<div>
															Последняя синхронизация:{' '}
															{formatDateTime(tochkaMeta.lastStatusSyncAt)}
														</div>
													</div>
												) : null}
											</div>
											{canSyncTochka ? (
												<button
													type="button"
													onClick={() => handleSyncPaymentStatus(payment.id)}
													disabled={isSyncing}
													className="inline-flex items-center justify-center px-3 py-2 text-xs border border-[#7B1931] text-[#7B1931] rounded-md hover:bg-[#f8f0f2] disabled:opacity-60 disabled:cursor-not-allowed"
												>
													{isSyncing ? 'Проверяем...' : 'Обновить статус оплаты'}
												</button>
											) : null}
										</div>
									)
								})}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

