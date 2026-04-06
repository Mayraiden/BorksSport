import { fetchWithAuth } from '@/shared/lib/apiClient'
import type { OrderEntity } from '@/features/Orders/model/types'

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
}

