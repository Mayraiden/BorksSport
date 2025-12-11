/**
 * Типы для модуля оформления заказа
 * Архитектура с заделом на интеграции СДЭК и Точка банк
 */

// ============================================
// Основные типы данных заказа
// ============================================

export type DeliveryType = 'pickup' | 'delivery'

export type DeliveryOption = 'door' | 'pickup_point'

export type PaymentType = 'online' | 'cash_on_delivery'

export type PaymentProvider = 'tochka' | 'sbp' | 'card' | null

export type OrderStatus =
	| 'pending'
	| 'awaiting_payment'
	| 'paid'
	| 'payment_failed'
	| 'shipped'
	| 'delivered'
	| 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

/**
 * Данные покупателя
 */
export interface CustomerData {
	name: string
	phone: string
	email: string
}

/**
 * Адрес для самовывоза
 */
export interface PickupAddress {
	address: string
	workingHours?: string
}

/**
 * Адрес для доставки
 */
export interface DeliveryAddress {
	city: string
	street: string
	house: string
	apartment?: string
}

/**
 * Выбранный ПВЗ
 */
export interface SelectedPvz {
	code: string
	address: string
	name: string
}

/**
 * Полный адрес доставки
 */
export type ShippingAddress = {
	type: 'pickup'
	pickupAddress: PickupAddress
} | {
	type: 'delivery'
	deliveryAddress: DeliveryAddress
	deliveryOption: DeliveryOption
	selectedPvz?: SelectedPvz
}

/**
 * Данные доставки
 */
export interface DeliveryData {
	type: DeliveryType
	address: ShippingAddress
	// Задел для СДЭК: стоимость доставки будет рассчитываться через API
	deliveryCost?: number
	deliveryDate?: string // Дата доставки от СДЭК
	deliveryTime?: string // Время доставки от СДЭК
}

/**
 * Способ оплаты при получении
 */
export type CashOnDeliveryMethod = 'cash' | 'card'

/**
 * Способ оплаты
 */
export interface PaymentData {
	type: PaymentType
	provider?: PaymentProvider // Для онлайн оплаты: 'tochka', 'sbp', 'card'
	cashOnDeliveryMethod?: CashOnDeliveryMethod // Для оплаты при получении: 'cash' | 'card'
	// Задел для Точка банк: будут дополнительные поля для токенов и т.д.
	paymentToken?: string // Токен платежа от Точка банк
	redirectUrl?: string // URL для редиректа на оплату
}

/**
 * Позиция заказа
 */
export interface OrderItem {
	productId: string
	quantity: number
	price: number
}

/**
 * Полная форма оформления заказа
 */
export interface CheckoutFormData {
	customer: CustomerData
	delivery: DeliveryData
	payment: PaymentData
	agreements: {
		publicOffer: boolean
		personalData: boolean
	}
	notes?: string
}

/**
 * Ответ от API создания заказа
 */
export interface OrderResponse {
	id: number
	orderNumber: string
	status: OrderStatus
	totalAmount: number
	items: OrderItem[]
	shippingAddress: ShippingAddress
	paymentMethod: PaymentType
	paymentProvider?: PaymentProvider
	createdAt: string
}

export interface PaymentSessionResponse {
	paymentId: number
	orderId: number
	externalId: string
	sessionId: string
	status: string
	paymentUrl?: string
	expiresAt?: string
}

export interface PaymentStatusResponse {
	status: PaymentStatus
	rawStatus?: unknown
}

// ============================================
// Абстракции для интеграций
// ============================================

/**
 * Абстракция для расчета стоимости доставки (СДЭК)
 * Будет реализована после интеграции
 */
export interface DeliveryCalculator {
	calculateCost: (
		address: DeliveryAddress,
		items: OrderItem[]
	) => Promise<{
		cost: number
		deliveryDate?: string
		deliveryTime?: string
		availableTariffs?: Array<{
			id: string
			name: string
			cost: number
			deliveryDate: string
		}>
	}>
}

/**
 * Абстракция для платежной системы (Точка банк)
 * Будет реализована после интеграции
 */
export interface PaymentProviderInterface {
	createPayment: (
		amount: number,
		orderId: string,
		metadata?: Record<string, unknown>
	) => Promise<{
		paymentToken: string
		redirectUrl: string
		status: 'pending' | 'success' | 'failed'
	}>

	checkPaymentStatus: (paymentToken: string) => Promise<{
		status: 'pending' | 'success' | 'failed'
		paymentId?: string
	}>
}

// ============================================
// Ошибки валидации
// ============================================

export interface CheckoutFormErrors {
	customer?: {
		name?: string
		phone?: string
		email?: string
	}
	delivery?: {
		city?: string
		street?: string
		house?: string
		apartment?: string
	}
	agreements?: {
		publicOffer?: string
		personalData?: string
	}
	general?: string
}

