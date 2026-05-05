import { fetchWithAuth } from '@/shared/lib/apiClient'
import type { OrderEntity } from '@/features/Orders/model/types'
import type { PaymentEntity } from '@/features/Orders/model/types'

export type ManagementOrderEntity = OrderEntity & {
	cdekStatus?: string | null
	cdekTrackNumber?: string | null
	trackingNumber?: string | null
	customerData?: unknown
}

export type ManagementOrdersQuery = {
	status?: string
	q?: string
	dateFrom?: string
	dateTo?: string
	deliveryType?: string
	paymentMethod?: string
	problemOnly?: boolean
	page?: number
	pageSize?: number
}

type ApiResponse<T> = {
	success: boolean
	data?: T
	message?: string
	error?: string
	meta?: unknown
}

export type ManagementPaymentEntity = PaymentEntity & {
	paymentId?: string | null
	sessionId?: string | null
	externalId?: string | null
	paymentData?: unknown
}

export const managementOrdersApi = {
	async getOrders(query: ManagementOrdersQuery, token: string): Promise<{ orders: ManagementOrderEntity[]; meta?: unknown }> {
		const params = new URLSearchParams()
		if (query.status) params.set('status', query.status)
		if (query.q) params.set('q', query.q)
		if (query.dateFrom) params.set('dateFrom', query.dateFrom)
		if (query.dateTo) params.set('dateTo', query.dateTo)
		if (query.deliveryType) params.set('deliveryType', query.deliveryType)
		if (query.paymentMethod) params.set('paymentMethod', query.paymentMethod)
		if (typeof query.problemOnly === 'boolean') params.set('problemOnly', String(query.problemOnly))
		if (query.page) params.set('page', String(query.page))
		if (query.pageSize) params.set('pageSize', String(query.pageSize))

		const response = await fetchWithAuth(`/api/management/orders?${params.toString()}`, {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error(`Не удалось получить заказы: ${response.status}`)
		}

		const data: ApiResponse<ManagementOrderEntity[]> = await response.json()
		if (!data.success || !data.data) {
			throw new Error(data.message || data.error || 'Не удалось получить заказы')
		}

		return { orders: data.data, meta: data.meta }
	},

	async getOrderById(id: number, token: string): Promise<ManagementOrderEntity> {
		const response = await fetchWithAuth(`/api/management/orders/${id}`, {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error(`Не удалось получить заказ: ${response.status}`)
		}

		const data: ApiResponse<ManagementOrderEntity> = await response.json()
		if (!data.success || !data.data) {
			throw new Error(data.message || data.error || 'Не удалось получить заказ')
		}

		return data.data
	},

	async getOrderPayments(orderId: number, token: string): Promise<ManagementPaymentEntity[]> {
		const response = await fetchWithAuth(`/api/management/orders/${orderId}/payments`, {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error(`Не удалось получить платежи заказа: ${response.status}`)
		}

		const data: ApiResponse<
			Array<{
				id: number
				status: string
				amount?: number | string
				currency?: string
				paymentId?: string | null
				sessionId?: string | null
				externalId?: string | null
				paymentMethod?: string
				provider?: string | null
				paymentUrl?: string | null
				refundId?: string | null
				refundStatus?: string | null
				refundedAt?: string | null
				paymentData?: unknown
				createdAt: string
				updatedAt: string
			}>
		> = await response.json()
		if (!data.success || !data.data) {
			return []
		}

		return data.data.map((raw) => ({
			id: raw.id,
			status: raw.status as PaymentEntity['status'],
			amount: Number(raw.amount || 0),
			currency: raw.currency || 'RUB',
			paymentId: raw.paymentId || null,
			sessionId: raw.sessionId || null,
			externalId: raw.externalId || null,
			paymentMethod: raw.paymentMethod,
			provider: (raw.provider || null) as PaymentEntity['provider'],
			paymentUrl: raw.paymentUrl || null,
			refundId: raw.refundId || null,
			refundStatus: (raw.refundStatus as PaymentEntity['refundStatus']) || null,
			refundedAt: raw.refundedAt || null,
			paymentData: raw.paymentData,
			createdAt: raw.createdAt,
			updatedAt: raw.updatedAt,
		}))
	},

	async syncTochkaPaymentStatus(paymentId: number, token: string): Promise<{
		status: PaymentEntity['status']
		rawStatus?: unknown
	}> {
		const response = await fetchWithAuth(
			`/api/management/payments/${paymentId}/tochka-status-sync`,
			{
				method: 'POST',
				accessToken: token,
			}
		)

		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			throw new Error(
				body?.message ||
					body?.error ||
					`Не удалось синхронизировать статус платежа: ${response.status}`
			)
		}

		const data: ApiResponse<{ status: PaymentEntity['status']; rawStatus?: unknown }> =
			await response.json()

		if (!data.success || !data.data) {
			throw new Error(data.message || data.error || 'Не удалось получить статус платежа')
		}

		return data.data
	},
}

