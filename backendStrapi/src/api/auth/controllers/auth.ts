const resendAttempts = new Map<string, { count: number; windowStart: number; lastSentAt: number }>()

const RESEND_WINDOW_MS = Number(process.env.EMAIL_CONFIRM_RESEND_WINDOW_MS || 10 * 60 * 1000)
const RESEND_MAX_PER_WINDOW = Number(process.env.EMAIL_CONFIRM_RESEND_MAX_PER_WINDOW || 5)
const RESEND_COOLDOWN_MS = Number(process.env.EMAIL_CONFIRM_RESEND_COOLDOWN_MS || 60 * 1000)

const getClientKey = (ctx: any, email: string) => {
	const ip = ctx.request.ip || ctx.request.ips?.[0] || 'unknown'
	return `${String(email || '').toLowerCase().trim()}::${ip}`
}

const confirmEmailByToken = async (confirmationToken: string) => {
	if (!confirmationToken) {
		throw new Error('Confirmation token is required')
	}

	const user = await strapi.db
		.query('plugin::users-permissions.user')
		.findOne({ where: { confirmationToken } })

	if (!user) {
		throw new Error('Invalid confirmation token')
	}

	if (user.confirmed) {
		return user
	}

	await strapi.db.query('plugin::users-permissions.user').update({
		where: { id: user.id },
		data: {
			confirmed: true,
			confirmationToken: null,
		},
	})

	return user
}

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

	/**
	 * Sends confirmation email again with cooldown and basic rate limit.
	 * POST /api/auth/resend-confirmation
	 */
	async resendConfirmation(ctx) {
		try {
			const email = String(ctx.request.body?.email || '')
				.toLowerCase()
				.trim()

			if (!email) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Email is required',
				}
				return
			}

			const key = getClientKey(ctx, email)
			const now = Date.now()
			const existing = resendAttempts.get(key)

			if (existing) {
				if (now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
					const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000)
					ctx.status = 429
					ctx.body = {
						success: false,
						message: `Please wait ${retryAfterSec}s before requesting another email`,
					}
					return
				}

				if (now - existing.windowStart <= RESEND_WINDOW_MS && existing.count >= RESEND_MAX_PER_WINDOW) {
					ctx.status = 429
					ctx.body = {
						success: false,
						message: 'Too many confirmation requests. Please try again later.',
					}
					return
				}
			}

			const user = await strapi.db.query('plugin::users-permissions.user').findOne({
				where: { email },
			})

			// Do not leak whether an email exists in system.
			if (!user) {
				ctx.body = {
					success: true,
					message: 'If this email exists, a confirmation letter has been sent',
				}
				return
			}

			if (user.confirmed) {
				ctx.body = {
					success: true,
					message: 'Email is already confirmed',
				}
				return
			}

			await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(user)

			const isSameWindow = existing && now - existing.windowStart <= RESEND_WINDOW_MS
			resendAttempts.set(key, {
				windowStart: isSameWindow ? existing.windowStart : now,
				count: isSameWindow ? existing.count + 1 : 1,
				lastSentAt: now,
			})

			ctx.body = {
				success: true,
				message: 'If this email exists, a confirmation letter has been sent',
			}
		} catch (error: any) {
			strapi.log.error('Error in auth.resendConfirmation:', error)
			ctx.status = 500
			ctx.body = {
				success: false,
				error: {
					status: 500,
					message: error.message || 'Internal server error',
				},
			}
		}
	},

	/**
	 * Confirms email token and returns JSON instead of redirect.
	 * GET /api/auth/confirm-email?confirmation=...
	 */
	async confirmEmail(ctx) {
		try {
			const confirmationToken = String(ctx.request.query?.confirmation || '').trim()
			await confirmEmailByToken(confirmationToken)

			ctx.body = {
				success: true,
				message: 'Email confirmed successfully',
			}
		} catch (error: any) {
			strapi.log.error('Error in auth.confirmEmail:', error)
			ctx.status = 400
			ctx.body = {
				success: false,
				message: error.message || 'Invalid or expired confirmation token',
			}
		}
	},
}

