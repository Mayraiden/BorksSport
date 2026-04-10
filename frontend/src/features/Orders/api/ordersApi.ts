import type { OrderEntity, PaymentEntity } from '../model/types'
import type { OrderStatus, PaymentType, PaymentProvider, ShippingAddress } from '@/features/Checkout/model/types'
import { fetchWithAuth } from '@/shared/lib/apiClient'

interface ApiResponse<T> {
	success: boolean
	data?: T
	message?: string
	error?: string
}

interface RawOrderItem {
	productId?: number | string
	product_id?: number | string
	name?: string
	title?: string
	article?: string | null
	quantity?: number | string
	price?: number | string
	productPrice?: number | string
	subtotal?: number | string
	image?: string | null
	thumbnail?: string | null
}

interface RawOrder {
	id: number
	orderNumber: string
	status: string
	totalAmount?: number | string
	deliveryType: string
	cdekDeliveryCost?: number | string
	paymentMethod: string
	paymentProvider?: string | null
	notes?: string | null
	shippingAddress: unknown
	items?: RawOrderItem[]
	createdAt: string
	updatedAt: string
}

const mapOrder = (raw: RawOrder): OrderEntity => {
	const itemsArray = Array.isArray(raw.items) ? raw.items : []

	return {
		id: raw.id,
		orderNumber: raw.orderNumber,
		status: raw.status as OrderStatus,
		totalAmount: Number(raw.totalAmount || 0),
		deliveryType: raw.deliveryType as 'door' | 'pvz' | 'pickup' | undefined,
		cdekDeliveryCost: raw.cdekDeliveryCost
			? Number(raw.cdekDeliveryCost)
			: null,
		paymentMethod: raw.paymentMethod as PaymentType | undefined,
		paymentProvider: (raw.paymentProvider || null) as PaymentProvider | null,
		notes: raw.notes || null,
		shippingAddress: raw.shippingAddress as ShippingAddress | undefined,
		items: itemsArray.map((item: RawOrderItem) => {
			const price = Number(item.price ?? item.productPrice ?? 0)
			const quantity = Number(item.quantity ?? 0)
			const subtotal =
				item.subtotal !== undefined
					? Number(item.subtotal)
					: price * quantity
			return {
				productId: Number(item.productId || item.product_id || 0),
				name: item.name || item.title || `Товар ${item.productId}`,
				article: item.article || null,
				quantity,
				price,
				subtotal,
				image: item.image || item.thumbnail || null,
			}
		}),
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
	}
}

interface RawPayment {
	id: number
	status: string
	amount?: number | string
	currency?: string
	paymentMethod: string
	provider?: string | null
	paymentUrl?: string | null
	refundId?: string | null
	refundStatus?: string | null
	refundedAt?: string | null
	createdAt: string
	updatedAt: string
}

const mapPayment = (raw: RawPayment): PaymentEntity => ({
	id: raw.id,
	status: raw.status as 'pending' | 'paid' | 'failed' | 'refunded',
	amount: Number(raw.amount || 0),
	currency: raw.currency || 'RUB',
	paymentMethod: raw.paymentMethod,
	provider: (raw.provider || null) as PaymentProvider | null,
	paymentUrl: raw.paymentUrl || null,
	refundId: raw.refundId || null,
	refundStatus: (raw.refundStatus as PaymentEntity['refundStatus']) || null,
	refundedAt: raw.refundedAt || null,
	createdAt: raw.createdAt,
	updatedAt: raw.updatedAt,
})

export const ordersApi = {
	async getOrders(token: string): Promise<OrderEntity[]> {
		const response = await fetchWithAuth('/api/orders', {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error(`Не удалось получить список заказов: ${response.status}`)
		}

		const data: ApiResponse<RawOrder[]> = await response.json()
		if (!data.success || !data.data) {
			throw new Error(data.message || data.error || 'Не удалось получить заказы')
		}

		return data.data.map(mapOrder)
	},

	async getOrderById(orderId: number, token: string): Promise<OrderEntity> {
		const response = await fetchWithAuth(`/api/orders/${orderId}`, {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error(`Не удалось получить заказ #${orderId}`)
		}

		const data: ApiResponse<RawOrder> = await response.json()
		if (!data.success || !data.data) {
			throw new Error(data.message || data.error || 'Не удалось получить заказ')
		}

		return mapOrder(data.data)
	},

	async getPaymentsForOrder(orderId: number, token: string): Promise<PaymentEntity[]> {
		const response = await fetchWithAuth(`/api/payments?orderId=${orderId}`, {
			method: 'GET',
			accessToken: token,
		})

		if (!response.ok) {
			throw new Error('Не удалось получить платежи заказа')
		}

		const data: ApiResponse<RawPayment[]> = await response.json()
		if (!data.success || !data.data) {
			return []
		}

		return data.data.map(mapPayment)
	},

	async cancelOrder(orderId: number, token: string): Promise<void> {
		const response = await fetchWithAuth(`/api/orders/${orderId}/cancel`, {
			method: 'POST',
			accessToken: token,
		})

		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			throw new Error(body?.message || body?.error || 'Не удалось отменить заказ')
		}
	},
}


