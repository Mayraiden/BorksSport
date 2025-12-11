import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::order.order',
	({ strapi }) => ({
		async resolveUserId(ctx: any) {
			let userId = ctx.state.user?.id

			if (!userId) {
				const authHeader = ctx.request.header?.authorization
				if (authHeader && authHeader.startsWith('Bearer ')) {
					const token = authHeader.substring(7)

					try {
						const { id } = await strapi.plugins[
							'users-permissions'
						].services.jwt.verify(token)
						userId = id
					} catch (tokenError) {
						// ignore token errors, will fall back to 401 below
					}
				}
			}

			return userId
		},
		/**
		 * Get user orders
		 * GET /api/orders
		 */
		async find(ctx) {
			try {
				const userId = await this.resolveUserId(ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const orders = await strapi.entityService.findMany('api::order.order', {
					filters: { user: userId },
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
				const userId = await this.resolveUserId(ctx)

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

				// Generate order number
				const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

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
									length: product.length || undefined,
									width: product.width || undefined,
									height: product.height || undefined,
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
							const combinedPackage = {
								weight: totalWeight,
								items: packages.flatMap((pkg: any) => pkg.items || []),
							}

							// Prepare location
							const toLocation: any = {
								city: deliveryAddress.city,
							}

							// Если ПВЗ доставка, используем код ПВЗ
							if (orderDeliveryType === 'pvz' && cdekPvzCode) {
								toLocation.code = parseInt(cdekPvzCode, 10) || undefined
							} else {
								// Для доставки до двери нужен адрес
								toLocation.address = `${deliveryAddress.street}, ${deliveryAddress.house}${
									deliveryAddress.apartment ? `, кв. ${deliveryAddress.apartment}` : ''
								}`
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
								to_location: toLocation,
								recipient: {
									name: customerData.name || 'Получатель',
									phones: [
										{
											number: customerData.phone || '',
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
							error: cdekError.message,
						})
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
				const userId = await this.resolveUserId(ctx)

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
