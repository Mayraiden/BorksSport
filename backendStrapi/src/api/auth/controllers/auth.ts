export default {
	/**
	 * Обновляет access token по refresh token
	 * POST /api/auth/refresh
	 */
	async refresh(ctx) {
		try {
			// Получаем refresh token из cookie или заголовка
			const refreshToken =
				ctx.cookies.get('refreshToken') ||
				ctx.request.body?.refreshToken ||
				ctx.request.header?.['x-refresh-token']

			if (!refreshToken) {
				ctx.status = 401
				ctx.body = {
					error: {
						status: 401,
						message: 'Refresh token is required',
					},
				}
				return
			}

			// Валидируем refresh token
			const refreshTokenService = strapi.service(
				'api::refresh-token.refresh-token'
			)
			const userId = await refreshTokenService.validateRefreshToken(
				refreshToken
			)

			if (!userId) {
				ctx.status = 401
				ctx.body = {
					error: {
						status: 401,
						message: 'Invalid or expired refresh token',
					},
				}
				return
			}

			// Генерируем новый access token
			const accessToken = strapi.plugins['users-permissions'].services.jwt.issue({
				id: userId,
			})

			ctx.body = {
				jwt: accessToken,
			}
		} catch (error: any) {
			strapi.log.error('Error in auth.refresh:', error)
			ctx.status = 500
			ctx.body = {
				error: {
					status: 500,
					message: error.message || 'Internal server error',
				},
			}
		}
	},
}

