import type {
	OrderStatus,
	PaymentProvider,
	PaymentType,
	ShippingAddress,
} from '@/features/Checkout/model/types'

export interface OrderItemSummary {
	productId: number
	name: string
	article?: string | null
	quantity: number
	price: number
	subtotal: number
	image?: string | null
}

export interface OrderEntity {
	id: number
	orderNumber: string
	status: OrderStatus
	totalAmount: number
	deliveryType?: 'door' | 'pvz' | 'pickup'
	cdekDeliveryCost?: number | null
	cdekStatus?: string | null
	cdekTrackNumber?: string | null
	cdekPvzAddress?: string | null
	cancelReason?: string | null
	cancelledAt?: string | null
	paymentMethod?: PaymentType
	paymentProvider?: PaymentProvider
	notes?: string | null
	shippingAddress?: ShippingAddress
	items: OrderItemSummary[]
	createdAt: string
	updatedAt?: string
}

export interface PaymentEntity {
	id: number
	status: 'pending' | 'paid' | 'failed' | 'refunded'
	amount: number
	currency?: string
	paymentMethod?: string
	provider?: PaymentProvider | null
	paymentUrl?: string | null
	refundId?: string | null
	refundStatus?: 'none' | 'pending' | 'succeeded' | 'failed' | null
	refundedAt?: string | null
	createdAt: string
	updatedAt?: string
}


