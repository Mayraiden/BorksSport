import type { Core } from '@strapi/strapi'

/**
 * Проверяет admin авторизацию через различные методы:
 * 1. Authorization header с JWT токеном
 * 2. Cookie strapi_admin_refresh (JWT токен)
 * 3. Cookie strapi.sid (сессия)
 * @param strapi - экземпляр Strapi
 * @param ctx - контекст запроса
 * @returns admin user или null
 */
export async function verifyAdminJWT(
	strapi: Core.Strapi,
	ctx: any
): Promise<any | null> {
	try {
		const cookieHeader = ctx.request?.header?.cookie || ctx.headers?.cookie || ''
		const authHeader = ctx.request?.header?.authorization || ctx.headers?.authorization || ''
		
		// Метод 1: Проверяем Authorization header с JWT токеном
		if (authHeader && authHeader.startsWith('Bearer ')) {
			let token = authHeader.substring(7).trim()
			
			// Убираем кавычки, если токен был отправлен с кавычками
			if (token.startsWith('"') && token.endsWith('"')) {
				token = token.slice(1, -1)
			}
			
			try {
				const jwt = require('jsonwebtoken')
				const decoded = jwt.decode(token, { complete: true })
				
				if (decoded && decoded.payload && decoded.payload.userId) {
					// Проверяем, что токен не истек
					if (decoded.payload.exp && decoded.payload.exp * 1000 < Date.now()) {
						strapi.log.debug('Admin JWT token from Authorization header expired')
					} else {
						const adminUser = await strapi.db.query('admin::user').findOne({
							where: { id: decoded.payload.userId },
						})
						
						if (adminUser) {
							strapi.log.debug('Admin authenticated via Authorization header', {
								userId: adminUser.id,
							})
							return adminUser
						} else {
							strapi.log.debug('Admin user not found for userId:', decoded.payload.userId)
						}
					}
				} else {
					strapi.log.debug('JWT token from Authorization header does not contain userId')
				}
			} catch (error: any) {
				strapi.log.debug('Failed to verify JWT from Authorization header:', error.message)
			}
		}
		
		// Метод 2: Проверяем cookie strapi_admin_refresh (JWT токен)
		const refreshMatch = cookieHeader.match(/strapi_admin_refresh=([^;]+)/)
		if (refreshMatch) {
			const token = refreshMatch[1]
			try {
				const jwt = require('jsonwebtoken')
				const decoded = jwt.decode(token, { complete: true })
				
				if (decoded && decoded.payload && decoded.payload.userId) {
					// Проверяем, что токен не истек
					if (decoded.payload.exp && decoded.payload.exp * 1000 < Date.now()) {
						strapi.log.debug('Admin JWT token expired')
					} else {
						const adminUser = await strapi.db.query('admin::user').findOne({
							where: { id: decoded.payload.userId },
						})
						
						if (adminUser) {
							strapi.log.debug('Admin authenticated via strapi_admin_refresh cookie')
							return adminUser
						}
					}
				}
			} catch (error: any) {
				strapi.log.debug('Failed to verify JWT from strapi_admin_refresh:', error.message)
			}
		}
		
		// Метод 3: Проверяем сессию через cookie strapi.sid
		// Это основной способ авторизации в Strapi admin панели
		const sessionMatch = cookieHeader.match(/strapi\.sid=([^;]+)/)
		if (sessionMatch) {
			const sessionId = sessionMatch[1]
			try {
				const session = await strapi.db.query('admin::session').findOne({
					where: { sessionId },
					populate: ['user'],
				})
				
				if (session && session.user) {
					// Проверяем, что сессия не истекла
					if (!session.expiresAt || new Date(session.expiresAt) >= new Date()) {
						strapi.log.debug('Admin authenticated via strapi.sid session')
						return session.user
					} else {
						strapi.log.debug('Admin session expired')
					}
				}
			} catch (error: any) {
				strapi.log.debug('Failed to verify session from strapi.sid:', error.message)
			}
		}
		
		// Логируем для диагностики
		strapi.log.debug('Admin authentication failed - no valid token or session found', {
			path: ctx.path || ctx.url,
			hasAuthHeader: !!authHeader,
			hasRefreshCookie: !!refreshMatch,
			hasSessionCookie: !!sessionMatch,
		})
		
		return null
	} catch (error: any) {
		strapi.log.debug('Error verifying admin JWT:', error.message)
		return null
	}
}
