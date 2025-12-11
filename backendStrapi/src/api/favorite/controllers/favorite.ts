import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::favorite.favorite',
	({ strapi }) => ({
		/**
		 * Get user favorites
		 * GET /api/favorites
		 */
		async find(ctx) {
			try {
				const { query } = ctx
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
							// Убрали логирование для обычных ошибок токена
						}
					}
				}

				// Убрали debug логирование для обычных запросов

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const favorites = await strapi.entityService.findMany(
					'api::favorite.favorite',
					{
						filters: { user: userId },
						populate: ['product'],
						sort: 'createdAt:desc',
					}
				)

				ctx.body = {
					success: true,
					data: favorites,
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
		 * Add product to favorites
		 * POST /api/favorites
		 */
		async create(ctx) {
			try {
				const { productId } = ctx.request.body
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
							// Убрали логирование для обычных ошибок токена
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

				// Check if already in favorites
				const existing = await strapi.entityService.findMany(
					'api::favorite.favorite',
					{
						filters: { user: userId, product: productId },
					}
				)

				if (existing.length > 0) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Product already in favorites',
					}
					return
				}

				const favorite = await strapi.entityService.create(
					'api::favorite.favorite',
					{
						data: {
							user: userId,
							product: productId,
						},
						populate: ['product'],
					}
				)

				ctx.body = {
					success: true,
					data: favorite,
					message: 'Product added to favorites',
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
		 * Remove product from favorites
		 * DELETE /api/favorites/:id
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
							const { id: extractedId } =
								await strapi.plugins['users-permissions'].services.jwt.verify(
									token
								)
							userId = extractedId
						} catch (tokenError) {
							// Убрали логирование для обычных ошибок токена
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

				const favorite = await strapi.entityService.findOne(
					'api::favorite.favorite',
					id,
					{
						populate: ['user'],
					}
				)

				if (!favorite || (favorite as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Favorite not found',
					}
					return
				}

				await strapi.entityService.delete('api::favorite.favorite', id)

				ctx.body = {
					success: true,
					message: 'Product removed from favorites',
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
		 * Check if product is in favorites by productId
		 * GET /api/favorites/check/:productId
		 */
		async checkByProductId(ctx) {
			try {
				const { productId } = ctx.params
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
							// Убрали логирование для обычных ошибок токена
						}
					}
				}

				// Убрали debug логирование для обычных запросов

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const favorite = await strapi.entityService.findMany(
					'api::favorite.favorite',
					{
						filters: { user: userId, product: productId },
					}
				)

				ctx.body = {
					success: true,
					data: {
						isFavorite: favorite.length > 0,
						favoriteId: favorite.length > 0 ? favorite[0].id : null,
					},
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
		 * Toggle favorite by productId (add if not exists, remove if exists)
		 * POST /api/favorites/toggle
		 */
		async toggle(ctx) {
			try {
				const { productId } = ctx.request.body
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
							// Убрали логирование для обычных ошибок токена
						}
					}
				}

				// Убрали debug логирование для обычных запросов

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

				// Check if already in favorites
				const existing = await strapi.entityService.findMany(
					'api::favorite.favorite',
					{
						filters: { user: userId, product: productId },
					}
				)

				if (existing.length > 0) {
					// Remove from favorites
					await strapi.entityService.delete(
						'api::favorite.favorite',
						existing[0].id
					)
					ctx.body = {
						success: true,
						data: { isFavorite: false },
						message: 'Product removed from favorites',
					}
				} else {
					// Add to favorites
					const favorite = await strapi.entityService.create(
						'api::favorite.favorite',
						{
							data: {
								user: userId,
								product: productId,
							},
							populate: ['product'],
						}
					)
					ctx.body = {
						success: true,
						data: { isFavorite: true, favorite },
						message: 'Product added to favorites',
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
	})
)
