export default {
	/**
	 * Get current user profile
	 * GET /api/users/me
	 */
	async me(ctx) {
		try {
			// Проверяем JWT токен вручную, если auth отключен
			if (!ctx.state.user) {
				const token = ctx.request.header.authorization?.replace('Bearer ', '')
				if (token) {
					try {
						const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
						ctx.state.user = await strapi
							.query('plugin::users-permissions.user')
							.findOne({ where: { id } })
					} catch (error) {
						// Токен невалидный, оставляем ctx.state.user как undefined
					}
				}
			}

		const userId = ctx.state.user?.id

		if (!userId) {
			ctx.status = 401
			ctx.body = {
				error: {
					status: 401,
					message: 'Unauthorized',
				},
			}
			return
		}

		// Используем query вместо entityService, чтобы получить все поля включая кастомные
		// entityService может фильтровать поля на основе permissions
		const user = await strapi
			.query('plugin::users-permissions.user')
			.findOne({ where: { id: userId } })

			if (!user) {
				ctx.status = 404
				ctx.body = {
					error: {
						status: 404,
						message: 'User not found',
					},
				}
				return
			}

			ctx.body = user
		} catch (error) {
			strapi.log.error('Error in user.me:', error)
			ctx.status = 500
			ctx.body = {
				error: {
					status: 500,
					message: error instanceof Error ? error.message : 'Internal server error',
				},
			}
		}
	},

	/**
	 * Update current user profile
	 * PUT /api/users/me
	 */
	async updateMe(ctx) {
		try {
			// Проверяем JWT токен вручную, если auth отключен
			if (!ctx.state.user) {
				const token = ctx.request.header.authorization?.replace('Bearer ', '')
				if (token) {
					try {
						const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
						ctx.state.user = await strapi
							.query('plugin::users-permissions.user')
							.findOne({ where: { id } })
					} catch (error) {
						// Токен невалидный, оставляем ctx.state.user как undefined
					}
				}
			}

			const userId = ctx.state.user?.id

			if (!userId) {
				ctx.status = 401
				ctx.body = {
					error: {
						status: 401,
						message: 'Unauthorized',
					},
				}
				return
			}

			const { firstName, phone } = ctx.request.body

			// Обновляем только разрешенные поля
			const updateData: Record<string, unknown> = {}
			if (firstName !== undefined) {
				updateData.firstName = firstName
			}
			if (phone !== undefined) {
				updateData.phone = phone
			}

			// Используем query вместо entityService, чтобы получить все поля включая кастомные
			const updatedUser = await strapi
				.query('plugin::users-permissions.user')
				.update({
					where: { id: userId },
					data: updateData,
				})

			ctx.body = updatedUser
		} catch (error) {
			strapi.log.error('Error in user.updateMe:', error)
			ctx.status = 500
			ctx.body = {
				error: {
					status: 500,
					message: error instanceof Error ? error.message : 'Internal server error',
				},
			}
		}
	},

	/**
	 * Delete current user account and all related data
	 * DELETE /api/users/me
	 */
	async deleteMe(ctx) {
		try {
			// Проверяем JWT токен вручную, если auth отключен
			if (!ctx.state.user) {
				const token = ctx.request.header.authorization?.replace('Bearer ', '')
				if (token) {
					try {
						const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
						ctx.state.user = await strapi
							.query('plugin::users-permissions.user')
							.findOne({ where: { id } })
					} catch (error) {
						// Токен невалидный, оставляем ctx.state.user как undefined
					}
				}
			}

			const userId = ctx.state.user?.id

			if (!userId) {
				ctx.status = 401
				ctx.body = {
					error: {
						status: 401,
						message: 'Unauthorized',
					},
				}
				return
			}

			strapi.log.info(`[User Delete] Starting deletion for user ${userId}`)

			// 1. Удаляем все заказы пользователя
			const orders = await strapi.entityService.findMany('api::order.order', {
				filters: { user: userId },
			})
			for (const order of orders) {
				await strapi.entityService.delete('api::order.order', (order as any).id)
			}
			strapi.log.info(`[User Delete] Deleted ${orders.length} orders`)

			// 2. Удаляем все элементы корзины
			const cartItems = await strapi.entityService.findMany('api::cart-item.cart-item', {
				filters: { user: userId },
			})
			for (const item of cartItems) {
				await strapi.entityService.delete('api::cart-item.cart-item', (item as any).id)
			}
			strapi.log.info(`[User Delete] Deleted ${cartItems.length} cart items`)

			// 3. Удаляем все избранные товары
			const favorites = await strapi.entityService.findMany('api::favorite.favorite', {
				filters: { user: userId },
			})
			for (const favorite of favorites) {
				await strapi.entityService.delete('api::favorite.favorite', (favorite as any).id)
			}
			strapi.log.info(`[User Delete] Deleted ${favorites.length} favorites`)

			// 4. Удаляем все адреса
			const addresses = await strapi.entityService.findMany('api::address.address', {
				filters: { user: userId },
			})
			for (const address of addresses) {
				await strapi.entityService.delete('api::address.address', (address as any).id)
			}
			strapi.log.info(`[User Delete] Deleted ${addresses.length} addresses`)

			// 5. Отзываем все refresh tokens пользователя
			const refreshTokenService = strapi.service('api::refresh-token.refresh-token')
			if (refreshTokenService) {
				await refreshTokenService.revokeAllUserTokens(userId)
				strapi.log.info(`[User Delete] Revoked all refresh tokens`)
			}

			// 6. Удаляем пользователя
			await strapi.query('plugin::users-permissions.user').delete({
				where: { id: userId },
			})
			strapi.log.info(`[User Delete] Deleted user ${userId}`)

			ctx.body = {
				success: true,
				message: 'User account and all related data deleted successfully',
			}
		} catch (error) {
			strapi.log.error('Error in user.deleteMe:', error)
			ctx.status = 500
			ctx.body = {
				error: {
					status: 500,
					message: error instanceof Error ? error.message : 'Internal server error',
				},
			}
		}
	},
}

