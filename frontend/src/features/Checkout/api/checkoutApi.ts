import type {
	CheckoutFormData,
	OrderResponse,
	DeliveryAddress,
	PaymentSessionResponse,
	PaymentStatusResponse,
	ShippingAddress,
} from '../model/types'
import type { CartItemDisplay } from '@/features/Cart/api/cartApi'

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

interface ApiResponse<T> {
	success: boolean
	data?: T
	message?: string
	error?: string
}

/**
 * API для оформления заказа
 * С заделом на интеграции с СДЭК и Точка банк
 */
export const checkoutApi = {
	/**
	 * Создать заказ
	 */
	async createOrder(
		formData: CheckoutFormData,
		cartItems: CartItemDisplay[],
		token: string
	): Promise<OrderResponse> {
		try {
			// Преобразуем товары из корзины в формат заказа
			const items = cartItems.map((item) => ({
				productId: item.product.id,
				quantity: item.quantity,
				price: item.product.price,
			}))

		// Определяем тип доставки
		const deliveryType =
			formData.delivery.type === 'delivery'
				? formData.delivery.address.type === 'delivery' &&
				  formData.delivery.address.deliveryOption === 'door'
					? 'door'
					: 'pvz'
				: 'pickup'

			// Формируем данные для отправки
			const orderData: {
				items: Array<{ productId: string; quantity: number; price: number }>
				shippingAddress: ShippingAddress
				paymentMethod: string
				paymentProvider: string | null
				notes: string | null
				customerData: CheckoutFormData['customer']
				deliveryType: string
				cdekDeliveryCost?: number
				cdekTariffCode?: number
				cdekPvzCode?: string
				cdekPvzAddress?: string
			} = {
				items,
				shippingAddress: formData.delivery.address,
				paymentMethod: formData.payment.type,
				paymentProvider: formData.payment.provider || null,
				notes: formData.notes || null,
				customerData: formData.customer,
				deliveryType,
			}

			// Добавляем данные СДЭК, если доставка не самовывоз
			if (deliveryType !== 'pickup' && formData.delivery.deliveryCost) {
				orderData.cdekDeliveryCost = formData.delivery.deliveryCost
				if (formData.delivery.deliveryTariffCode) {
					orderData.cdekTariffCode = formData.delivery.deliveryTariffCode
				}

				// Если ПВЗ, добавляем код и адрес ПВЗ
				if (
					deliveryType === 'pvz' &&
					formData.delivery.address.type === 'delivery' &&
					formData.delivery.address.selectedPvz
				) {
					orderData.cdekPvzCode = formData.delivery.address.selectedPvz.code
					orderData.cdekPvzAddress = formData.delivery.address.selectedPvz.address
				}
			}


			const response = await fetch(`${API_URL}/api/orders`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(orderData),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Необходимо войти в аккаунт')
				}
				if (response.status === 403) {
					const errorData = await response.json().catch(() => ({}))
					if (errorData.code === 'EMAIL_NOT_CONFIRMED') {
						throw new Error('Подтвердите email, чтобы оформить заказ')
					}
					throw new Error(errorData.message || 'Действие недоступно')
				}
				if (response.status === 409) {
					const errorData = await response.json().catch(() => ({}))
					throw new Error(errorData.message || 'Недостаточно товара')
				}
				if (response.status === 400) {
					const errorData = await response.json().catch(() => ({}))
					throw new Error(
						errorData.message || 'Ошибка при создании заказа'
					)
				}
				throw new Error(`Ошибка сервера: ${response.status}`)
			}

			const data: ApiResponse<OrderResponse> = await response.json()


			if (!data.success || !data.data) {
				throw new Error(
					data.message || data.error || 'Не удалось создать заказ'
				)
			}

			const order = data.data

			return {
				...order,
				totalAmount: typeof order.totalAmount === 'string'
					? Number(order.totalAmount)
					: order.totalAmount,
			}
		} catch (error) {
			throw error
		}
	},

	/**
	 * Рассчитать стоимость доставки через API СДЭК
	 */
	async calculateDeliveryCost(
		address: DeliveryAddress,
		cartItems: CartItemDisplay[],
		deliveryType: 'door' | 'pvz' = 'door',
		tariffCode?: number
	): Promise<{
		cost: number
		tariffCode?: number
		deliveryDate?: string
		deliveryTime?: string
		availableTariffs?: Array<{
			tariffCode: number
			tariffName: string
			cost: number
			periodMin: number
			periodMax: number
		}>
	}> {
		try {
			const formatEuDate = (iso: string | undefined): string | undefined => {
				if (!iso) return undefined
				const [y, m, d] = iso.split('-')
				if (!y || !m || !d) return iso
				return `${d}.${m}.${y}`
			}

			const pluralizeDays = (n: number): string => {
				const abs = Math.abs(n)
				const mod10 = abs % 10
				const mod100 = abs % 100
				if (mod100 >= 11 && mod100 <= 14) return 'дней'
				if (mod10 === 1) return 'день'
				if (mod10 >= 2 && mod10 <= 4) return 'дня'
				return 'дней'
			}

			const formatDeliveryDays = (minDays: number, maxDays: number): string => {
				if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) return ''
				if (minDays <= 0 || maxDays <= 0) return ''
				if (minDays === maxDays) {
					return `${minDays} ${pluralizeDays(minDays)}`
				}
				return `${minDays}-${maxDays} ${pluralizeDays(maxDays)}`
			}

			const mmToCmInt = (valueMm: unknown): number | undefined => {
				const n = Number(valueMm)
				if (!Number.isFinite(n) || n <= 0) return undefined
				// Stored as millimeters in our catalog; CDEK expects centimeters (int).
				const cm = n / 10
				return Math.max(1, Math.ceil(cm))
			}

			// Преобразуем товары в пакеты для СДЭК
			// Uses real product dimensions when available; falls back to safe defaults.
			const packages = cartItems.map((cartItem) => {
				const quantity = Number(cartItem.quantity || 1)
				const product = cartItem.product

				// Weight is expected in grams in our system (from Saby).
				const weightPerUnit = Number(product.weight || 1000) // default 1000g
				const totalWeight = Math.max(1, Math.round(weightPerUnit * quantity))

				const length = mmToCmInt(product.length)
				const width = mmToCmInt(product.width)
				const height = mmToCmInt(product.height)

				return {
					weight: totalWeight,
					length,
					width,
					height,
				}
			})

			const hasStreet = Boolean(address.street && address.street.trim())
			const hasHouse = Boolean(address.house && address.house.trim())
			const toAddress =
				hasStreet && hasHouse
					? `${address.street}, ${address.house}${
							address.apartment ? `, кв. ${address.apartment}` : ''
						}`
					: undefined

			// Подготовка данных для запроса
			const requestData = {
				toLocation: {
					city: address.city,
					...(toAddress ? { address: toAddress } : {}),
				},
				packages,
				tariffCode: tariffCode || (deliveryType === 'door' ? 139 : 138),
			}


			const response = await fetch(`${API_URL}/api/cdek-sync/calculate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestData),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(
					errorData.message || 'Не удалось рассчитать стоимость доставки'
				)
			}

			const data: ApiResponse<{
				tariff_codes: Array<{
					tariff_code: number
					tariff_name: string
					delivery_mode: number
					delivery_sum: number
					period_min: number
					period_max: number
				}>
			}> = await response.json()


			if (!data.success || !data.data) {
				throw new Error('Не удалось получить расчет стоимости доставки')
			}

			const allowedDeliveryModes =
				deliveryType === 'door' ? new Set([1, 3]) : new Set([4])

			const tariffs = (data.data.tariff_codes || []).filter((t) =>
				allowedDeliveryModes.has(t.delivery_mode)
			)

			// Prefer exact tariffCode match when it exists, otherwise choose minimal price.
			const selectedTariff =
				(tariffCode
					? tariffs.find((t) => t.tariff_code === tariffCode)
					: undefined) ||
				tariffs.reduce<(typeof tariffs)[number] | null>((min, t) => {
					if (!min) return t
					return t.delivery_sum < min.delivery_sum ? t : min
				}, null)

			if (!selectedTariff) {
				throw new Error('Нет доступных тарифов для выбранного типа доставки')
			}

			// Вычисляем дату доставки (сегодня + период доставки)
			const deliveryDate = new Date()
			deliveryDate.setDate(deliveryDate.getDate() + selectedTariff.period_max)
			const deliveryDateIso = deliveryDate.toISOString().split('T')[0]

			return {
				cost: selectedTariff.delivery_sum,
				tariffCode: selectedTariff.tariff_code,
				deliveryDate: formatEuDate(deliveryDateIso),
				deliveryTime: formatDeliveryDays(
					selectedTariff.period_min,
					selectedTariff.period_max
				),
				availableTariffs: data.data.tariff_codes.map((t) => ({
					tariffCode: t.tariff_code,
					tariffName: t.tariff_name,
					cost: t.delivery_sum,
					periodMin: t.period_min,
					periodMax: t.period_max,
				})),
			}
		} catch (error) {
			throw error
		}
	},

	/**
	 * Создать сессию оплаты в Точка банк
	 */
	async createTochkaPaymentSession(
		orderId: number,
		token: string
	): Promise<PaymentSessionResponse> {

		const response = await fetch(`${API_URL}/api/payments/tochka/session`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ orderId }),
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			if (response.status === 403 && errorData.code === 'EMAIL_NOT_CONFIRMED') {
				throw new Error('Подтвердите email, чтобы перейти к оплате')
			}
			throw new Error(
				errorData.message || errorData.error || 'Не удалось создать платеж'
			)
		}

		const data: ApiResponse<PaymentSessionResponse> = await response.json()


		if (!data.success || !data.data) {
			throw new Error(
				data.message || data.error || 'Не удалось получить ответ платежной системы'
			)
		}

		return data.data
	},

	/**
	 * Проверить статус платежа в Точка банк
	 */
	async getTochkaPaymentStatus(
		paymentId: number,
		token: string
	): Promise<PaymentStatusResponse> {

		const response = await fetch(
			`${API_URL}/api/payments/tochka/${paymentId}/status`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		)

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			throw new Error(
				errorData.message || errorData.error || 'Не удалось получить статус платежа'
			)
		}

		const data: ApiResponse<PaymentStatusResponse> = await response.json()


		if (!data.success || !data.data) {
			throw new Error(
				data.message || data.error || 'Не удалось получить статус платежа'
			)
		}

		return data.data
	},

	/**
	 * Поиск городов через API СДЭК
	 */
	async searchCities(query: string): Promise<
		Array<{
			code: number
			city: string
			region: string
			regionCode: number
			country: string
			postalCodes?: string[]
		}>
	> {
		try {
			if (!query || query.length < 2) {
				return []
			}


			const response = await fetch(
				`${API_URL}/api/cdek-sync/cities?query=${encodeURIComponent(query)}`
			)

			if (!response.ok) {
				return []
			}

			const data: ApiResponse<
				Array<{
					code: number
					city: string
					region: string
					region_code: number
					country: string
					postal_codes?: string[]
				}>
			> = await response.json()


			if (!data.success || !data.data) {
				return []
			}

			return data.data.map((city) => ({
				code: city.code,
				city: city.city,
				region: city.region,
				regionCode: city.region_code,
				country: city.country,
				postalCodes: city.postal_codes,
			}))
		} catch {
			return []
		}
	},

	/**
	 * Получить список ПВЗ по коду города
	 */
	async getPvzList(cityCode: number): Promise<
		Array<{
			code: string
			name: string
			address: string
			addressFull: string
			city: string
			region: string
			postalCode: string
			latitude: number
			longitude: number
			workTime: string
			phones?: Array<{ number: string }>
			email?: string
		}>
	> {
		try {
			if (!cityCode) {
				return []
			}


			const response = await fetch(
				`${API_URL}/api/cdek-sync/pvz-list?cityCode=${cityCode}`
			)

			if (!response.ok) {
				return []
			}

			const data: ApiResponse<
				Array<{
					code: string
					name: string
					location: {
						address: string
						address_full: string
						city: string
						region: string
						postal_code: string
						latitude: number
						longitude: number
					}
					work_time: string
					phones?: Array<{ number: string }>
					email?: string
				}>
			> = await response.json()


			if (!data.success || !data.data) {
				return []
			}

			return data.data.map((pvz) => ({
				code: pvz.code,
				name: pvz.name,
				address: pvz.location.address,
				addressFull: pvz.location.address_full,
				city: pvz.location.city,
				region: pvz.location.region,
				postalCode: pvz.location.postal_code,
				latitude: pvz.location.latitude,
				longitude: pvz.location.longitude,
				workTime: pvz.work_time,
				phones: pvz.phones,
				email: pvz.email,
			}))
		} catch {
			return []
		}
	},

	/**
	 * Определить город пользователя по IP-адресу,
	 * затем сопоставить с городом СДЭК для получения кода
	 */
	async detectCity(): Promise<{
		code: number
		city: string
		region: string
	} | null> {
		try {
			const geoResponse = await fetch('https://ipapi.co/json/', {
				signal: AbortSignal.timeout(5000),
			})

			if (!geoResponse.ok) return null

			const geoData: { city?: string; region?: string } =
				await geoResponse.json()

			if (!geoData.city) return null


			const cities = await checkoutApi.searchCities(geoData.city)

			if (cities.length === 0) return null

			return {
				code: cities[0].code,
				city: cities[0].city,
				region: cities[0].region,
			}
		} catch {
			return null
		}
	},
}

