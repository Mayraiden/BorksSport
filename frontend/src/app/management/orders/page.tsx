'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/features/Auth/model/store'
import { managementOrdersApi, type ManagementOrdersQuery, type ManagementOrderEntity } from '@/features/ManagementOrders/api/managementOrdersApi'
import { OrderStatusBadge } from '@/features/Orders/ui/OrderStatusBadge'

const STATUS_FILTERS: Array<{ id: string; label: string; value?: string }> = [
	{ id: 'all', label: 'Все' },
	{ id: 'awaiting_payment', label: 'Ждёт оплаты', value: 'awaiting_payment' },
	{ id: 'paid', label: 'Оплачены', value: 'paid' },
	{ id: 'shipped', label: 'В доставке', value: 'shipped' },
	{ id: 'delivered', label: 'Доставлены', value: 'delivered' },
	{ id: 'failed', label: 'Проблемные', value: 'payment_failed' },
]

export default function ManagementOrdersPage() {
	const { isAuthenticated, jwt } = useAuthStore()
	const [orders, setOrders] = useState<ManagementOrderEntity[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [q, setQ] = useState('')
	const [status, setStatus] = useState<string | undefined>(undefined)
	const [problemOnly, setProblemOnly] = useState(false)

	const query = useMemo<ManagementOrdersQuery>(() => {
		return {
			q: q.trim() ? q.trim() : undefined,
			status,
			problemOnly: problemOnly ? true : undefined,
			page: 1,
			pageSize: 25,
		}
	}, [problemOnly, q, status])

	useEffect(() => {
		if (!isAuthenticated || !jwt) {
			setIsLoading(false)
			return
		}

		let cancelled = false
		const load = async () => {
			try {
				setIsLoading(true)
				const result = await managementOrdersApi.getOrders(query, jwt)
				if (cancelled) return
				setOrders(result.orders)
				setError(null)
			} catch (e: unknown) {
				if (cancelled) return
				setError(e instanceof Error ? e.message : 'Не удалось загрузить заказы')
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		load()
		return () => {
			cancelled = true
		}
	}, [isAuthenticated, jwt, query])

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-black leading-[0.875]">Заказы</h1>
					<p className="text-sm text-gray-500">Мониторинг статусов оплаты и доставки.</p>
				</div>
				<div className="flex gap-2 flex-wrap">
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Поиск: номер заказа, трек..."
						className="h-10 px-3 rounded-md border border-gray-200 text-sm bg-white"
					/>
					<label className="h-10 px-3 rounded-md border border-gray-200 text-sm bg-white flex items-center gap-2">
						<input
							type="checkbox"
							checked={problemOnly}
							onChange={(e) => setProblemOnly(e.target.checked)}
						/>
						Проблемные
					</label>
				</div>
			</div>

			<div className="flex gap-2 flex-wrap">
				{STATUS_FILTERS.map((f) => (
					<button
						key={f.id}
						type="button"
						onClick={() => setStatus(f.value)}
						className={`px-3 py-2 rounded-md text-xs border ${
							(status ?? 'all') === (f.value ?? 'all')
								? 'bg-[#F2E8EA] border-[#7B1931] text-black'
								: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
						}`}
					>
						{f.label}
					</button>
				))}
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

			{!isLoading && !error && (
				<div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-auto">
					<table className="min-w-[980px] w-full text-sm">
						<thead className="bg-gray-50 text-gray-600">
							<tr>
								<th className="text-left p-3">Заказ</th>
								<th className="text-left p-3">Дата</th>
								<th className="text-left p-3">Сумма</th>
								<th className="text-left p-3">Статус</th>
								<th className="text-left p-3">Доставка</th>
								<th className="text-left p-3">CDEK</th>
								<th className="text-left p-3">Трек</th>
							</tr>
						</thead>
						<tbody>
							{orders.length === 0 ? (
								<tr>
									<td className="p-4 text-gray-500" colSpan={7}>
										Нет заказов по текущим фильтрам.
									</td>
								</tr>
							) : (
								orders.map((order) => (
									<tr key={order.id} className="border-t border-gray-100">
										<td className="p-3">
											<Link
												href={`/management/orders/${order.id}`}
												className="text-[#7B1931] hover:underline font-medium"
											>
												№{order.orderNumber || order.id}
											</Link>
										</td>
										<td className="p-3 text-gray-600">
											{order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—'}
										</td>
										<td className="p-3 text-gray-700">
											{order.totalAmount ?? '—'}
										</td>
										<td className="p-3">
											{order.status ? <OrderStatusBadge status={order.status} /> : '—'}
										</td>
										<td className="p-3 text-gray-600">{order.deliveryType ?? '—'}</td>
										<td className="p-3 text-gray-600">{order.cdekStatus ?? '—'}</td>
										<td className="p-3 text-gray-600">{order.cdekTrackNumber ?? order.trackingNumber ?? '—'}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

