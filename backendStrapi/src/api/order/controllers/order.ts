import { factories } from '@strapi/strapi'

const isEmailAuthDisabled = () => {
	const raw = process.env.EMAIL_AUTH_DISABLED
	return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * Генерирует номер заказа в формате Ozon: YYYYMMDD-XXXX
 * Где YYYYMMDD - дата создания заказа, XXXX - последовательный номер за день
 */
async function generateOrderNumber(strapi: any, maxRetries = 10): Promise<string> {
	const today = new Date()
	const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
	
	// Начало и конец дня для фильтрации
	const startOfDay = new Date(today)
	startOfDay.setHours(0, 0, 0, 0)
	const endOfDay = new Date(today)
	endOfDay.setHours(23, 59, 59, 999)

	let baseNumber = 1

	// Сначала получим базовый номер из последнего заказа
	try {
		const todayOrders = await strapi.entityService.findMany('api::order.order', {
			filters: {
				orderNumber: {
					$startsWith: dateStr,
				},
				createdAt: {
					$gte: startOfDay.toISOString(),
					$lte: endOfDay.toISOString(),
				},
			},
			sort: 'createdAt:desc',
			limit: 1,
		})

		if (todayOrders.length > 0) {
			const lastOrderNumber = todayOrders[0].orderNumber as string
			// Извлечь номер из формата YYYYMMDD-XXXX
			const match = lastOrderNumber.match(/^(\d{8})-(\d+)$/)
			if (match && match[2]) {
				const lastNumber = parseInt(match[2], 10)
				if (!isNaN(lastNumber)) {
					baseNumber = lastNumber + 1
				}
			}
		}
	} catch (error: any) {
		strapi.log.warn('Error getting base order number, starting from 1:', error)
	}

	// Теперь попробуем найти свободный номер
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const nextNumber = baseNumber + attempt
			const orderNumber = `${dateStr}-${String(nextNumber).padStart(4, '0')}`

			// Проверить уникальность (на случай параллельных запросов)
			const existingOrder = await strapi.entityService.findMany('api::order.order', {
				filters: {
					orderNumber,
				},
				limit: 1,
			})

			if (existingOrder.length === 0) {
				return orderNumber
			}

			// Если номер уже существует, попробуем следующий
			if (attempt < maxRetries - 1) {
				strapi.log.warn(`Order number ${orderNumber} already exists, trying next...`)
			}
		} catch (error: any) {
			strapi.log.error('Error checking order number uniqueness:', error)
			if (attempt === maxRetries - 1) {
				// Если все попытки исчерпаны, использовать fallback с timestamp
				const fallbackNumber = `${dateStr}-${Date.now().toString().slice(-4)}`
				strapi.log.warn(`Using fallback order number: ${fallbackNumber}`)
				return fallbackNumber
			}
		}
	}

	// Финальный fallback - используем timestamp для гарантии уникальности
	const fallbackNumber = `${dateStr}-${Date.now().toString().slice(-4)}`
	strapi.log.warn(`Max retries reached, using fallback order number: ${fallbackNumber}`)
	return fallbackNumber
}

const resolveUserId = async (strapi: any, ctx: any): Promise<number | null> => {
	let userId = ctx.state.user?.id

	if (!userId) {
		const authHeader = ctx.request.header?.authorization
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7)

			try {
				const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
				userId = id
			} catch {
				// ignore token errors, will fall back to 401 below
			}
		}
	}

	return userId ?? null
}

const requireConfirmedUser = async (strapi: any, ctx: any, userId: number): Promise<boolean> => {
	if (isEmailAuthDisabled()) {
		return true
	}

	const user = await strapi.db.query('plugin::users-permissions.user').findOne({
		where: { id: userId },
		select: ['id', 'confirmed'],
	})

	if (!user) {
		ctx.status = 401
		ctx.body = {
			success: false,
			message: 'User not authenticated',
		}
		return false
	}

	if (!user.confirmed) {
		ctx.status = 403
		ctx.body = {
			success: false,
			code: 'EMAIL_NOT_CONFIRMED',
			message: 'Please confirm your email before placing an order',
		}
		return false
	}

	return true
}

