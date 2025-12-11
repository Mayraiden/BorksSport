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
}

