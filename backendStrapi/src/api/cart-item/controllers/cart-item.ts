import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::cart-item.cart-item',
	({ strapi }) => ({
		/**
		 * Get user cart
		 * GET /api/cart-items
		 */
		async find(ctx) {
			try {
				let userId = ctx.state.user?.id

				// Если userId нет в state, попробуем извлечь из токена
				if (!userId) {
					const authHeader = ctx.request.header?.authorization
					if (authHeader && authHeader.startsWith('Bearer ')) {
						const token = authHeader.substring(7)
						try {
							const { id } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = id
						} catch (tokenError) {
							// Игнорируем ошибки токена
						}
					}
				}

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const cartItems = await strapi.entityService.findMany(
					'api::cart-item.cart-item',
					{
						filters: { user: userId },
						populate: ['product'],
						sort: 'createdAt:desc',
					}
				)

				ctx.body = {
					success: true,
					data: cartItems,
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
		 * Add product to cart
		 * POST /api/cart-items
		 */
		async create(ctx) {
			try {
				const { productId, quantity = 1 } = ctx.request.body
				let userId = ctx.state.user?.id

				// Если userId нет в state, попробуем извлечь из токена
				if (!userId) {
					const authHeader = ctx.request.header?.authorization
					if (authHeader && authHeader.startsWith('Bearer ')) {
						const token = authHeader.substring(7)
						try {
							const { id } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = id
						} catch (tokenError) {
							// Игнорируем ошибки токена
						}
					}
				}

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				if (!productId) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Product ID is required',
					}
					return
				}

				// Check if product already in cart
				const existing = await strapi.entityService.findMany(
					'api::cart-item.cart-item',
					{
						filters: { user: userId, product: productId },
					}
				)

				if (existing.length > 0) {
					// Update quantity
					const updated = await strapi.entityService.update(
						'api::cart-item.cart-item',
						existing[0].id,
						{
							data: {
								quantity: existing[0].quantity + quantity,
							},
							populate: ['product'],
						}
					)

					ctx.body = {
						success: true,
						data: updated,
						message: 'Cart item quantity updated',
					}
				} else {
					// Create new cart item
					const cartItem = await strapi.entityService.create(
						'api::cart-item.cart-item',
						{
							data: {
								user: userId,
								product: productId,
								quantity,
							},
							populate: ['product'],
						}
					)

					ctx.body = {
						success: true,
						data: cartItem,
						message: 'Product added to cart',
					}
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
		 * Update cart item quantity
		 * PUT /api/cart-items/:id
		 */
		async update(ctx) {
			try {
				const { id } = ctx.params
				const { quantity } = ctx.request.body
				let userId = ctx.state.user?.id

				// Если userId нет в state, попробуем извлечь из токена
				if (!userId) {
					const authHeader = ctx.request.header?.authorization
					if (authHeader && authHeader.startsWith('Bearer ')) {
						const token = authHeader.substring(7)
						try {
							const { id } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = id
						} catch (tokenError) {
							// Игнорируем ошибки токена
						}
					}
				}

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				if (!quantity || quantity < 1) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Valid quantity is required',
					}
					return
				}

				const cartItem = await strapi.entityService.findOne(
					'api::cart-item.cart-item',
					id,
					{
						populate: ['user'],
					}
				)

				if (!cartItem || (cartItem as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Cart item not found',
					}
					return
				}

				const updated = await strapi.entityService.update(
					'api::cart-item.cart-item',
					id,
					{
						data: { quantity },
						populate: ['product'],
					}
				)

				ctx.body = {
					success: true,
					data: updated,
					message: 'Cart item updated',
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
		 * Remove product from cart
		 * DELETE /api/cart-items/:id
		 */
		async delete(ctx) {
			try {
				const { id } = ctx.params
				let userId = ctx.state.user?.id

				// Если userId нет в state, попробуем извлечь из токена
				if (!userId) {
					const authHeader = ctx.request.header?.authorization
					if (authHeader && authHeader.startsWith('Bearer ')) {
						const token = authHeader.substring(7)
						try {
							const { id } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = id
						} catch (tokenError) {
							// Игнорируем ошибки токена
						}
					}
				}

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const cartItem = await strapi.entityService.findOne(
					'api::cart-item.cart-item',
					id,
					{
						populate: ['user'],
					}
				)

				if (!cartItem || (cartItem as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Cart item not found',
					}
					return
				}

				await strapi.entityService.delete('api::cart-item.cart-item', id)

				ctx.body = {
					success: true,
					message: 'Product removed from cart',
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
		 * Clear user cart
		 * DELETE /api/cart-items
		 */
		async deleteMany(ctx) {
			try {
				let userId = ctx.state.user?.id

				// Если userId нет в state, попробуем извлечь из токена
				if (!userId) {
					const authHeader = ctx.request.header?.authorization
					if (authHeader && authHeader.startsWith('Bearer ')) {
						const token = authHeader.substring(7)
						try {
							const { id } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = id
						} catch (tokenError) {
							// Игнорируем ошибки токена
						}
					}
				}

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const cartItems = await strapi.entityService.findMany(
					'api::cart-item.cart-item',
					{
						filters: { user: userId },
					}
				)

				for (const item of cartItems) {
					await strapi.entityService.delete('api::cart-item.cart-item', item.id)
				}

				ctx.body = {
					success: true,
					message: 'Cart cleared',
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
