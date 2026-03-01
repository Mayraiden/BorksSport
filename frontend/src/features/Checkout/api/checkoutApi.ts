import type {
	CheckoutFormData,
	OrderResponse,
	DeliveryAddress,
	OrderItem,
	PaymentSessionResponse,
	PaymentStatusResponse,
	ShippingAddress,
} from '../model/types'
import type { CartItemDisplay } from '@/features/Cart/api/cartApi'

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

const checkoutLogger = {
	maskToken(token?: string) {
		if (!token) return 'NO_TOKEN'
		return `${token.substring(0, 6)}…${token.substring(Math.max(token.length - 4, 6))}`
	},
	group(label: string, data: Record<string, unknown>) {
		if (typeof console.groupCollapsed === 'function') {
			console.groupCollapsed(`[CheckoutAPI] ${label}`)
			console.log(data)
			console.groupEnd()
		} else {
			console.log(`[CheckoutAPI] ${label}`, data)
		}
	},
	error(label: string, data: unknown) {
		console.error(`[CheckoutAPI] ${label}`, data)
	},
}

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
				// Определяем тариф (139 для до двери, 138 для ПВЗ)
				orderData.cdekTariffCode =
					deliveryType === 'door' ? 139 : 138

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

			checkoutLogger.group('POST /api/orders → request', {
				url: `${API_URL}/api/orders`,
				headers: {
					Authorization: checkoutLogger.maskToken(token),
				},
				payload: orderData,
			})

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
				if (response.status === 400) {
					const errorData = await response.json().catch(() => ({}))
					checkoutLogger.group('POST /api/orders ← error', {
						status: response.status,
						error: errorData,
					})
					throw new Error(
						errorData.message || 'Ошибка при создании заказа'
					)
				}
				checkoutLogger.group('POST /api/orders ← error', {
					status: response.status,
					error: await response.text().catch(() => 'Unknown error'),
				})
				throw new Error(`Ошибка сервера: ${response.status}`)
			}

			const data: ApiResponse<OrderResponse> = await response.json()

			checkoutLogger.group('POST /api/orders ← response', {
				status: response.status,
				body: data,
			})

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
			checkoutLogger.error('createOrder failed', error)
			throw error
		}
	},

	/**
	 * Рассчитать стоимость доставки через API СДЭК
	 */
	async calculateDeliveryCost(
		address: DeliveryAddress,
		items: OrderItem[],
		deliveryType: 'door' | 'pvz' = 'door',
		tariffCode?: number
	): Promise<{
		cost: number
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
			// Преобразуем товары в пакеты для СДЭК
			// Для расчета используем базовые значения веса и габаритов
			// В будущем можно получать реальные данные из API продуктов
			const packages = items.map((item) => {
				// Базовые значения: 1 кг, 30x20x15 см
				// В реальном проекте здесь нужно получать данные из API продукта
				const weightPerItem = 1000 // 1 кг в граммах
				const totalWeight = weightPerItem * item.quantity

				return {
					weight: totalWeight,
					length: 30, // см
					width: 20, // см
					height: 15, // см
				}
			})

			// Подготовка данных для запроса
			const requestData = {
				toLocation: {
					city: address.city,
					address: `${address.street}, ${address.house}${
						address.apartment ? `, кв. ${address.apartment}` : ''
					}`,
				},
				packages,
				tariffCode: tariffCode || (deliveryType === 'door' ? 139 : 138),
			}

			checkoutLogger.group('POST /api/cdek-sync/calculate → request', {
				payload: requestData,
			})

			const response = await fetch(`${API_URL}/api/cdek-sync/calculate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestData),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				checkoutLogger.group('POST /api/cdek-sync/calculate ← error', {
					status: response.status,
					error: errorData,
				})
				throw new Error(
					errorData.message || 'Не удалось рассчитать стоимость доставки'
				)
			}

			const data: ApiResponse<{
				tariff_codes: Array<{
					tariff_code: number
					tariff_name: string
					delivery_sum: number
					period_min: number
					period_max: number
				}>
			}> = await response.json()

			checkoutLogger.group('POST /api/cdek-sync/calculate ← response', {
				status: response.status,
				body: data,
			})

			if (!data.success || !data.data) {
				throw new Error('Не удалось получить расчет стоимости доставки')
			}

			// Выбираем первый доступный тариф (или по tariffCode)
			const selectedTariff =
				data.data.tariff_codes.find((t) => t.tariff_code === tariffCode) ||
				data.data.tariff_codes[0]

			if (!selectedTariff) {
				throw new Error('Нет доступных тарифов для доставки')
			}

			// Вычисляем дату доставки (сегодня + период доставки)
			const deliveryDate = new Date()
			deliveryDate.setDate(deliveryDate.getDate() + selectedTariff.period_max)

			return {
				cost: selectedTariff.delivery_sum,
				deliveryDate: deliveryDate.toISOString().split('T')[0],
				deliveryTime: `${selectedTariff.period_min}-${selectedTariff.period_max} дней`,
				availableTariffs: data.data.tariff_codes.map((t) => ({
					tariffCode: t.tariff_code,
					tariffName: t.tariff_name,
					cost: t.delivery_sum,
					periodMin: t.period_min,
					periodMax: t.period_max,
				})),
			}
		} catch (error) {
			checkoutLogger.error('calculateDeliveryCost failed', error)
			// В случае ошибки возвращаем базовую стоимость
			return {
				cost: 990,
				deliveryDate: undefined,
				deliveryTime: undefined,
			}
		}
	},

	/**
	 * Создать сессию оплаты в Точка банк
	 */
	async createTochkaPaymentSession(
		orderId: number,
		token: string
	): Promise<PaymentSessionResponse> {
		checkoutLogger.group('POST /api/payments/tochka/session → request', {
			orderId,
			headers: {
				Authorization: checkoutLogger.maskToken(token),
			},
		})

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
			checkoutLogger.group('POST /api/payments/tochka/session ← error', {
				status: response.status,
				error: errorData,
			})
			throw new Error(
				errorData.message || errorData.error || 'Не удалось создать платеж'
			)
		}

		const data: ApiResponse<PaymentSessionResponse> = await response.json()

		checkoutLogger.group('POST /api/payments/tochka/session ← response', {
			status: response.status,
			body: data,
		})

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
		checkoutLogger.group('GET /api/payments/tochka/:id/status → request', {
			paymentId,
			headers: {
				Authorization: checkoutLogger.maskToken(token),
			},
		})

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
			checkoutLogger.group('GET /api/payments/tochka/:id/status ← error', {
				paymentId,
				status: response.status,
				error: errorData,
			})
			throw new Error(
				errorData.message || errorData.error || 'Не удалось получить статус платежа'
			)
		}

		const data: ApiResponse<PaymentStatusResponse> = await response.json()

		checkoutLogger.group('GET /api/payments/tochka/:id/status ← response', {
			paymentId,
			status: response.status,
			body: data,
		})

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

			checkoutLogger.group('GET /api/cdek-sync/cities → request', {
				query,
			})

			const response = await fetch(
				`${API_URL}/api/cdek-sync/cities?query=${encodeURIComponent(query)}`
			)

			if (!response.ok) {
				checkoutLogger.group('GET /api/cdek-sync/cities ← error', {
					status: response.status,
					body: await response.text().catch(() => ''),
				})
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

			checkoutLogger.group('GET /api/cdek-sync/cities ← response', {
				status: response.status,
				body: data,
			})

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
		} catch (error) {
			checkoutLogger.error('searchCities failed', error)
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

			checkoutLogger.group('GET /api/cdek-sync/pvz-list → request', {
				cityCode,
			})

			const response = await fetch(
				`${API_URL}/api/cdek-sync/pvz-list?cityCode=${cityCode}`
			)

			if (!response.ok) {
				checkoutLogger.group('GET /api/cdek-sync/pvz-list ← error', {
					status: response.status,
					body: await response.text().catch(() => ''),
				})
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

			checkoutLogger.group('GET /api/cdek-sync/pvz-list ← response', {
				status: response.status,
				body: data,
			})

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
		} catch (error) {
			checkoutLogger.error('getPvzList failed', error)
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

			checkoutLogger.group('detectCity → geo result', {
				city: geoData.city,
				region: geoData.region,
			})

			const cities = await checkoutApi.searchCities(geoData.city)

			if (cities.length === 0) return null

			return {
				code: cities[0].code,
				city: cities[0].city,
				region: cities[0].region,
			}
		} catch (error) {
			checkoutLogger.error('detectCity failed', error)
			return null
		}
	},
}

