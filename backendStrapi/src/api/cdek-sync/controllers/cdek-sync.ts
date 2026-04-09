import type { Core } from '@strapi/strapi'

const webhookRateLimit = new Map<string, { count: number; windowStart: number }>()
const WEBHOOK_WINDOW_MS = 60_000
const WEBHOOK_MAX_PER_WINDOW = 120

const mapCdekStatusToOrderStatus = (
	rawStatus: unknown
): 'shipped' | 'delivered' | undefined => {
	const value = String(rawStatus ?? '').trim()
	if (!value) return undefined

	const normalized = value.toLowerCase()

	// Delivered / handed to recipient
	if (
		normalized.includes('delivered') ||
		normalized.includes('handed') ||
		normalized.includes('received') ||
		normalized.includes('вручен') ||
		normalized.includes('доставлен')
	) {
		return 'delivered'
	}

	// In transit / shipped / accepted
	if (
		normalized.includes('shipped') ||
		normalized.includes('in_transit') ||
		normalized.includes('transit') ||
		normalized.includes('accepted') ||
		normalized.includes('created') ||
		normalized.includes('pickup') ||
		normalized.includes('передан') ||
		normalized.includes('принят') ||
		normalized.includes('в пути') ||
		normalized.includes('отправ')
	) {
		return 'shipped'
	}

	return undefined
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	/**
	 * Тест авторизации в СДЭК
	 * GET /api/cdek-sync/test-auth
	 */
	async testAuth(ctx: any) {
		try {
			const service = strapi.service('api::cdek-sync.cdek-sync')
			const token = await service.getAccessToken()
			const config = service.getConfig()

			ctx.body = {
				success: true,
				data: {
					authenticated: !!token,
					config: {
						apiUrl: config.apiUrl,
						hasCredentials: config.hasCredentials,
						warehouseConfigured: config.warehouseConfigured,
					},
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to authenticate with CDEK',
			}
		}
	},

	/**
	 * Поиск городов
	 * GET /api/cdek-sync/cities?query=Москва
	 */
	async searchCities(ctx: any) {
		try {
			const { query } = ctx.query

			if (!query || typeof query !== 'string') {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Query parameter is required',
				}
				return
			}

			const service = strapi.service('api::cdek-sync.cdek-sync')
			const cities = await service.searchCities(query)

			ctx.body = {
				success: true,
				data: cities,
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to search cities',
			}
		}
	},

	/**
	 * Получение списка ПВЗ по коду города
	 * GET /api/cdek-sync/pvz-list?cityCode=270
	 */
	async getPvzList(ctx: any) {
		try {
			const { cityCode } = ctx.query

			if (!cityCode) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'cityCode parameter is required',
				}
				return
			}

			const cityCodeNumber = parseInt(cityCode, 10)
			if (isNaN(cityCodeNumber)) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'cityCode must be a number',
				}
				return
			}

			const service = strapi.service('api::cdek-sync.cdek-sync')
			const pvzList = await service.getPvzList(cityCodeNumber)

			ctx.body = {
				success: true,
				data: pvzList,
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to get PVZ list',
			}
		}
	},

	/**
	 * Расчет стоимости доставки
	 * POST /api/cdek-sync/calculate
	 * Body: {
	 *   toLocation: { city, address?, postal_code? },
	 *   packages: [{ weight, length?, width?, height? }],
	 *   tariffCode?: number
	 * }
	 */
	async calculate(ctx: any) {
		try {
			const { toLocation, packages, tariffCode } = ctx.request.body

			if (!toLocation || !packages || !Array.isArray(packages)) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'toLocation and packages are required',
				}
				return
			}

			if (packages.length === 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'At least one package is required',
				}
				return
			}

			// Валидация пакетов
			for (const pkg of packages) {
				if (!pkg.weight || pkg.weight <= 0) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Each package must have weight > 0',
					}
					return
				}
			}

			const service = strapi.service('api::cdek-sync.cdek-sync')
			const result = await service.calculateDelivery(
				toLocation,
				packages,
				tariffCode
			)

			ctx.body = {
				success: true,
				data: result,
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to calculate delivery',
			}
		}
	},

	/**
	 * Создание заказа в СДЭК
	 * POST /api/cdek-sync/create-order
	 * Body: CDEKOrderRequest
	 */
	async createOrder(ctx: any) {
		try {
			const orderData = ctx.request.body

			if (!orderData) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Order data is required',
				}
				return
			}

			// Валидация обязательных полей
			if (!orderData.tariff_code || !orderData.to_location || !orderData.recipient) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'tariff_code, to_location, and recipient are required',
				}
				return
			}

			const service = strapi.service('api::cdek-sync.cdek-sync')
			const result = await service.createOrder(orderData)

			ctx.body = {
				success: true,
				data: result,
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to create order in CDEK',
			}
		}
	},

	/**
	 * Отслеживание заказа
	 * GET /api/cdek-sync/track/:trackNumber
	 */
	async track(ctx: any) {
		try {
			const { trackNumber } = ctx.params

			if (!trackNumber) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Track number is required',
				}
				return
			}

			const service = strapi.service('api::cdek-sync.cdek-sync')
			const result = await service.trackOrder(trackNumber)

			ctx.body = {
				success: true,
				data: result,
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to track order',
			}
		}
	},

	/**
	 * Webhook для обновления статусов от СДЭК
	 * POST /api/cdek-sync/webhook
	 */
	async webhook(ctx: any) {
		try {
			const ip = ctx.request.ip || ctx.request.ips?.[0] || 'unknown'
			const now = Date.now()
			const entry = webhookRateLimit.get(ip)
			if (!entry || now - entry.windowStart > WEBHOOK_WINDOW_MS) {
				webhookRateLimit.set(ip, { count: 1, windowStart: now })
			} else {
				entry.count += 1
				if (entry.count > WEBHOOK_MAX_PER_WINDOW) {
					ctx.status = 429
					ctx.body = { success: false, message: 'Too many webhook requests' }
					return
				}
			}

			const expectedToken = process.env.CDEK_WEBHOOK_TOKEN
			if (expectedToken) {
				const token = String(ctx.request.query?.token || '').trim()
				if (!token || token !== expectedToken) {
					ctx.status = 401
					ctx.body = { success: false, message: 'Unauthorized webhook' }
					return
				}
			}

			const webhookData = ctx.request.body
			const uuid = webhookData?.entity?.uuid
			const status = webhookData?.entity?.status
			const trackNumber =
				webhookData?.entity?.cdek_number ||
				webhookData?.entity?.cdekNumber ||
				webhookData?.entity?.track_number ||
				webhookData?.entity?.trackNumber ||
				webhookData?.entity?.number

			if (!uuid || typeof uuid !== 'string') {
				ctx.status = 400
				ctx.body = { success: false, message: 'Invalid webhook payload: missing entity.uuid' }
				return
			}

			strapi.log.info('CDEK Webhook received', webhookData)

			// Обработка webhook от СДЭК
			// Здесь можно обновить статус заказа в базе данных
			// Пример: обновление статуса заказа по UUID

			if (uuid) {
				const order = await strapi.entityService.findMany('api::order.order', {
					filters: { cdekOrderUuid: uuid },
				})

				if (order.length > 0) {
					const nextCdekStatus = status
					const mappedOrderStatus = mapCdekStatusToOrderStatus(nextCdekStatus)

					// Обновляем статус заказа
					await strapi.entityService.update('api::order.order', order[0].id, {
						data: {
							cdekStatus: nextCdekStatus,
							...(trackNumber
								? { cdekTrackNumber: String(trackNumber).trim() }
								: {}),
							...(mappedOrderStatus ? { status: mappedOrderStatus } : {}),
							// Дополнительные поля по необходимости
						},
					})
				}
			}

			ctx.body = {
				success: true,
				message: 'Webhook processed',
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to process webhook',
			}
		}
	},
})

