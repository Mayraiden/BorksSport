/**
 * refresh-token service
 */

import { factories } from '@strapi/strapi'
import crypto from 'crypto'

export default factories.createCoreService(
	'api::refresh-token.refresh-token',
	({ strapi }) => ({
		/**
		 * Генерирует новый refresh token для пользователя
		 * @param userId - ID пользователя
		 * @returns Refresh token string
		 */
		async generateRefreshToken(userId: number | string): Promise<string> {
			// Генерируем криптографически стойкий случайный токен
			const token = crypto.randomBytes(64).toString('hex')

			// Срок жизни refresh token: 7 дней
			const expiresAt = new Date()
			expiresAt.setDate(expiresAt.getDate() + 7)

			const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId

			// Сохраняем токен в БД
			await strapi.entityService.create('api::refresh-token.refresh-token', {
				data: {
					token,
					user: userIdNum,
					expiresAt,
					revoked: false,
				},
			})

			return token
		},

		/**
		 * Валидирует refresh token
		 * @param token - Refresh token string
		 * @returns User ID если токен валиден, null если нет
		 */
		async validateRefreshToken(token: string): Promise<number | null> {
			if (!token) {
				return null
			}

			const refreshToken = await strapi.entityService.findMany(
				'api::refresh-token.refresh-token',
				{
					filters: {
						token,
						revoked: false,
					},
					populate: ['user'],
				}
			)

			if (!refreshToken || refreshToken.length === 0) {
				return null
			}

			const tokenRecord = refreshToken[0] as any

			// Проверяем срок действия
			const expiresAt = new Date(tokenRecord.expiresAt)
			if (expiresAt < new Date()) {
				// Токен истек, отмечаем как отозванный
				await this.revokeRefreshToken(token)
				return null
			}

			return tokenRecord.user?.id || null
		},

		/**
		 * Отзывает (аннулирует) refresh token
		 * @param token - Refresh token string
		 */
		async revokeRefreshToken(token: string): Promise<void> {
			const refreshToken = await strapi.entityService.findMany(
				'api::refresh-token.refresh-token',
				{
					filters: {
						token,
					},
				}
			)

			if (refreshToken && refreshToken.length > 0) {
				await strapi.entityService.update(
					'api::refresh-token.refresh-token',
					(refreshToken[0] as any).id,
					{
						data: {
							revoked: true,
						},
					}
				)
			}
		},

		/**
		 * Отзывает все refresh tokens пользователя
		 * @param userId - ID пользователя
		 */
		async revokeAllUserTokens(userId: number | string): Promise<void> {
			const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId
			const userTokens = await strapi.entityService.findMany(
				'api::refresh-token.refresh-token',
				{
					filters: {
						user: {
							id: userIdNum,
						},
						revoked: false,
					},
				}
			)

			// Обновляем все токены пользователя как отозванные
			for (const tokenRecord of userTokens) {
				await strapi.entityService.update(
					'api::refresh-token.refresh-token',
					(tokenRecord as any).id,
					{
						data: {
							revoked: true,
						},
					}
				)
			}
		},

		/**
		 * Очищает истекшие токены (можно использовать в cron job)
		 */
		async cleanupExpiredTokens(): Promise<number> {
			const now = new Date()

			const expiredTokens = await strapi.entityService.findMany(
				'api::refresh-token.refresh-token',
				{
					filters: {
						expiresAt: {
							$lt: now,
						},
						revoked: false,
					},
				}
			)

			let deletedCount = 0
			for (const tokenRecord of expiredTokens) {
				await strapi.entityService.delete(
					'api::refresh-token.refresh-token',
					(tokenRecord as any).id
				)
				deletedCount++
			}

			return deletedCount
		},
	})
)