export default factories.createCoreController(
	'api::order.order',
	({ strapi }) => ({
		/**
		 * Get user orders
		 * GET /api/orders
		 */
		async find(ctx) {
			try {
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const canCreateOrder = await requireConfirmedUser(strapi, ctx, userId)
				if (!canCreateOrder) {
					return
				}

				const orders = await strapi.entityService.findMany('api::order.order', {
					filters: { user: { id: userId } },
					sort: 'createdAt:desc',
				})

				ctx.body = {
					success: true,
					data: orders,
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Create new order
		 * POST /api/orders
		 */
		async create(ctx) {
			try {
				const {
					items,
					shippingAddress,
					paymentMethod,
					notes,
					customerData,
					deliveryType,
					cdekTariffCode,
					cdekDeliveryCost,
					cdekPvzCode,
					cdekPvzAddress,
					paymentProvider,
				} = ctx.request.body
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				if (!items || !Array.isArray(items) || items.length === 0) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Order items are required',
					}
					return
				}

				if (!shippingAddress) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Shipping address is required',
					}
					return
				}

				// Calculate total amount
				let totalAmount = 0
				const products = []
				for (const item of items) {
					const product = await strapi.entityService.findOne(
						'api::product.product',
						item.productId
					)
					if (product) {
						const productPrice = Number(product.price || item.price || 0)
						totalAmount += productPrice * item.quantity
						products.push({
							...product,
							price: productPrice,
							quantity: item.quantity,
						})
					}
				}

				const deliveryCostValue = Number(cdekDeliveryCost ?? 0)
				if (!Number.isNaN(deliveryCostValue) && deliveryCostValue > 0) {
					totalAmount += deliveryCostValue
				}

				// Generate order number in Ozon format: YYYYMMDD-XXXX
				const orderNumber = await generateOrderNumber(strapi)

				// Determine delivery type (default to 'door' if not specified)
				const orderDeliveryType = deliveryType || 'door'

				// Create local order first
				const orderItems = products.map((product: any) => {
					const firstImage = Array.isArray(product.images)
						? product.images[0]
						: product.images
					const imageUrl =
						typeof firstImage === 'string'
							? firstImage
							: firstImage?.url || firstImage?.src || null

					return {
						productId: product.id,
						name: product.name,
						article: product.article,
						quantity: product.quantity,
						price: Number(product.price || 0),
						subtotal: Number(product.price || 0) * product.quantity,
						image: imageUrl,
					}
				})

				const orderData: any = {
					user: userId,
					orderNumber,
					status:
						paymentMethod === 'online' ? 'awaiting_payment' : 'pending',
					totalAmount,
					items: orderItems,
					shippingAddress,
					paymentMethod,
					paymentProvider: paymentProvider || null,
					notes,
					deliveryType: orderDeliveryType,
					customerData,
				}

				// Online orders are time-limited: if not paid within 30 minutes, they will be cancelled by cron.
				if (paymentMethod === 'online') {
					orderData.reservedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
				}

				if (!Number.isNaN(deliveryCostValue)) {
					orderData.cdekDeliveryCost = deliveryCostValue
				}

				// Add CDEK fields if delivery is not pickup
				if (orderDeliveryType !== 'pickup') {
					if (cdekTariffCode) orderData.cdekTariffCode = cdekTariffCode
					if (cdekPvzCode) orderData.cdekPvzCode = cdekPvzCode
					if (cdekPvzAddress) orderData.cdekPvzAddress = cdekPvzAddress
				}

				const order = await strapi.entityService.create('api::order.order', {
					data: orderData,
				})

				// Create order in CDEK if delivery is not pickup
				if (orderDeliveryType !== 'pickup' && shippingAddress.type === 'delivery') {
					try {
						const cdekService = strapi.service('api::cdek-sync.cdek-sync')

						// Prepare CDEK order data
						const deliveryAddress = shippingAddress.deliveryAddress
						if (!deliveryAddress || !customerData) {
							strapi.log.warn(
								'CDEK: Missing delivery address or customer data, skipping CDEK order creation'
							)
						} else {
							const mmToCmInt = (valueMm: unknown): number | undefined => {
								const n = Number(valueMm)
								if (!Number.isFinite(n) || n <= 0) return undefined
								const cm = n / 10
								return Math.max(1, Math.ceil(cm))
							}

							// Determine tariff code based on delivery type
							// 139 = Экспресс-лайт склад-дверь (до двери)
							// 138 = Посылка склад-склад (до ПВЗ)
							const tariffCode =
								cdekTariffCode ||
								(orderDeliveryType === 'door' ? 139 : 138)

							// Prepare packages from products
							// Weight should be in grams, if product.weight is in kg, multiply by 1000
							const packages = products.map((product: any) => {
								// Assume weight is in grams, if not, it should be converted
								const productWeight = product.weight || 1000 // Default 1kg = 1000g
								const totalWeight = productWeight * product.quantity

								return {
									weight: totalWeight,
									// Catalog stores dimensions in millimeters; CDEK expects centimeters.
									length: mmToCmInt(product.length),
									width: mmToCmInt(product.width),
									height: mmToCmInt(product.height),
									items: [
										{
											name: product.name,
											ware_key: product.article || product.id.toString(),
											payment: {
												value: product.price * product.quantity,
											},
											weight: totalWeight,
											amount: product.quantity,
										},
									],
								}
							})

							// If multiple packages, combine into one
							const totalWeight = packages.reduce(
								(sum: number, pkg: any) => sum + pkg.weight,
								0
							)
							const combinedLength = packages
								.map((pkg: any) => Number(pkg.length))
								.filter((value: number) => Number.isFinite(value) && value > 0)
							const combinedWidth = packages
								.map((pkg: any) => Number(pkg.width))
								.filter((value: number) => Number.isFinite(value) && value > 0)
							const combinedHeight = packages
								.map((pkg: any) => Number(pkg.height))
								.filter((value: number) => Number.isFinite(value) && value > 0)

							// For a single combined package we keep dimensions as max of each axis.
							// This is a conservative approximation that avoids losing dimensions entirely.
							const combinedDims = {
								length: combinedLength.length ? Math.max(...combinedLength) : undefined,
								width: combinedWidth.length ? Math.max(...combinedWidth) : undefined,
								height: combinedHeight.length ? Math.max(...combinedHeight) : undefined,
							}
							const combinedPackage = {
								weight: totalWeight,
								...combinedDims,
								items: packages.flatMap((pkg: any) => pkg.items || []),
							}

							const normalizePhoneE164 = (raw: unknown): string => {
								const digits = String(raw ?? '').replace(/\D+/g, '')
								if (!digits) return '+70000000000'
								if (digits.startsWith('8')) return `+7${digits.slice(1)}`
								if (digits.startsWith('7')) return `+${digits}`
								if (digits.startsWith('00')) return `+${digits.slice(2)}`
								return `+${digits}`
							}

							const cdekOrderData = {
								type: 1, // Интернет-магазин
								number: orderNumber,
								tariff_code: tariffCode,
								comment: notes || `Заказ ${orderNumber}`,
								from_location: {
									city: cdekService.config.warehouse.city,
									address: cdekService.config.warehouse.address,
								},
								// For PVZ orders CDEK requires `delivery_point` instead of `to_location`.
								...(orderDeliveryType === 'pvz'
									? { delivery_point: cdekPvzCode }
									: {
											to_location: {
												city: deliveryAddress.city,
												address: `${deliveryAddress.street}, ${deliveryAddress.house}${
													deliveryAddress.apartment ? `, кв. ${deliveryAddress.apartment}` : ''
												}`,
											},
									  }),
								recipient: {
									name: customerData.name || 'Получатель',
									phones: [
										{
											number: normalizePhoneE164(customerData.phone),
										},
									],
									email: customerData.email || undefined,
								},
								packages: [combinedPackage],
							}

							const cdekOrder = await cdekService.createOrder(cdekOrderData)

							// Update order with CDEK data
							if (cdekOrder.entity?.uuid) {
								await strapi.entityService.update('api::order.order', order.id, {
									data: {
										cdekOrderUuid: cdekOrder.entity.uuid,
										cdekTariffCode: tariffCode,
									},
								})
							}
						}
					} catch (cdekError: any) {
						// Log error but don't fail the order creation
						strapi.log.error('CDEK: Failed to create order in CDEK', {
							orderId: order.id,
							error: cdekError.details || cdekError.response?.data || cdekError.message,
							status: cdekError.status || cdekError.response?.status,
						})
						try {
							await strapi.entityService.update('api::order.order', order.id, {
								data: {
									cdekStatus: 'CREATION_FAILED',
								},
							})
						} catch (persistError: any) {
							strapi.log.error('CDEK: Failed to persist creation failure status', {
								orderId: order.id,
								error: persistError.message,
							})
						}
						// Order is still created locally, but CDEK integration failed
					}
				}

				ctx.body = {
					success: true,
					data: order,
					message: 'Order created successfully',
				}
			} catch (error: any) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Get order by ID
		 * GET /api/orders/:id
		 */
		async findOne(ctx) {
			try {
				const { id } = ctx.params
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const order = await strapi.entityService.findOne(
					'api::order.order',
					id,
					{
						populate: ['user'],
					}
				)

				if (!order || (order as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Order not found',
					}
					return
				}

				ctx.body = {
					success: true,
					data: order,
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},
	})
)
