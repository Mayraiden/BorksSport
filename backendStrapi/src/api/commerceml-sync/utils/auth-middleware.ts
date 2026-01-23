/**
 * Middleware для проверки Basic Auth
 * Используется для аутентификации запросов от Saby (СБИС)
 */

import type { Core } from '@strapi/strapi'

export interface BasicAuthCredentials {
	username: string
	password: string
}

/**
 * Проверяет Basic Auth credentials из заголовка Authorization
 * @param ctx - Koa context
 * @param strapi - Strapi instance
 * @returns true если аутентификация успешна, false иначе
 */
export function verifyBasicAuth(
	ctx: any,
	strapi: Core.Strapi
): boolean {
	const authHeader = ctx.request.headers.authorization

	if (!authHeader) {
		strapi.log.warn('[CommerceML] Missing Authorization header')
		return false
	}

	// Проверяем формат "Basic <base64>"
	if (!authHeader.startsWith('Basic ')) {
		strapi.log.warn('[CommerceML] Invalid Authorization header format')
		return false
	}

	// Декодируем base64
	const base64Credentials = authHeader.substring(6)
	let credentials: string

	try {
		credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
	} catch (error) {
		strapi.log.error('[CommerceML] Failed to decode Basic Auth:', error)
		return false
	}

	// Разделяем логин и пароль
	const [username, password] = credentials.split(':')

	if (!username || !password) {
		strapi.log.warn('[CommerceML] Invalid credentials format')
		return false
	}

	// Получаем credentials из .env
	const expectedUsername =
		process.env.COMMERCEML_BASIC_AUTH_USER || ''
	const expectedPassword =
		process.env.COMMERCEML_BASIC_AUTH_PASSWORD || ''

	// Проверяем credentials
	if (expectedUsername === '' || expectedPassword === '') {
		strapi.log.error(
			'[CommerceML] Basic Auth credentials not configured in .env'
		)
		return false
	}

	if (username === expectedUsername && password === expectedPassword) {
		strapi.log.info('[CommerceML] Basic Auth successful')
		return true
	}

	strapi.log.warn('[CommerceML] Invalid Basic Auth credentials')
	return false
}
